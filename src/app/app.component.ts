import { AsyncPipe, CurrencyPipe, SlicePipe } from '@angular/common'
import { Component, HostListener, ViewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Observable, concatAll, map, share } from 'rxjs';

import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Connection } from '@solana/web3.js';
import { BaseMessageSignerWalletAdapter, WalletAdapterNetwork } from '@solana/wallet-adapter-base';

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
  title = 'FlareX';
  width = window.innerWidth;

  networks = Object.entries(WalletAdapterNetwork)
                   .map(([ key, value ]) => ({ key, value }));

  getAccount: Observable<string | undefined>;
  getBalance: Observable<number | undefined>;

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
      map((pubkey) => this.solService.getAccount(pubkey)),
      concatAll(),
    );

    this.getBalance = this.walletService.walletChange.pipe(
      map((pubkey) => this.solService.getBalance(pubkey)),
      concatAll(),
      share(),
    );
  }

  @HostListener('window:resize', ['$event'])
  windowResizeHandler() {
    this.width = window.innerWidth;
  }

  openWalletBottomSheet() {
    this.bottomSheet
      .open(WalletBottomSheetComponent)
      .afterDismissed()
      .subscribe((wallet) => 
        this.currentWallet = wallet
      );
  }

  disconnect() {
    if (this.currentWallet == undefined) return;

    this.currentWallet.disconnect();
    this.currentWallet = undefined;
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
