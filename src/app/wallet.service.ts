import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { PublicKey } from '@solana/web3.js';
import { BaseMessageSignerWalletAdapter } from '@solana/wallet-adapter-base';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private _currentWallet: BaseMessageSignerWalletAdapter | undefined;
  private _walletChangeSubject = new BehaviorSubject<PublicKey | null>(null);

  walletChange = this._walletChangeSubject.asObservable();

  constructor() { }

  public refreshWallet(pubkey: PublicKey) {
    this._walletChangeSubject.next(pubkey);
  }

  public get currentWallet(): BaseMessageSignerWalletAdapter | undefined {
    return this._currentWallet;
  }

  public set currentWallet(value: BaseMessageSignerWalletAdapter | undefined) {
    const wallet = value;
    if (wallet == undefined) return;

    const pubkey = wallet.publicKey;
    if (pubkey == null) return;

    if (this._currentWallet != undefined) {
      this._currentWallet.removeAllListeners();
      this._currentWallet = undefined;
    }

    this._currentWallet = wallet;

    wallet.addListener('connect', 
      (pubkey) => this.refreshWallet(pubkey)
    );

    this.refreshWallet(pubkey);
  }
}
