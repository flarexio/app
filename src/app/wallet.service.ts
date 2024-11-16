import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { WalletMessage, WalletMessageResponse } from '@flarex/wallet-adapter';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { Connection, PublicKey, Transaction, TransactionSignature, VersionedTransaction } from '@solana/web3.js';
import { 
  BaseMessageSignerWalletAdapter, SendTransactionOptions, SupportedTransactionVersions, 
  TransactionOrVersionedTransaction, WalletConnectionError, 
} from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';

import { environment as env } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private baseURL = env.FLAREX_WALLET_BASEURL + '/wallet/v1';

  private _currentWallet: BaseMessageSignerWalletAdapter | undefined;
  private _walletChangeSubject = new BehaviorSubject<PublicKey | null>(null);

  walletChange = this._walletChangeSubject.asObservable();

  wallets: BaseMessageSignerWalletAdapter[] = [
    new PhantomWalletAdapter,
    new SolflareWalletAdapter,
  ];

  createSession(msg: WalletMessage): Observable<string | WalletMessageResponse> {
    return new Observable((subscriber) => {
      const ctrl = new AbortController();

      const bytes = msg.serialize();
      const data = Buffer.from(bytes).toString('base64');

      fetchEventSource(`${this.baseURL}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data }),
        signal: ctrl.signal,
        openWhenHidden: true,

        onmessage: (event) => {
          switch (event.event) {
            case 'session':
              subscriber.next(event.data);
              return;

            case 'data':
              const data = Buffer.from(event.data, 'base64').toString('utf8');
              const resp = WalletMessageResponse.deserialize(data);

              subscriber.next(resp);
              subscriber.complete();
              return;

            case 'fail':
              subscriber.error(event.data);
              return;
          }
        },
        onerror: (err) => {
          subscriber.error(err);
        },
        onclose: () => {
          subscriber.error('session closed');
        },
      });

      return () => {
        ctrl.abort();
        console.log('aborted');
      };
    });
  }

  public autoConnect(name: string) {
    for (let wallet of this.wallets) {
      if (wallet.name != name) {
        continue;
      }

      wallet.autoConnect()
            .then(() => this.currentWallet = wallet)
            .catch((err: WalletConnectionError) => 
              console.error(err.error)
            );
    }
  }

  public refreshWallet(pubkey: PublicKey) {
    this._walletChangeSubject.next(pubkey);
  }

  public asAnchorWallet(): AnchorWalletWrapper {
    const wallet = this.currentWallet;
    if (wallet == undefined) {
      throw new Error(`wallet not found`);
    }

    return new AnchorWalletWrapper(wallet);
  }

  public get currentWallet(): BaseMessageSignerWalletAdapter | undefined {
    return this._currentWallet;
  }

  public set currentWallet(value: BaseMessageSignerWalletAdapter | undefined) {
    if (this._currentWallet != undefined) {
      this._currentWallet.removeAllListeners();
      this._currentWallet = undefined;
    }

    this._currentWallet = value;

    const wallet = value;
    if (wallet == undefined) return;

    const pubkey = wallet.publicKey;
    if (pubkey == null) return;

    wallet.addListener('connect', 
      (pubkey) => this.refreshWallet(pubkey)
    );

    this.refreshWallet(pubkey);
  }
}

export class AnchorWalletWrapper {
  private _wallet: BaseMessageSignerWalletAdapter;

  constructor(origin: BaseMessageSignerWalletAdapter) {
    this._wallet = origin;
  }

  public signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    return this._wallet.signTransaction(tx);
  }

  public signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return this._wallet.signAllTransactions(txs);
  }

  public async sendTransaction(
    transaction: TransactionOrVersionedTransaction<SupportedTransactionVersions>,
    connection: Connection,
    options: SendTransactionOptions = {}
  ): Promise<TransactionSignature> {
    return this._wallet.sendTransaction(transaction, connection, options);
  }

  public get publicKey(): PublicKey {
    const pubkey = this._wallet.publicKey;
    if (pubkey == null) {
      throw new Error(`invalid pubkey`);
    }

    return pubkey;
  }
}
