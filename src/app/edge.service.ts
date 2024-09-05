import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, filter, from, map, merge, mergeMap, of } from 'rxjs';

import { Empty, Msg, createInbox } from '@nats-io/nats-core';
import { PublicKey } from '@solana/web3.js';

import { NatsService, ServiceIdentity } from './nats.service';

@Injectable({
  providedIn: 'root'
})
export class EdgeService {

  constructor(
    private natsService: NatsService,
  ) { }

  discoverEdgesFromProxy(id: string): Observable<EdgeProxy | undefined> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of(undefined);

    const subject = new BehaviorSubject<EdgeProxy | undefined>(undefined);

    const inbox = createInbox();

    const sub = nc.subscribe(inbox, {
      callback: (err, msg) => {
        if (err != null) {
          subject.error(err);
          subject.complete();
          return;
        }

        if (msg.data.every((value, index) => value === Empty[index])) {
          sub.unsubscribe();
          subject.complete();
          return;
        }

        const raw = JSON.parse(msg.string()) as EdgeProxy;
        const proxy = Object.assign(new EdgeProxy(), raw);

        subject.next(proxy);
      }
    });

    nc.publish(`proxies.${id}.edges.discover`, Empty, { reply: inbox });

    return subject.asObservable();
  }

  addEdge(id: string, edge: EdgeProxy, token: string): Observable<EdgeProxy | undefined> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of(undefined);

    const params = {
      id: edge.id,
      instance: edge.instance,
      token: token,
    }

    const payload = JSON.stringify(params);

    return from(
      nc.request(`proxies.${id}.edges.add`, payload, { timeout: 5000, noMux: true })
    ).pipe(
      map((msg) => {
        const raw = JSON.parse(msg.string()) as EdgeProxy;
        return Object.assign(new EdgeProxy(), raw);
      })
    )
  }

  edge(id: string): Observable<Edge | undefined> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of(undefined);

    return from(
      nc.request(`edges.${id}.info`, Empty, { timeout: 5000, noMux: true })
    ).pipe(
      map((msg) => {
        const raw = JSON.parse(msg.string()) as Edge;
        return Object.assign(new Edge(), raw);
      })
    )
  }

  updateEdge(edge: Edge): Observable<Edge | undefined> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of(undefined);

    const payload = JSON.stringify(edge);

    return from(
      nc.request(`edges.${edge.id}.update`, payload, { timeout: 5000, noMux: true })
    ).pipe(
      map((msg) => {
        const raw = JSON.parse(msg.string()) as Edge;
        return Object.assign(new Edge(), raw);
      })
    )
  }

  networks(id: string): Observable<NetworkInterface[] | undefined> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of(undefined);

    return from(
      nc.request(`edges.${id}.networks`, Empty, { timeout: 5000 })
    ).pipe(
      map((msg) => {
        const rawNetworks = JSON.parse(msg.string()) as NetworkInterface[];

        const networks: NetworkInterface[] = [];
        for (let raw of rawNetworks) {
          let network = Object.assign(new NetworkInterface(), raw);
          networks.push(network);
        }

        return networks;
      })
    )
  }

  discoverEdges(): Observable<Edge> {
    return this.natsService.discoverServices('edge').pipe(
      filter((svc): svc is ServiceIdentity => svc != undefined),
      mergeMap((svc) => {
        const id = svc.metadata['id'] as string;

        return merge(
          this.edge(id).pipe(
            filter((edge): edge is Edge => edge != undefined)
          ),
          this.edgeUpdatedHandler(id),
        );
      })
    )
  }

  edgeAddedHandler(): Observable<Edge> {
    return this.natsService.subscribe(`edges.*.added`).pipe(
      filter((msg): msg is Msg => msg != undefined),
      mergeMap((msg) => {
        const event = JSON.parse(msg.string());
        const raw = event.edge as Edge;
        const edge = Object.assign(new Edge(), raw);

        return merge(
          of(edge),
          this.edgeUpdatedHandler(edge.id),
        );
      })
    )
  }

  edgeUpdatedHandler(id: string): Observable<Edge> {
    return this.natsService.subscribe(`edges.${id}.updated`).pipe(
      filter((msg): msg is Msg => msg != undefined),
      map((msg) => {
        const event = JSON.parse(msg.string());
        const newEdge = event.new_edge as Edge;

        return Object.assign(new Edge(), newEdge);
      })
    )
  }
}

export class Result<T> {
  code: number = 0;
  error: string = '';
  data: T | undefined;
}

export class Edge {
  id: string = '';
  name: string = '';
  tags: string[] = [];
  created_at: Date | undefined;
  updated_at: Date | undefined;
  wallet: string = '';
  token: string = '';

  clone(): Edge {
    const edge = new Edge();
    edge.id = this.id;
    edge.name = this.name;
    edge.tags = this.tags;
    edge.created_at = this.created_at;
    edge.updated_at = this.updated_at;
    edge.wallet = this.wallet;
    edge.token = this.token;

    return edge;
  }

  get publicKey(): PublicKey {
    return new PublicKey(this.wallet);
  }
}

export class EdgeProxy {
  id: string = '';
  instance: string = '';
  error: string = '';
  
  private _edge: Edge | undefined;

  public get edge(): Edge | undefined {
    return this._edge;
  }

  public set edge(value: Edge | undefined) {
    this._edge = Object.assign(new Edge(), value);
  }
}

export class NetworkInterface {
	name: string = '';
	mac: string = '';
	ipv4_addrs: string | null = null;
	ipv6_addrs: string | null = null;
}
