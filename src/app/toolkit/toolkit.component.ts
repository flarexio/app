import { Component } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import * as base58 from 'bs58';

import { WalletService } from '../wallet.service';

@Component({
  selector: 'app-toolkit',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './toolkit.component.html',
  styleUrl: './toolkit.component.scss'
})
export class ToolkitComponent {
  signedResult: string = '';

  constructor(
    private walletService: WalletService,
  ) { }

  async signMessage(message: string) {
    const wallet = this.currentWallet;
    if (wallet == undefined) {
      console.error('no wallet');
      return;
    }

    const msg = Buffer.from(message, 'utf-8');
    const sig = await wallet.signMessage(msg);

    this.signedResult = base58.encode(sig);
  }

  private get currentWallet() {
    return this.walletService.currentWallet;
  }
}
