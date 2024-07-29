import { Component } from '@angular/core';

import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar } from '@angular/material/snack-bar';

import { BaseMessageSignerWalletAdapter, WalletConnectionError } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';

@Component({
  selector: 'app-wallet-bottom-sheet',
  standalone: true,
  imports: [
    MatListModule,
  ],
  templateUrl: './wallet-bottom-sheet.component.html',
  styleUrl: './wallet-bottom-sheet.component.scss'
})
export class WalletBottomSheetComponent {
  wallets: BaseMessageSignerWalletAdapter[] = [
    new PhantomWalletAdapter,
    new SolflareWalletAdapter,
  ];

  constructor(
    private bottomSheetRef: MatBottomSheetRef<WalletBottomSheetComponent>,
    private snackBar: MatSnackBar,
  ) { }

  connectWallet(wallet: BaseMessageSignerWalletAdapter) {
    wallet.connect()
          .then(() => this.bottomSheetRef.dismiss(wallet))
          .catch((err: WalletConnectionError) => 
            this.snackBar.open(err.error, 'OK')
          )
  }
}
