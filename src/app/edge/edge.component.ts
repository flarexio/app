import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { Observable, from, map, mergeMap, of, scan } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { PublicKey } from '@solana/web3.js';
import { Empty, NatsConnection } from '@nats-io/nats-core';
import { Prefix, createUser } from '@nats-io/nkeys';
import { Codec } from '@nats-io/nkeys/lib/codec';
import { base32 } from '@nats-io/nkeys/lib/base32';
import { Algorithms, Base64UrlCodec, Types, User, randomID } from 'nats-jwt';
import * as jwt from 'nats-jwt';

import { NatsService } from '../nats.service';
import { WalletService } from '../wallet.service';

@Component({
  selector: 'app-edge',
  standalone: true,
  imports: [
    AsyncPipe, 
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './edge.component.html',
  styleUrl: './edge.component.scss'
})
export class EdgeComponent {
  ver: Observable<string | undefined>;
  chats: Observable<string | undefined>;
  result: string | undefined;
  loading: boolean = false;

  constructor(
    private natsService: NatsService,
    private walletService: WalletService,
  ) {
    this.ver = this.natsService.connectionChange.pipe(
      mergeMap((nc) => this.getVersion('ollama.version', nc))
    );

    this.chats = this.natsService.connectionChange.pipe(
      mergeMap((nc) => this.subChats('ollama.chats.>', nc))
    );
  }

  async signUserJWT() {
    const currentWallet = this.walletService.currentWallet;
    if (currentWallet == undefined) return;

    const pubkey = currentWallet.publicKey;
    if (pubkey == null) return;

    const account = pubkey.toBase58();

    const accountPubkey = Codec.encode(
      Prefix.Account, 
      new PublicKey(account).toBytes(),
    );

    const user = createUser();

    const decoder = new TextDecoder();
    const claims: jwt.ClaimsData<User> = {
      name: 'main',
      aud: 'NATS',
      jti: '',
      iat: Math.floor(Date.now() / 1000),
      iss: decoder.decode(accountPubkey),
      sub: user.getPublicKey(),
      nats: {
        subs: -1,
        data: -1,
        payload: -1,
        type: Types.User,
        version: 2,
      },
    };

    const encoder = new TextEncoder();
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

    const message = encoder.encode(`${header}.${payload}`);
    const sigBytes = await currentWallet.signMessage(message);
    if (sigBytes == undefined) return;

    const sig = Base64UrlCodec.encode(sigBytes);

    const token = `${header}.${payload}.${sig}`;

    console.log(token);

    const seedBytes = user.getSeed();
    const seed = decoder.decode(seedBytes);

    localStorage.setItem('nats_jwt', token);
    localStorage.setItem('nats_seed', seed);
  }

  sendMsg(input: HTMLInputElement) {
    const msg = input.value;
    input.value = '';

    const nc = this.natsService.nc;
    if (nc == undefined) return;

    this.loading = true;

    const req = {
      model: 'llama3.1',
      messages: [
        { role: 'user', content: msg },
      ],
      stream: true,
    };

    const payload = JSON.stringify(req);

    from(
      nc.request(`ollama.chats`, payload, { timeout: 5000 })
    ).subscribe({
      next: (msg) => this.result = msg.string(),
      error: (err) => console.error(err),
      complete: () => console.log('complete'),
    });
  }

  subChats(subject: string, nc: NatsConnection | undefined): Observable<string | undefined> {
    if (nc == undefined) return of(undefined);

    return from(nc.subscribe(subject)).pipe(
      map((msg) => { 
        const obj = JSON.parse(msg.string());

        if (obj.done) {
          this.loading = false;
          return '\n';
        }

        return obj.message.content;
      }),
      scan((acc, curr) => acc + curr, ''),
    )
  }

  getVersion(subject: string, nc: NatsConnection | undefined): Observable<string | undefined> {
    if (nc == undefined) return of(undefined);

    return from(nc.request(subject, Empty, { timeout: 5000 })).pipe(
      map((msg) => msg.string()),
    )
  }

  // listModels(subject: string, nc: NatsConnection | undefined): Observable<string | undefined> {
  //   if (nc == undefined) return of(undefined);
  //   return from(nc.request(subject, Empty, { timeout: 5000 })).pipe(
  //     map((msg) => msg.string()),
  //   )
  // }

  public get isNatsConnected(): boolean {
    return this.natsService.isConnected;
  }
}
