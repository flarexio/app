import { Injectable } from '@angular/core';
import { Observable, from, map, of, scan } from 'rxjs';

import { Empty } from '@nats-io/nats-core';

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
      map((msg) => msg.string()),
    )
  }

  chat(model: string, content: string): Observable<string | undefined> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of(undefined);

    const req = {
      model,
      messages: [
        { role: 'user', content },
      ],
      stream: true,
    };

    const payload = JSON.stringify(req);

    return from(
      nc.request('ollama.chats', payload, { timeout: 5000 })
    ).pipe(
      map((msg) => msg.string()),
    )
  }

  subChats(loading: (value: boolean) => void): Observable<string | undefined> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of(undefined);

    return from(
      nc.subscribe('ollama.chats.>')
    ).pipe(
      map((msg) => {
        const resp = Object.assign(new ChatResponse(), JSON.parse(msg.string()) as ChatResponse);

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

class ChatResponse {
	private _model: string;
	private _created_at: Date;
	private _message: Message;
	private _done_reason: string;
	private _done: boolean;

  constructor() {
    this._model = '';
    this._created_at = new Date();
    this._message = new Message();
    this._done_reason = '';
    this._done = false;
  }

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
	private _role: string;
	private _content: string;

  constructor() {
    this._role = '';
    this._content = '';
  }

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
