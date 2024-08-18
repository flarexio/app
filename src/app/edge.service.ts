import { Injectable } from '@angular/core';
import { Observable, from, map, of } from 'rxjs';

import { Empty } from '@nats-io/nats-core';

import { NatsService } from './nats.service';

@Injectable({
  providedIn: 'root'
})
export class EdgeService {

  constructor(
    private natsService: NatsService,
  ) { }

  listEdges(): Observable<EdgeProxy[] | undefined> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of(undefined);

    return from(
      nc.request('edges', Empty, { timeout: 5000 })
    ).pipe(
      map((msg) => {
        const result = Object.assign(
          new Result(), 
          JSON.parse(msg.string())
        ) as Result<EdgeProxy[]>;

        if ((result.code != 200) || (result.data == undefined)) {
          throw new Error(result.error);
        }

        const proxies: EdgeProxy[] = [];
        for (let raw of result.data) {
          let proxy = Object.assign(new EdgeProxy(), raw) as EdgeProxy;
          proxies.push(proxy);
        }

        return proxies;
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
}

export class EdgeProxy {
  id: string = '';
  instance: string = '';
  error: string = '';
  edge: Edge | undefined;
}
