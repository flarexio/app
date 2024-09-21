import { Component } from '@angular/core';
import { concatMap, filter, from, interval, map, take, switchMap } from 'rxjs';

import { Empty, MsgHdrsImpl, NatsConnection, createInbox } from '@nats-io/nats-core';

import { NatsService } from '../nats.service';

@Component({
  selector: 'app-surveillance',
  standalone: true,
  imports: [],
  templateUrl: './surveillance.component.html',
  styleUrl: './surveillance.component.scss'
})
export class SurveillanceComponent {
  constructor(
    private natsService: NatsService,
  ) {
    this.natsService.connectionChange.pipe(
      filter((nc): nc is NatsConnection => nc != undefined),
      switchMap((nc) => from(this.makePeer(nc))),
      concatMap((channel) => interval(10).pipe(
        take(1000),
        filter(() => channel.readyState == 'open'),
        map((n) => channel.send(n.toString())),
      ))
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

    peer.onicecandidate = (event) => {
      const candidate = event.candidate;
      if (candidate == null) return;

      const payload = JSON.stringify(candidate);
      nc.publish(`${inbox}.candidates.caller`, payload);
    };

    const channel = peer.createDataChannel('sendDataChannel');
    channel.onopen = (_) => console.log('channel opened');
    channel.onclose = (_) => console.log('channel closed');

    try {
      const offer = await peer.createOffer();
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

    return channel;
  }
}
