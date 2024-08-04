import { Component } from '@angular/core';
import { concatAll, from, map } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { PublicKey } from '@solana/web3.js';
import { BaseMessageSignerWalletAdapter } from '@solana/wallet-adapter-base';
import { BarcodeFormat } from '@zxing/library';
import { ZXingScannerModule } from '@zxing/ngx-scanner';

import { Prefix } from 'nkeys.js';
import { Codec } from 'nkeys.js/lib/codec';
import { base32 } from 'nkeys.js/lib/base32';
import { Algorithms, Base64UrlCodec, Types, User, randomID } from 'nats-jwt';
import * as jwt from 'nats-jwt';

import { FlarexService } from '../flarex.service';
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
        from(
          this.signNATSUserJWT(req.id, req.pubkey, pubkey.toBase58())
        ).pipe(
          map(async (payload) => {
            const encoder = new TextEncoder();
            const tokenBytes = encoder.encode(payload);

            const sigBytes = await this.currentWallet?.signMessage(tokenBytes);
            if (sigBytes == undefined) return "";

            const sig = Base64UrlCodec.encode(sigBytes);
            return `${payload}.${sig}`;
          }),
          concatAll(),
        ).subscribe({
          next: (token) => this.verifyNATSUserToken(token, req),
          error: (err) => console.error(err),
          complete: () => this.scanDisabled = false,
        });

        return;
    }
  }

  verifyNATSUserToken(token: string, req: UserTokenRequest) {
    this.flarexService.verifyNATSUserToken(req.code, req.id, token).subscribe({
      next: (result) => console.log(result),
      error: (err) => console.error(err),
      complete: () => console.log('complete'),
    });
  }

  async signNATSUserJWT(id: string, user: string, account: string): Promise<string> {
    const accountPubkey = Codec.encode(
      Prefix.Account, 
      new PublicKey(account).toBytes(),
    );

    const userPubkey = Codec.encode(
      Prefix.User, 
      new PublicKey(user).toBytes(),
    );

    const decoder = new TextDecoder();
    const claims: jwt.ClaimsData<User> = {
      name: id,
      aud: 'NATS',
      jti: '',
      iat: Math.floor(Date.now() / 1000),
      iss: decoder.decode(accountPubkey),
      sub: decoder.decode(userPubkey),
      nats: {
        subs: -1,
        data: -1,
        payload: -1,
        type: Types.User,
        version: 2,
      },
    };

    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(claims));
    if (globalThis.crypto && globalThis.crypto.subtle) {
      const hash = await globalThis.crypto.subtle.digest("SHA-256", data);
      const encoded = base32.encode(new Uint8Array(hash));
      claims.jti = decoder.decode(encoded);
    } else {
      claims.jti = randomID();
    }

    const h = {
      typ: "JWT",
      alg: Algorithms.v2,
    };

    const header = Base64UrlCodec.encode(JSON.stringify(h));
    const payload = Base64UrlCodec.encode(JSON.stringify(claims));

    return `${header}.${payload}`;
  }

  public get currentWallet(): BaseMessageSignerWalletAdapter | undefined {
    return this.walletService.currentWallet;
  }
}

class UserTokenRequest {
	type: string = "";
	url: string = "";
	code: string = "";
	id: string = "";
	pubkey: string = "";

  isValid(): boolean {
    if (this.type != 'req_user_token')
      return false;

    if ((this.id == '') || (this.pubkey == '')) {
      return false;
    }

    return true;
  }
}