import { Component } from '@angular/core';
import { concatMap } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { BarcodeFormat } from '@zxing/library';
import { ZXingScannerModule } from '@zxing/ngx-scanner';

import { Prefix } from '@nats-io/nkeys';
import { Codec } from '@nats-io/nkeys/lib/codec';
import { Base64UrlCodec } from '@nats-io/jwt';
import { PublicKey } from '@solana/web3.js';
import { BaseMessageSignerWalletAdapter } from '@solana/wallet-adapter-base';

import { FlarexService } from '../flarex.service';
import { NatsService } from '../nats.service';
import { WalletService } from '../wallet.service';

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    ZXingScannerModule,
  ],
  templateUrl: './scanner.component.html',
  styleUrl: './scanner.component.scss'
})
export class ScannerComponent {
  allowedFormats = [ BarcodeFormat.QR_CODE ];
  availableDevices: MediaDeviceInfo[] = new Array();
  currentDevice: MediaDeviceInfo | undefined;
  scanDisabled: boolean = false;
  
  constructor(
    private flarexService: FlarexService,
    private natsService: NatsService,
    private walletService: WalletService,
  ) { }

  camerasFoundHandler(devices: MediaDeviceInfo[]) {
    this.availableDevices = devices;
  }

  scanSuccessHandler(result: string) {
    if (this.scanDisabled) return;

    const currentWallet = this.currentWallet;
    if (currentWallet == undefined) return;

    const pubkey = currentWallet.publicKey;
    if (pubkey == null) return;

    const req = JSON.parse(result) as UserTokenRequest;
    if (!isValid(req)) return;

    this.scanDisabled = true;

    switch (req.type) {
      case 'req_user_token':
        const userPubkey = Codec.encode(Prefix.User, publicKey(req).toBytes());
        const accountPubkey = Codec.encode(Prefix.Account, pubkey.toBytes());
        const decoder = new TextDecoder();

        this.natsService.generateUserJWT(req.user, 
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
          concatMap((token) => this.flarexService.verifyToken(req.code, req.user, token)),
        ).subscribe({
          next: (result) => console.log(result),
          error: (err) => console.error(err),
          complete: () => this.scanDisabled = false,
        });

        return;
    }
  }

  public get currentWallet(): BaseMessageSignerWalletAdapter | undefined {
    return this.walletService.currentWallet;
  }
}

interface UserTokenRequest {
	type: string;
	url: string;
	code: string;
	user: string;
	pubkey: string;
  token?: string;
}

function isValid(req: UserTokenRequest): boolean {
  if (req.type != 'req_user_token')
    return false;

  if ((req.user == '') || (req.pubkey == '')) {
    return false;
  }

  return true;
}

function publicKey(req: UserTokenRequest): PublicKey {
  return new PublicKey(req.pubkey);
}
