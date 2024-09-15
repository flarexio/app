import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, from, map, of } from 'rxjs';

import { Connection, PublicKey, Version, TransactionConfirmationStrategy, TransactionSignature, RpcResponseAndContext, SignatureResult, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { getFavoriteDomain } from '@bonfida/spl-name-service';

import { environment as env } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SolanaService {
  private _network = WalletAdapterNetwork.Devnet;
  private _connection: Connection;
  private _connectionChangeSubject = new BehaviorSubject<Connection | null>(null);

  connectionChange = this._connectionChangeSubject.asObservable();

  constructor() {
    let endpoint = clusterApiUrl(this.network);
    if (this.network == WalletAdapterNetwork.Mainnet) {
      endpoint = env.SOLANA_MAINNET_ENDPOINT;
    }

    this._connection = new Connection(endpoint, 'confirmed');
  }

  connect(network: WalletAdapterNetwork): Observable<Version> {
    let endpoint = clusterApiUrl(network);
    if (network == WalletAdapterNetwork.Mainnet) {
      endpoint = env.SOLANA_MAINNET_ENDPOINT;
    }

    this.network = network;
    this.connection = new Connection(endpoint, 'confirmed');

    return this.getVersion();
  }

  getVersion(): Observable<Version> {
    return from(this.connection.getVersion());
  }

  getAccount(pubkey: PublicKey | null): Observable<string | undefined> {
    if (pubkey == null) return of(undefined);

    return from(
      getFavoriteDomain(this.connection, pubkey),
    ).pipe(
      map(({ reverse }) => reverse + ".sol"),
      catchError(() => of(pubkey.toBase58())),
    );
  }

  getBalance(pubkey: PublicKey | null): Observable<number | undefined> {
    if (pubkey == null) return of(undefined);

    return from(
      this.connection.getBalance(pubkey),
    ).pipe(
      map((balance) => balance / LAMPORTS_PER_SOL),
    );
  }

  confirmTransaction(transaction: TransactionConfirmationStrategy | TransactionSignature): Observable<{}> {
    let observable: Observable<RpcResponseAndContext<SignatureResult>>;

    if (typeof transaction == 'string') {
      const signature: TransactionSignature = transaction;
      observable = from(this.connection.confirmTransaction(signature));
    } else {
      const strategy = transaction;
      observable = from(this.connection.confirmTransaction(strategy));
    }

    return observable.pipe(
      map((result) => {
        const err = result.value.err;
        if ((err != null) && (typeof err == 'string')) {
          throw new Error(err)
        }

        return {};
      })
    );
  }

  public get network(): WalletAdapterNetwork {
    return this._network;
  }

  public set network(value: WalletAdapterNetwork) {
    this._network = value;
  }

  public get connection(): Connection {
    return this._connection;
  }

  public set connection(value: Connection) {
    this._connection = value;

    this._connectionChangeSubject.next(value);
  }
}
