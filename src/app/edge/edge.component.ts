import { AsyncPipe, JsonPipe } from '@angular/common';
import { Component } from '@angular/core';
import { Observable, concatMap, mergeMap } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

import { createUser } from '@nats-io/nkeys';
import { Prefix } from '@nats-io/nkeys';
import { Codec } from '@nats-io/nkeys/lib/codec';
import { Base64UrlCodec } from 'nats-jwt';

import { EdgeService, EdgeProxy } from '../edge.service';
import { NatsService } from '../nats.service';
import { WalletService } from '../wallet.service';

@Component({
  selector: 'app-edge',
  standalone: true,
  imports: [
    AsyncPipe,
    JsonPipe,
    MatButtonModule,
    MatCardModule,
  ],
  templateUrl: './edge.component.html',
  styleUrl: './edge.component.scss'
})
export class EdgeComponent {
  edges: Observable<EdgeProxy[] | undefined>;

  constructor(
    private edgeService: EdgeService,
    private natsService: NatsService,
    private walletService: WalletService,
  ) {
    this.edges = this.natsService.connectionChange.pipe(
      mergeMap((_) => this.edgeService.listEdges())
    )
  }

  signUserJWT() {
    const currentWallet = this.walletService.currentWallet;
    if (currentWallet == undefined) return;

    const pubkey = currentWallet.publicKey;
    if (pubkey == null) return;

    const accountPubkey = Codec.encode(Prefix.Account, pubkey.toBytes());
    const user = createUser();

    const decoder = new TextDecoder();

    this.natsService.generateUserJWT('main', 
      user.getPublicKey(),
      decoder.decode(accountPubkey),
    ).pipe(
      concatMap(async (token) => {
        const encoder = new TextEncoder();
        const tokenBytes = encoder.encode(token);

        const sigBytes = await currentWallet.signMessage(tokenBytes);
        if (sigBytes == undefined) return "invalid sigurature";

        const sig = Base64UrlCodec.encode(sigBytes);
        return `${token}.${sig}`;
      }),
    ).subscribe({
      next: (token) => {
        const decoder = new TextDecoder();
        const seedBytes = user.getSeed();
        const seed = decoder.decode(seedBytes);

        localStorage.setItem('nats_jwt', token);
        localStorage.setItem('nats_seed', seed);
      },
      error: (err) => console.error(err),
      complete: () => console.log('complete'),
    });
  }

  public get isNatsConnected(): boolean {
    return this.natsService.isConnected;
  }
}
