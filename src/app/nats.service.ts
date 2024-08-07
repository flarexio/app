import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';

import { Msg, NatsConnection, StringCodec, jwtAuthenticator, wsconnect } from '@nats-io/nats-core';

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
