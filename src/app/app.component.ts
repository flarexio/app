import { AsyncPipe, CurrencyPipe, SlicePipe } from '@angular/common'
import { Component, HostListener, ViewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Observable, concatMap, share } from 'rxjs';

import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { 
  SignMessagePayload, 
  WalletMessage, WalletMessageType, WalletMessageResponse,
} from '@flarex/wallet-adapter';
import { Connection } from '@solana/web3.js';
import { BaseMessageSignerWalletAdapter, WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { v4 as uuid } from 'uuid';
import * as base58 from 'bs58';

import { SolanaService } from './solana.service';
import { WalletService } from './wallet.service';
import { WalletBottomSheetComponent } from './wallet-bottom-sheet/wallet-bottom-sheet.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    AsyncPipe,
    CurrencyPipe,
    SlicePipe,
    RouterOutlet,
    MatBottomSheetModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatMenuModule,
    MatSelectModule,
    MatSidenavModule,
    MatToolbarModule,
    MatTooltipModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  width = window.innerWidth;

  networks = Object.entries(WalletAdapterNetwork)
                   .map(([ key, value ]) => ({ key, value }));

  getAccount: Observable<string | undefined>;
  getBalance: Observable<number | undefined>;

  signedResult = '';

  @ViewChild(MatDrawer) drawer: MatDrawer | undefined;

  constructor(
    private bottomSheet: MatBottomSheet,
    private solService: SolanaService,
    private walletService: WalletService,
    private router: Router,
  ) {
    this.solService.connectionChange.subscribe({
      next: () => {
        const wallet = this.walletService.currentWallet;
        if (wallet == undefined) return;

        const pubkey = wallet.publicKey;
        if (pubkey == null) return;

        this.walletService.refreshWallet(pubkey);
      },
    });

    this.walletService.walletChange.subscribe(
      (pubkey) => {
        if (pubkey == null) return;
        console.log(`wallet connected, pubkey: ${pubkey}`);
      }
    );

    this.getAccount = this.walletService.walletChange.pipe(
      concatMap((pubkey) => this.solService.getAccount(pubkey))
    );

    this.getBalance = this.walletService.walletChange.pipe(
      concatMap((pubkey) => this.solService.getBalance(pubkey)),
      share(),
    );

    // const defaultWallet = localStorage.getItem("default_wallet");
    // if (defaultWallet != null && defaultWallet != '') {
    //   this.walletService.autoConnect(defaultWallet);
    // }
  }

  @HostListener('window:resize', ['$event'])
  windowResizeHandler() {
    this.width = window.innerWidth;
  }

  private walletWindow: WindowProxy | null = null;
  private todo: WalletMessage | undefined;

  @HostListener('window:message', ['$event'])
  messageHandler(event: MessageEvent) {
    console.log(event);

    if (event.origin != 'https://wallet.flarex.io') return;

    // wallet is ready
    if (event.data == 'WALLET_READY') {
      if (this.todo == undefined) return;

      this.walletWindow?.postMessage(this.todo.serialize(), 'https://wallet.flarex.io');
      this.todo = undefined;
      return;
    }

    // sign message
    const msg = WalletMessageResponse.deserialize(event.data);
    if (msg.type == WalletMessageType.SIGN_MESSAGE) {
      if (!msg.success) {
        this.signedResult = msg.error ?? 'unknown error';
        return;
      }

      const payload = msg.payload as SignMessagePayload;
      const bytes = payload.sig;
      if (bytes == undefined) {
        this.signedResult = 'no signature';
        return;
      }

      const based58 = base58.encode(bytes);
      this.signedResult = based58;
    }
  }

  openWindow() {
    const width = 440;
    const height = 700;
    const left = window.screenX + window.outerWidth - 10;
    const top = window.screenY;

    this.walletWindow = window.open('https://wallet.flarex.io', 'wallet', 
      `width=${width},height=${height},top=${top},left=${left}`);

    setInterval(() => {
      if (this.todo == undefined) return;

      this.walletWindow?.postMessage('IS_READY', 'https://wallet.flarex.io');
    }, 1000);
  }

  signMessage(message: string) {
    this.openWindow();

    const payload = new SignMessagePayload(new TextEncoder().encode(message));

    const msg = new WalletMessage(
      uuid(),
      WalletMessageType.SIGN_MESSAGE,
      'https://app.flarex.io',
      payload,
    );

    this.todo = msg;
  }

  signMessageV2(message: string) {
    const payload = new SignMessagePayload(new TextEncoder().encode(message));

    const msg = new WalletMessage(
      uuid(),
      WalletMessageType.SIGN_MESSAGE,
      'https://app.flarex.io',
      payload,
    );

    this.walletService.createSession(msg).subscribe({
      next: (resp) => {
        if (resp instanceof WalletMessageResponse) {
          // sign message
          const msg = resp;
          if (msg.type == WalletMessageType.SIGN_MESSAGE) {
            if (!msg.success) {
              this.signedResult = msg.error ?? 'unknown error';
              return;
            }

            const payload = msg.payload as SignMessagePayload;
            const bytes = payload.sig;
            if (bytes == undefined) {
              this.signedResult = 'no signature';
              return;
            }

            const based58 = base58.encode(bytes);
            this.signedResult = based58;
          }
        } else {
          const session = resp as string;
          const url = `web+flarex://wallet?session=${session}`;
          window.location.href = url;
        }
      },
      error: (err) => console.error(err),
      complete: () => console.log('complete'),
    });
  }

  openWalletBottomSheet() {
    this.bottomSheet
      .open(WalletBottomSheetComponent)
      .afterDismissed()
      .subscribe((wallet: BaseMessageSignerWalletAdapter) => {
        if (wallet == undefined) return;
        this.currentWallet = wallet;

        localStorage.setItem('default_wallet', wallet.name);
      });
  }

  disconnect() {
    if (this.currentWallet == undefined) return;

    this.currentWallet.disconnect()
                      .catch((err) => console.error(err));

    this.currentWallet = undefined;

    localStorage.clear();
  }

  switchRouter(path: string) {
    this.router.navigateByUrl(path);

    if (this.width < 1024) {
      this.drawer?.close();
    }
  }

  isDomain(account: string): boolean {
    if ((account == undefined) || (account == null)) {
      return false;
    }

    return account.endsWith(".sol");
  }

  public get selectedNetwork(): WalletAdapterNetwork {
    return this.solService.network;
  }

  public set selectedNetwork(value: WalletAdapterNetwork) {
    if (value == this.solService.network) return;

    this.solService.connect(value).subscribe({
      next: (version) => 
        console.log(`network: ${value}, version: ${JSON.stringify(version)}`),
      error: (err) => console.error(err),
      complete: () => console.log('complete'),
    });
  }

  public get currentWallet(): BaseMessageSignerWalletAdapter | undefined {
    return this.walletService.currentWallet;
  }

  public set currentWallet(value: BaseMessageSignerWalletAdapter | undefined) {
    this.walletService.currentWallet = value;
  }

  public get connection(): Connection {
    return this.solService.connection;
  }
}
