import { AsyncPipe } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { Observable, filter, from, interval, map, of, switchMap } from 'rxjs';

import { MatCardModule } from '@angular/material/card';

import { Empty, MsgHdrsImpl, NatsConnection, createInbox } from '@nats-io/nats-core';

import { NatsService } from '../nats.service';
import { xboxButtonMap, XBoxReport } from './gamepad';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [
    AsyncPipe,
    MatCardModule,
  ],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss'
})
export class GameComponent {
  // @ViewChild('remoteVideo')
  // remoteVideo!: ElementRef<HTMLVideoElement>;

  // @ViewChild('remoteAudio')
  // remoteAudio!: ElementRef<HTMLAudioElement>;

  videoStream: MediaStream = new MediaStream();
  audioStream: MediaStream = new MediaStream();
  gamepadChannel: RTCDataChannel | undefined;

  rtt: Observable<number> = of(0);

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

  @HostListener('window:gamepadconnected', ['$event'])
  gamepadConnectedHandler($event: GamepadEvent) {
    console.log(
      "Gamepad connected at index %d: %s. %d buttons, %d axes.",
      $event.gamepad.index,
      $event.gamepad.id,
      $event.gamepad.buttons.length,
      $event.gamepad.axes.length,
    );

    this.pollGamepad(0, 0);
  }

  pollGamepad(index: number, last: number) {
    const gamepad = navigator.getGamepads()[index];
    if (gamepad == null) return;

    if (gamepad.timestamp > last) {
      const report = new XBoxReport();

      const buttons = gamepad.buttons;
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        if (i == 6) {
          report.leftTrigger = Math.round(button.value * 255);
        } else if (i == 7) {
          report.rightTrigger = Math.round(button.value * 255);
        } else {
          if (button.pressed) {
            report.buttons |= xboxButtonMap[i]
          }
        }
      }

      const axes = gamepad.axes;
      report.leftThumbStickX = Math.round(axes[0] * 32767);
      report.leftThumbStickY = Math.round(axes[1] * -32767);
      report.rightThumbStickX = Math.round(axes[2] * 32767);
      report.rightThumbStickY = Math.round(axes[3] * -32767);

      if (this.gamepadChannel != undefined) {
        const data = report.toBuffer();

        this.gamepadChannel.send(data);
      }
    }

    requestAnimationFrame(() => this.pollGamepad(index, gamepad.timestamp));
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

    this.rtt = interval(1000).pipe(
      switchMap(() => from(peer.getStats()).pipe(
        map((stat) => {
          let report: any = undefined;
          stat.forEach((value, key, parent) => {
            if (value.type === 'candidate-pair' && value.state === 'succeeded') {
              report = value;
            }
          });

          return report;
        }),
        filter((report) => report != undefined),
        map((report) => report.currentRoundTripTime * 1000)
      ))
    )

    peer.addEventListener('icecandidate', (event) => {
      const candidate = event.candidate;
      if (candidate == null) return;

      const payload = JSON.stringify(candidate);
      nc.publish(`${inbox}.candidates.caller`, payload);
    });

    peer.addEventListener('track', async (event) => {
      switch (event.track.kind) {
        case 'video':
          this.videoStream.addTrack(event.track);
          console.log('added video track');
          return;

        case 'audio':
          this.audioStream.addTrack(event.track);
          console.log('added audio track');
          return;
      }
    });

    peer.addTransceiver('video', { direction: 'recvonly', streams: [ this.videoStream ] });
    peer.addTransceiver('audio', { direction: 'recvonly', streams: [ this.audioStream ] });

    this.gamepadChannel = peer.createDataChannel('gamepad');
    this.gamepadChannel.addEventListener('open', (_) => console.log('gamepad channel opened'));
    this.gamepadChannel.addEventListener('close', (_) => console.log('gamepad channel closed'));

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
  }
}
