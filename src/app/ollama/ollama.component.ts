import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { Observable, concatMap, from, mergeMap } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';

import { Prefix, createUser } from '@nats-io/nkeys';
import { Codec } from '@nats-io/nkeys/lib/codec';
import { Base64UrlCodec } from 'nats-jwt';

import { NatsService } from '../nats.service';
import { OllamaService, Model } from '../ollama.service';
import { WalletService } from '../wallet.service';

@Component({
  selector: 'app-ollama',
  standalone: true,
  imports: [
    AsyncPipe, 
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  templateUrl: './ollama.component.html',
  styleUrl: './ollama.component.scss'
})
export class OllamaComponent {
  ver: Observable<string | undefined>;
  models: Observable<Model[] | undefined>;
  chats: Observable<string | undefined>;

  selectedModel: Model | undefined;
  result: string | undefined;

  private _loading: boolean = false;

  constructor(
    private natsService: NatsService,
    private ollamaService: OllamaService,
    private walletService: WalletService,
  ) {
    this.ver = this.natsService.connectionChange.pipe(
      mergeMap((_) => this.ollamaService.getVersion())
    );

    this.models = this.natsService.connectionChange.pipe(
      mergeMap((_) => this.ollamaService.listModels())
    );

    this.chats = this.natsService.connectionChange.pipe(
      mergeMap((_) => this.ollamaService.subChats(value => this.loading = value))
    );
  }

  signUserJWT() {
    const currentWallet = this.walletService.currentWallet;
    if (currentWallet == undefined) return;

    const pubkey = currentWallet.publicKey;
    if (pubkey == null) return;

    const accountPubkey = Codec.encode(Prefix.Account, pubkey.toBytes());
    const user = createUser();

    const decoder = new TextDecoder();

    from(
      this.natsService.generateUserJWT('main', 
        user.getPublicKey(),
        decoder.decode(accountPubkey),
      )
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

  sendMsg(input: HTMLInputElement) {
    const msg = input.value;
    input.value = '';

    const nc = this.natsService.nc;
    if (nc == undefined) return;

    const model = this.selectedModel;
    if (model == undefined) return;

    this.loading = true;

    this.ollamaService.chat(
      model.model, msg
    ).subscribe({
      next: (result) => this.result = result,
      error: (err) => console.error(err),
      complete: () => console.log('complete'),
    });
  }

  public get isNatsConnected(): boolean {
    return this.natsService.isConnected;
  }

  public get loading(): boolean {
    return this._loading;
  }

  public set loading(value: boolean) {
    this._loading = value;
  }
}
