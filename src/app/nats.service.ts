import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';

import { Msg, NatsConnection, StringCodec, jwtAuthenticator, wsconnect } from '@nats-io/nats-core';
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

    return from(nc.subscribe(subject));
  }

  private async _generateUserJWT(id: string, user: string, account: string): Promise<string> {
    const claims: jwt.ClaimsData<User> = {
      name: id,
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

  public generateUserJWT(id: string, user: string, account: string): Observable<string> {
    return from(this._generateUserJWT(id, user, account));
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
