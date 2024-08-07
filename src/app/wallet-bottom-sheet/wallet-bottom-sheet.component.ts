import { Component } from '@angular/core';

import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar } from '@angular/material/snack-bar';

import { BaseMessageSignerWalletAdapter, WalletConnectionError } from '@solana/wallet-adapter-base';

import { WalletService } from '../wallet.service';

@Component({
  selector: 'app-wallet-bottom-sheet',
  standalone: true,
  imports: [
    MatChipsModule,
    MatIconModule,
    MatListModule,
  ],
  templateUrl: './wallet-bottom-sheet.component.html',
  styleUrl: './wallet-bottom-sheet.component.scss'
})
export class WalletBottomSheetComponent {
  defaultWallet: string | null;

  constructor(
    private bottomSheetRef: MatBottomSheetRef<WalletBottomSheetComponent>,
    private snackBar: MatSnackBar,
    private walletService: WalletService,
  ) {
    this.defaultWallet = localStorage.getItem('default_wallet');
  }

  connectWallet(wallet: BaseMessageSignerWalletAdapter) {
    wallet.connect()
          .then(() => this.bottomSheetRef.dismiss(wallet))
          .catch((err: WalletConnectionError) => 
            this.snackBar.open(err.error, 'OK')
          )
  }

  public get wallets(): BaseMessageSignerWalletAdapter[] {
    return this.walletService.wallets;
  }
}
