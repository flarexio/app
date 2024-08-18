import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, map, of, scan } from 'rxjs';

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

    return from(nc.request('ollama.version', Empty, { timeout: 5000 })).pipe(
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

  subChats(loading: (value: boolean) => void): Observable<string | undefined> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of(undefined);

    return from(
      nc.subscribe('ollama.chats.>')
    ).pipe(
      map((msg) => {
        const raw = JSON.parse(msg.string()) as ChatResponse;
        const resp = Object.assign(new ChatResponse(), raw);

        if (resp.done) {
          loading(false);
          return '\n';
        }

        return resp.message.content;
      }),
      scan((acc, curr) => acc + curr, ''),
    )
  }
}

export class Model {
	private _name: string = '';
	private _model: string = '';
	private _modified_at: Date = new Date();
	private _size: number = 0;
	private _digest: string = '';

  public get name(): string {
    return this._name;
  }

  public set name(value: string) {
    this._name = value;
  }

  public get model(): string {
    return this._model;
  }

  public set model(value: string) {
    this._model = value;
  }

  public set modified_at(value: Date) {
    this._modified_at = value;
  }

  public get modified_at(): Date {
    return this._modified_at;
  }

  public get size(): number {
    return this._size;
  }

  public set size(value: number) {
    this._size = value;
  }

  public get digest(): string {
    return this._digest;
  }

  public set digest(value: string) {
    this._digest = value;
  }
}

class ChatResponse {
	private _model: string = '';
	private _created_at: Date = new Date;
	private _message: Message = new Message;
	private _done_reason: string = '';
	private _done: boolean = false;

  public get model(): string {
    return this._model;
  }

  public set model(value: string) {
    this._model = value;
  }

  public get created_at(): Date {
    return this._created_at;
  }

  public set created_at(value: Date) {
    this._created_at = value;
  }

  public get message(): Message {
    return this._message;
  }

  public set message(value: Message) {
    this._message = Object.assign(new Message(), value);
  }

  public get done_reason(): string {
    return this._done_reason;
  }

  public set done_reason(value: string) {
    this._done_reason = value;
  }

  public get done(): boolean {
    return this._done;
  }

  public set done(value: boolean) {
    this._done = value;
  }
}

class Message {
	private _role: string = '';
	private _content: string = '';

  public get role(): string {
    return this._role;
  }

  public set role(value: string) {
    this._role = value;
  }

  public get content(): string {
    return this._content;
  }

  public set content(value: string) {
    this._content = value;
  }
}
