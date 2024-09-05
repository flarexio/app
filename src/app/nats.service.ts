import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';

import { Empty, Msg, NatsConnection, StringCodec, createInbox, jwtAuthenticator, wsconnect } from '@nats-io/nats-core';
import { base32 } from '@nats-io/nkeys/lib/base32';
import { Algorithms, Base64UrlCodec, Types, User, randomID } from 'nats-jwt';
import * as jwt from 'nats-jwt';

import { environment as env } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NatsService {
  private _nc: NatsConnection | undefined;
  private _connectionChangeSubject = new BehaviorSubject<NatsConnection | undefined>(undefined);

  connectionChange = this._connectionChangeSubject.asObservable();

  constructor() {
    const jwt = localStorage.getItem('nats_jwt');
    const seed = localStorage.getItem('nats_seed');

    if ((jwt == null) || (seed == null)) return;

    const seedBytes = new TextEncoder().encode(seed);

    this.connect(jwt, seedBytes).subscribe({
      next: (nc) => this.nc = nc,
      error: (err) => console.error(err),
      complete: () => console.log('nats complete'),
    });
  }

  connect(token: string, seed: Uint8Array): Observable<NatsConnection> {
    const auth = jwtAuthenticator(token, seed);

    return from(wsconnect({
      name: 'app',
      servers: env.NATS_SERVER,
      authenticator: auth,
    }));
  }

  publish(subject: string, message: string) {
    const nc = this._nc;
    if (nc == undefined) return;

    const sc = StringCodec();

    nc.publish(subject, sc.encode(message));
  }

  subscribe(subject: string): Observable<Msg | undefined> {
    const nc = this._nc;
    if (nc == undefined) return of(undefined);

    return new Observable<Msg>(observer => {
      const subscription = nc.subscribe(subject, {
        callback: (err, msg) => {
          if (err) {
            observer.error(err);
          } else {
            observer.next(msg);
          }
        }
      });

      return () => {
        subscription.unsubscribe();
      }
    });
  }

  discoverServices(name: string): Observable<ServiceIdentity | undefined> {
    const nc = this._nc;
    if (nc == undefined) return of(undefined);

    const subject = new BehaviorSubject<ServiceIdentity | undefined>(undefined);

    const inbox = createInbox();

    const sub = nc.subscribe(inbox, {
      timeout: 5000,
      callback: (err, msg) => {
        if (err != null) {
          sub.unsubscribe();
          subject.complete();
          return;
        }

        if (msg.data.every((value, index) => value === Empty[index])) {
          sub.unsubscribe();
          subject.complete();
          return;
        }

        const raw = JSON.parse(msg.string()) as ServiceIdentity;
        const proxy = Object.assign(new ServiceIdentity(), raw);

        subject.next(proxy);
      }
    });

    nc.publish(`$SRV.PING.${name}`, Empty, { reply: inbox });

    return subject.asObservable();
  }

  private async _generateUserJWT(name: string, user: string, account: string): Promise<string> {
    const claims: jwt.ClaimsData<User> = {
      name: name,
      aud: 'NATS',
      jti: '',
      iat: Math.floor(Date.now() / 1000),
      iss: account,
      sub: user,
      nats: {
        subs: -1,
        data: -1,
        payload: -1,
        type: Types.User,
        version: 2,
      },
    };

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const data = encoder.encode(JSON.stringify(claims));
    if (globalThis.crypto && globalThis.crypto.subtle) {
      const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
      const encoded = base32.encode(new Uint8Array(hash));
      claims.jti = decoder.decode(encoded);
    } else {
      claims.jti = randomID();
    }

    const h = {
      typ: 'JWT',
      alg: Algorithms.v2,
    };

    const header = Base64UrlCodec.encode(JSON.stringify(h));
    const payload = Base64UrlCodec.encode(JSON.stringify(claims));

    return `${header}.${payload}`;
  }

  public generateUserJWT(name: string, user: string, account: string): Observable<string> {
    return from(this._generateUserJWT(name, user, account));
  }

  public set nc(value: NatsConnection | undefined) {
    this._nc = value;
    this._connectionChangeSubject.next(value);
  }

  public get nc(): NatsConnection | undefined {
    return this._nc;
  }

  public get isConnected(): boolean {
    return this._nc != undefined;
  }
}

export class ServiceIdentity {
	name: string = '';
	id: string = '';
	version: string = '';
	metadata: { [key: string]: string } = {};
}
