import { animate, state, style, transition, trigger } from '@angular/animations';
import { AsyncPipe, SlicePipe } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, concatMap, filter, map, merge, scan, switchMap } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule, MatTable } from '@angular/material/table';

import * as anchor from '@coral-xyz/anchor';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { createUser } from '@nats-io/nkeys';
import { Prefix } from '@nats-io/nkeys';
import { Codec } from '@nats-io/nkeys/lib/codec';
import { Base64UrlCodec } from '@nats-io/jwt';
import { PublicKey } from '@solana/web3.js';

import { Flarex } from '../model/flarex';
import IDL from '../model/flarex.json';
import { EdgeService, EdgeProxy, Edge } from '../edge.service';
import { NatsService, ServiceIdentity } from '../nats.service';
import { SolanaService } from '../solana.service';
import { WalletService } from '../wallet.service';
import { ChangeEdgeDialogComponent } from './change-edge-dialog/change-edge-dialog.component';
import { NetworkDialogComponent } from './network-dialog/network-dialog.component';
import { TransactionSnackbarComponent } from '../transaction-snackbar/transaction-snackbar.component';

@Component({
  selector: 'app-edge',
  standalone: true,
  imports: [
    AsyncPipe,
    SlicePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
  ],
  templateUrl: './edge.component.html',
  styleUrl: './edge.component.scss',
  animations:  [
    trigger('detailExpand', [
      state('collapsed,void', style({height: '0px', minHeight: '0'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ]
})
export class EdgeComponent {
  edgeProxies: Observable<ServiceIdentity[] | undefined>;
  selectedProxy: ServiceIdentity | undefined;

  edges: Observable<Edge[] | undefined>;

  displayedColumns: string[] = [ 'instance', 'expand' ];
  discoveredEdges: EdgeProxy[] = [];
  expandedEdge: EdgeProxy | null = null;
  loading: boolean = false;

  @ViewChild(MatTable) table: MatTable<EdgeProxy> | undefined;

  constructor(
    private edgeService: EdgeService,
    private natsService: NatsService,
    private solService: SolanaService,
    private walletService: WalletService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {
    this.edgeProxies = this.natsService.connectionChange.pipe(
      filter((nc) => nc != undefined),
      switchMap((_) => this.natsService.discoverServices('edge-proxy')),
      filter((svc): svc is ServiceIdentity  => svc != undefined), 
      scan((acc, curr) => [ ...acc, curr ], new Array<ServiceIdentity>()),
    );

    this.edges = this.natsService.connectionChange.pipe(
      takeUntilDestroyed(),
      filter((nc) => nc != undefined),
      switchMap((_) => merge(
        this.edgeService.discoverEdges(),
        this.edgeService.edgeAddedHandler(),
      )),
      scan((acc, curr) => {
        const index = acc.findIndex((edge) => edge.id === curr.id);

        if (index > -1) {
          acc[index] = curr;
        } else {
          acc.push(curr);
        }

        return acc;
      }, new Array<Edge>()),
      map((edges) => edges.sort((a, b) => (a.id > b.id) ? 1 : -1)),
    );
  }

  async pushAccount() {
    const connection = this.solService.connection;

    if (this.walletService.currentWallet == undefined) {
      return;
    }

    const wallet = this.walletService.asAnchorWallet();

    const provider = new AnchorProvider(connection, wallet)

    const idl = IDL as Flarex;
    const program = new Program<Flarex>(idl, provider);

    const [ natsPDA ] = PublicKey.findProgramAddressSync([
      anchor.utils.bytes.utf8.encode('nats'), 
      wallet.publicKey.toBuffer(), 
      Uint8Array.of(2),
    ], program.programId);

    const tx = await program.methods
      .setupNatsAccount()
      .accounts({
        authority: wallet.publicKey,
        account: natsPDA,
      })
      .rpc();

    this.snackBar.openFromComponent(TransactionSnackbarComponent, {
      data: {
        signature: tx,
        network: this.solService.network,
        action: () => {},
      }
    })
  }

  signUserJWT() {
    const currentWallet = this.walletService.currentWallet;
    if (currentWallet == undefined) return;

    const pubkey = currentWallet.publicKey;
    if (pubkey == null) return;

    const accountPubkey = Codec.encode(Prefix.Account, pubkey.toBytes());
    const user = createUser();

    const decoder = new TextDecoder();

    this.natsService.generateUserJWT('main', 
      user.getPublicKey(),
      decoder.decode(accountPubkey),
    ).pipe(
      concatMap(async (token) => {
        const encoder = new TextEncoder();
        const tokenBytes = encoder.encode(token);

        const sigBytes = await currentWallet.signMessage(tokenBytes);
        if (sigBytes == undefined) return "invalid sigurature";

        const sig = Base64UrlCodec.encode(sigBytes);
        return `${token}.${sig}`;
      }),
      concatMap((token) => {
        const decoder = new TextDecoder();
        const seedBytes = user.getSeed();
        const seed = decoder.decode(seedBytes);

        localStorage.setItem('nats_jwt', token);
        localStorage.setItem('nats_seed', seed);

        return this.natsService.connect(token, seedBytes);
      })
    ).subscribe({
      next: (nc) => this.natsService.nc = nc,
      error: (err) => console.error(err),
      complete: () => console.log('complete'),
    });
  }

  discoverEdgesFromProxy() {
    const selectedProxy = this.selectedProxy;
    if (selectedProxy == undefined) return;

    this.discoveredEdges = [];

    this.loading = true;

    this.edgeService.discoverEdgesFromProxy(selectedProxy.metadata['id']).pipe(
      filter((edge): edge is EdgeProxy => edge != undefined),
    ).subscribe({
      next: (edge) => {
        this.discoveredEdges.push(edge);
        this.discoveredEdges.sort((a, b) => (a.id > b.id) ? 1 : -1 );

        this.table?.renderRows();
      },
      error: (err) => console.error(err),
      complete: () => this.loading = false,
    });
  }

  addEdge(edgeProxy: EdgeProxy) {
    const selectedProxy = this.selectedProxy;
    if (selectedProxy == undefined) return;

    const currentWallet = this.walletService.currentWallet;
    if (currentWallet == undefined) return;

    const pubkey = currentWallet.publicKey;
    if (pubkey == null) return;

    const edge = edgeProxy.edge;
    if (edge == undefined) return;

    const accountPubkey = Codec.encode(Prefix.Account, pubkey.toBytes());
    const userPubkey = Codec.encode(Prefix.User, edge.publicKey.toBytes());
    const decoder = new TextDecoder();

    this.natsService.generateUserJWT(edge.id, 
      decoder.decode(userPubkey),
      decoder.decode(accountPubkey),
    ).pipe(
      concatMap(async (token) => {
        const encoder = new TextEncoder();
        const tokenBytes = encoder.encode(token);

        const sigBytes = await currentWallet.signMessage(tokenBytes);
        if (sigBytes == undefined) return "invalid sigurature";

        const sig = Base64UrlCodec.encode(sigBytes);
        return `${token}.${sig}`;
      }),
      concatMap((token) => this.edgeService.addEdge(selectedProxy.metadata['id'], edgeProxy, token))
    ).subscribe({
      next: (edge) => console.log(edge),
      error: (err: Error) => console.error(err.message),
      complete: () => console.log('complete'),
    })
  }

  openChangeEdgeDialog(edge: Edge) {
    this.dialog.open(ChangeEdgeDialogComponent, {
      data: { edge: edge }
    });
  }

  openNetworksDialog(edge: Edge) {
    this.dialog.open(NetworkDialogComponent, {
      data: { edge: edge }
    });
  }

  public get isNatsConnected(): boolean {
    return this.natsService.isConnected;
  }
}
