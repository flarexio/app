import { Component, ElementRef, ViewChild } from '@angular/core';
import { filter, from, switchMap } from 'rxjs';

import { MatCardModule } from '@angular/material/card';

import { Empty, MsgHdrsImpl, NatsConnection, createInbox } from '@nats-io/nats-core';

import { NatsService } from '../nats.service';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [
    MatCardModule,
  ],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss'
})
export class GameComponent {
  @ViewChild('remoteVideo')
  remoteVideo!: ElementRef<HTMLVideoElement>;

  constructor(
    private natsService: NatsService,
  ) {
    this.natsService.connectionChange.pipe(
      filter((nc): nc is NatsConnection => nc != undefined),
      switchMap((nc) => from(this.makePeer(nc))),
    ).subscribe({
      error: (err) => console.error(err),
      complete: () => console.log('complete'),
    })
  }

  async makePeer(nc: NatsConnection) {
    const headers = new MsgHdrsImpl();
    headers.set("provider", "google")

    const msg = await nc.request("peers.iceservers", Empty, { headers, timeout: 5000, noMux: true });
    const iceServers = JSON.parse(msg.string()) as RTCIceServer[];

    const peer = new RTCPeerConnection({ iceServers });

    const inbox = createInbox(`peers.negotiation`);
    nc.subscribe(`${inbox}.candidates.callee`, {
      callback: async (err, msg) => {
        if (err) {
          console.error(err);
          return;
        }

        const candidate = JSON.parse(msg.string()) as RTCIceCandidate;
        await peer.addIceCandidate(candidate);

        console.log(`added candidate: ${msg.string()}`);
      }
    });

    peer.addEventListener('connectionstatechange', (_) => {
      console.log(`connection state changed: ${peer.connectionState}`);
    });

    peer.addEventListener('icecandidate', (event) => {
      const candidate = event.candidate;
      if (candidate == null) return;

      const payload = JSON.stringify(candidate);
      nc.publish(`${inbox}.candidates.caller`, payload);
    });

    peer.addEventListener('track', async (event) => {
      console.log(event);

      const stream = event.streams[0];
      this.remoteVideo.nativeElement.srcObject = stream;
    });

    peer.addTransceiver('video', { direction: 'recvonly' });
    peer.addTransceiver('audio', { direction: 'recvonly' });

    // const channel = peer.createDataChannel('stream');
    // channel.addEventListener('open', async (_) => {
    //   console.log('channel opened');

    //   // const msg = await nc.request("stream.origins", Empty, { timeout: 5000, noMux: true });
    //   // const origins = JSON.parse(msg.string()) as number[];

    //   // const buf = new ArrayBuffer(4);
    //   // const view = new DataView(buf);
    //   // view.setUint32(0, origins[0]);

    //   // channel.send(buf);

    //   channel.send('play');
    // });

    // channel.addEventListener('close', (_) => console.log('channel closed'));

    try {
      const offerOpts: RTCOfferOptions = {
        iceRestart: true,
        offerToReceiveVideo: true,
        offerToReceiveAudio: true,
      };

      const offer = await peer.createOffer(offerOpts);
      console.log('Offer from peerConnection');
      console.log(offer.sdp);

      const payload = JSON.stringify(offer);
      const response = await nc.request(`peers.negotiation`, payload, { 
        reply: `${inbox}.sdp.answer`,
        timeout: 5000, 
        noMux: true, 
      })

      const answer = JSON.parse(response.string()) as RTCSessionDescriptionInit;
      console.log('Answer from remoteConnection');
      console.log(answer.sdp);

      await peer.setLocalDescription(offer);
      await peer.setRemoteDescription(answer);
    } catch (err) {
      console.error(err);
    }
  }
}
