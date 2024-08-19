import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, map, mergeMap, of } from 'rxjs';

import { Empty, createInbox } from '@nats-io/nats-core';

import { NatsService } from './nats.service';

@Injectable({
  providedIn: 'root'
})
export class EdgeService {

  constructor(
    private natsService: NatsService,
  ) { }

  discoverEdges(): Observable<EdgeProxy | undefined> {
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

    nc.publish('discover.edges', Empty, { reply: inbox });

    return subject.asObservable();
  }

  addEdge(edge: EdgeProxy): Observable<EdgeProxy | undefined> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of(undefined);

    const params = {
      id: edge.id,
      instance: edge.instance,
    }

    const payload = JSON.stringify(params);

    return from(
      nc.request('edges.add', payload, { timeout: 5000 })
    ).pipe(
      map((msg) => {
        const raw = JSON.parse(msg.string());
        const result = Object.assign(new Result(), raw) as Result<EdgeProxy>;

        if ((result.code != 200) || (result.data == undefined)) {
          throw new Error(result.error);
        }

        return Object.assign(new EdgeProxy(), result.data);
      })
    )
  }

  listEdges(): Observable<EdgeProxy[] | undefined> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of(undefined);

    return from(
      nc.request('edges', Empty, { timeout: 5000 })
    ).pipe(
      map((msg) => {
        const raw = JSON.parse(msg.string()) as Result<EdgeProxy[]>;
        const result = Object.assign(new Result(), raw);

        if ((result.code != 200) || (result.data == undefined)) {
          throw new Error(result.error);
        }

        const proxies: EdgeProxy[] = [];
        for (let raw of result.data) {
          let proxy = Object.assign(new EdgeProxy(), raw);
          proxies.push(proxy);
        }

        return proxies;
      })
    )
  }

  subEdges(): Observable<EdgeProxy[] | undefined> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of(undefined);

    return from(
      nc.subscribe('edges.>')
    ).pipe(
      mergeMap((_) => this.listEdges())
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
}

export class EdgeProxy {
  id: string = '';
  instance: string = '';
  error: string = '';
  edge: Edge | undefined;
}
