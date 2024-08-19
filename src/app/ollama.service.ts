import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, map, of } from 'rxjs';

import { Empty, createInbox } from '@nats-io/nats-core';

import { NatsService } from './nats.service';

@Injectable({
  providedIn: 'root'
})
export class OllamaService {

  constructor(
    private natsService: NatsService,
  ) { }

  getVersion(): Observable<string | undefined> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of(undefined);

    return from(
      nc.request('ollama.version', Empty, { timeout: 5000 })
    ).pipe(
      map((msg) => msg.string())
    )
  }

  listModels(): Observable<Model[] | undefined> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of(undefined);

    return from(
      nc.request('ollama.models', Empty, { timeout: 5000 })
    ).pipe(
      map((msg) => {
        const raw = JSON.parse(msg.string());
        const models: Model[] = new Array();
        for (const rawModel of raw.models) {
          const model = Object.assign(new Model(), rawModel as Model);
          models.push(model);
        }

        return models;
      })
    )
  }

  chat(model: string, content: string): Observable<string> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of('');

    const req = {
      model,
      messages: [
        { role: 'user', content },
      ],
      stream: true,
    };

    const subject = new BehaviorSubject<string>('');

    const inbox = createInbox();

    const sub = nc.subscribe(inbox, {
      callback: (err, msg) => {
        if (err != null) {
          subject.error(err);
          subject.complete();
          return;
        }

        const raw = JSON.parse(msg.string()) as ChatResponse;
        const resp = Object.assign(new ChatResponse(), raw);

        if (resp.done) {
          subject.next('\n');

          sub.unsubscribe();
          subject.complete();
          return;
        }

        subject.next(resp.message.content);
      }
    });

    const payload = JSON.stringify(req);
    nc.publish('ollama.chat', payload, { reply: inbox })

    return subject.asObservable();
  }
}

export class Model {
	name: string = '';
	model: string = '';
	modified_at: Date | undefined;
	size: number = 0;
	digest: string = '';
}

class ChatResponse {
	model: string = '';
	created_at: Date | undefined;
	message: Message = new Message();
	done_reason: string = '';
	done: boolean = false;
}

class Message {
	role: string = '';
	content: string = '';
}
