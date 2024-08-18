import { Component } from '@angular/core';
import { concatMap } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { PublicKey } from '@solana/web3.js';
import { BaseMessageSignerWalletAdapter } from '@solana/wallet-adapter-base';
import { BarcodeFormat } from '@zxing/library';
import { ZXingScannerModule } from '@zxing/ngx-scanner';

import { Prefix } from '@nats-io/nkeys';
import { Codec } from '@nats-io/nkeys/lib/codec';
import { Base64UrlCodec } from 'nats-jwt';

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

  result: string | undefined;
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

    const req = Object.assign(new UserTokenRequest(), JSON.parse(result)) as UserTokenRequest;
    if (!req.isValid()) return;

    this.scanDisabled = true;

    switch (req.type) {
      case 'req_user_token':
        const userPubkey = Codec.encode(Prefix.User, req.publicKey.toBytes());
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
        ).subscribe({
          next: (token) => this.verifyToken(token, req),
          error: (err) => console.error(err),
          complete: () => this.scanDisabled = false,
        });

        return;
    }
  }

  verifyToken(token: string, req: UserTokenRequest) {
    this.flarexService.verifyToken(req.code, req.user, token).subscribe({
      next: (result) => console.log(result),
      error: (err) => console.error(err),
      complete: () => console.log('complete'),
    });
  }

  public get currentWallet(): BaseMessageSignerWalletAdapter | undefined {
    return this.walletService.currentWallet;
  }
}

class UserTokenRequest {
	type: string = "";
	url: string = "";
	code: string = "";
	user: string = "";
	pubkey: string = "";

  isValid(): boolean {
    if (this.type != 'req_user_token')
      return false;

    if ((this.user == '') || (this.pubkey == '')) {
      return false;
    }

    return true;
  }

  get publicKey(): PublicKey {
    return new PublicKey(this.pubkey);
  }
}