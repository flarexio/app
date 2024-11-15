import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, concatMap, map } from 'rxjs';

import { 
  CredentialCreationOptionsJSON, CredentialRequestOptionsJSON, 
  create, get, 
} from "@github/webauthn-json";

import { environment as env } from '../environments/environment';

import { Connection, PublicKey, Transaction, TransactionSignature, VersionedTransaction } from '@solana/web3.js';
import { 
  BaseMessageSignerWalletAdapter, SendTransactionOptions, SupportedTransactionVersions, 
  TransactionOrVersionedTransaction, WalletConnectionError, 
} from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private baseURL = env.FLAREX_WALLET_BASEURL;

  private _currentWallet: BaseMessageSignerWalletAdapter | undefined;
  private _walletChangeSubject = new BehaviorSubject<PublicKey | null>(null);

  walletChange = this._walletChangeSubject.asObservable();

  wallets: BaseMessageSignerWalletAdapter[] = [
    new PhantomWalletAdapter,
    new SolflareWalletAdapter,
  ];

  constructor(
    private http: HttpClient,
  ) { }

  registerPasskey(user_id: string, username: string): Observable<string> {
    return this.http.post(`${this.baseURL}/passkeys/registration/initialize`, { user_id, username }).pipe(
      concatMap((opts) => create(opts as CredentialCreationOptionsJSON)),
      concatMap((credential) => this.http.post(`${this.baseURL}/passkeys/registration/finalize`, credential)),
      map((token) => token as string),
    );
  }

  loginWithPasskey(user_id: string): Observable<string> {
    return this.http.post(`${this.baseURL}/passkeys/login/initialize`, { user_id }).pipe(
      concatMap((opts) => get(opts as CredentialRequestOptionsJSON)),
      concatMap((credential) => this.http.post(`${this.baseURL}/passkeys/login/finalize`, credential)),
      map((token) => token as string),
    );
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
