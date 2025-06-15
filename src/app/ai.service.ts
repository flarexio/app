import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable, from, map, of, startWith } from 'rxjs';
import { Empty, createInbox } from '@nats-io/nats-core';

import { NatsService } from './nats.service';

@Injectable({
  providedIn: 'root'
})
export class AIService {

  constructor(
    private natsService: NatsService,
  ) { }

  listApps(): Observable<AppInfo[] | undefined> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of(undefined);

    return from(
      nc.request('ai.apps.list', Empty, { timeout: 5000 })
    ).pipe(
      map((msg) => {
        const resp = JSON.parse(msg.string());
        return resp.apps as AppInfo[];
      })
    )
  }

  createSession(app: AppInfo): Observable<string> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of('');

    const req = {
      app_name: app.id, // TODO: modify this to use app_id
    };

    return from(
      nc.request('ai.sessions.create', JSON.stringify(req), { timeout: 5000 })
    ).pipe(
      map((msg) => msg.string())
    );
  }

  sendMessage(ctx: ChatContext, content: string): Observable<MessageChunk | undefined> {
    const nc = this.natsService.nc;
    if (nc == undefined) return of(undefined);

    const req: StreamMessageRequest = {
      ctx,
      content,
    };

    const subject = new BehaviorSubject<MessageChunk | undefined>(undefined);

    const inbox = createInbox();

    const sub = nc.subscribe(inbox, {
      callback: (err, msg) => {
        if (err != null) {
          subject.error(err);
          subject.complete();
          return;
        }

        if (msg.string() === '[DONE]') {
          sub.unsubscribe();
          subject.complete();
          return;
        }

        const chunk = JSON.parse(msg.string()) as MessageChunk;
        subject.next(chunk);
      }
    });

    const payload = JSON.stringify(req);
    nc.publish(`ai.sessions.${ctx.session_id}.messages.stream`, payload, { reply: inbox })

    return subject.asObservable();
  }
}

export interface AppInfo {
  id: string;
  name: string;
  description: string;
  version: string;
}

export interface ChatContext {
  session_id: string | undefined;
  user_id: string | undefined;
  customer_id: string | undefined;
}

interface StreamMessageRequest {
  ctx: ChatContext;
  content: string;
}

export class Message {
  nodes: string[] = [];
  role: string = '';
  content: string = '';
  tool_calls: ToolCall[] = [];
  tool_call_id: string = '';
  
  private _isCollapsed = signal(false);
  private _showNodeDetails = signal(false);
  private _showToolCallDetails = signal(false);

  private _contentChangeSubject = new BehaviorSubject<string>('');

  constructor(
    role: string,
    content: string,
  ) {
    this.role = role;
    this.content = content;
    
    this._contentChangeSubject.next(this.content);
  }

  processChunk(chunk: MessageChunk) {
    if (chunk.is_new) {
      if (chunk.nodes && chunk.nodes.length > 0) {
        this.nodes = [...chunk.nodes];
      }
    }

    if (chunk.content && chunk.content !== '') {
      this.content += chunk.content;
    }

    if (chunk.tool_calls && chunk.tool_calls.length > 0) {
      for (let i = 0; i < chunk.tool_calls.length; i++) {
        const toolCall = chunk.tool_calls[i];

        if (this.tool_calls.length < chunk.tool_calls.length) {
          if (toolCall.id !== '' && toolCall.name !== '') {
            this.tool_calls.push({
              id: toolCall.id,
              name: toolCall.name,
              args: '',
              status: 'pending',
            });
          }
        }

        if (toolCall.args !== '') {
          this.tool_calls[i].args += toolCall.args;
        }
      }
    }

    this._contentChangeSubject.next(this.cleanContent);
  }

  completeStreaming() {
    this.tool_calls.forEach(tc => {
      if (tc.status === 'pending') {
        tc.status = 'running';
      }
    });
    
    this.autoCollapseIfNeeded();
    this._contentChangeSubject.next(this.cleanContent);
  }

  private autoCollapseIfNeeded() {
    const shouldAutoCollapse = this.shouldAutoCollapse();
    if (shouldAutoCollapse) {
      this._isCollapsed.set(true);
    }
  }

  private shouldAutoCollapse(): boolean {
    if (this.role === 'tool') {
      return true;
    }
    
    if (this.role === 'ai' && this.content.length > 800) {
      return true;
    }
    
    if (this.tool_calls.length > 0) {
      return true;
    }
    
    return false;
  }

  toggleCollapse() {
    this._isCollapsed.update(value => !value);
    this._contentChangeSubject.next(this.cleanContent);
  }

  toggleNodeDetails() {
    this._showNodeDetails.update(value => !value);
    this._contentChangeSubject.next(this.cleanContent);
  }

  toggleToolCallDetails() {
    this._showToolCallDetails.update(value => !value);
    this._contentChangeSubject.next(this.cleanContent);
  }

  get isCollapsed(): boolean {
    return this._isCollapsed();
  }

  get showNodeDetails(): boolean {
    return this._showNodeDetails();
  }

  get showToolCallDetails(): boolean {
    return this._showToolCallDetails();
  }

  set showToolCallDetails(value: boolean) {
    this._showToolCallDetails.set(value);
  }

  get summary(): string {
    const nodeCount = this.nodes.length;
    const toolCallCount = this.tool_calls.length;
    
    let summary = '';
    
    if (this.role === 'tool') {
      summary = `🔧 Tool Response`;
      if (this.content.length > 0) {
        const preview = this.content.substring(0, 100).replace(/\n/g, ' ');
        summary += `: ${preview}${this.content.length > 100 ? '...' : ''}`;
      }
    } else if (this.role === 'ai') {
      if (nodeCount > 0) {
        summary += `🤖 AI processed through ${nodeCount} nodes`;
      } else {
        summary += `🤖 AI Response`;
      }
      
      if (toolCallCount > 0) {
        summary += ` • ${toolCallCount} tool calls`;
      }
      
      if (this.content.length > 0) {
        const contentPreview = this.content.substring(0, 80);
        summary += ` • ${contentPreview}${this.content.length > 80 ? '...' : ''}`;
      }
    }
    
    return summary || 'Processing...';
  }

  get cleanContent(): string {
    if (this.role === 'human') {
      return this.content;
    }
    return this.content.replace(/\n\nTool Call:.*$/s, '').trim();
  }

  get display(): Observable<string> {
    if (this.role === 'human') {
      return of(this.content);
    }
    return this._contentChangeSubject.asObservable().pipe(
      startWith(this.cleanContent)
    );
  }

  addToolResult(toolCallId: string, result: string) {
    const toolCall = this.tool_calls.find(tc => tc.id === toolCallId);
    if (toolCall) {
      toolCall.result = result;
      toolCall.status = 'completed';
      this._contentChangeSubject.next(this.cleanContent);
    }
  }

  getToolResult(toolCallId: string): string | undefined {
    const toolCall = this.tool_calls.find(tc => tc.id === toolCallId);
    return toolCall?.result;
  }

  formatJsonArgs(obj: any): string {
    if (typeof obj === 'string') {
      try {
        const parsed = JSON.parse(obj);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return obj;
      }
    }
    return JSON.stringify(obj, null, 2);
  }
}

export function HumanMessage(content: string): Message {
  return new Message('human', content);
}

export interface MessageChunk {
  nodes?: string[];
  role: string;
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  is_new: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  args: string;
  result?: string;
  status?: 'pending' | 'running' | 'completed' | 'error'; 
}
