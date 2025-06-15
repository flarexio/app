import { AsyncPipe } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, filter, map, switchMap } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { AIService, AppInfo, ChatContext, HumanMessage, Message } from '../ai.service';
import { NatsService } from '../nats.service';

@Component({
  selector: 'app-ai',
  standalone: true,
  imports: [
    AsyncPipe, 
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './ai.component.html',
  styleUrl: './ai.component.scss'
})
export class AIComponent implements AfterViewChecked {
  @ViewChild('chatContainer')
  chatContainer!: ElementRef;

  apps: Observable<AppInfo[] | undefined>;
  step = signal(0);

  selectedApp: AppInfo | undefined;
  sessionID: string | undefined;
  userID: string | undefined;
  customerID: string | undefined = '01JSZKQKT51WB1H7YQNSE73BGR';

  messages: Message[] = [];
  currentMessage: Message | undefined = undefined;
  loading: boolean = false;

  // 在組件中管理顯示狀態
  messageStates = new Map<Message, {
    showToolDetails: boolean;
    showNodeDetails: boolean;
  }>();

  constructor(
    private natsService: NatsService,
    private aiService: AIService,
  ) {
    this.apps = this.natsService.connectionChange.pipe(
      switchMap((_) => this.aiService.listApps())
    );
  }

  ngAfterViewChecked() {
    if (this.currentMessage != undefined) {
      const element = this.chatContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  setStep(index: number) {
    this.step.set(index);
  }

  nextStep() {
    this.step.update(i => i + 1);
  }

  prevStep() {
    this.step.update(i => i - 1);
  }

  appSelectedHandler($event: any) {
    this.nextStep();
  }

  openSession() {
    setTimeout(() => {
      const chatElement = document.querySelector('.chat-layout');
      if (chatElement) {
        chatElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    
    // 聚焦到輸入框
    setTimeout(() => {
      const inputElement = document.querySelector('.message-input-container input') as HTMLInputElement;
      if (inputElement) {
        inputElement.focus();
      }
    }, 300);
  }

  createSession() {
    const app = this.selectedApp;
    if (app == undefined) return;

    this.sessionID = undefined;

    this.aiService.createSession(app).subscribe({
      next: (id) => this.sessionID = id,
      error: (err) => console.error(err),
      complete: () => console.log('Session created successfully'),
    });
  }

  get context(): string {
    let ctx: string[] = [];
    if (this.sessionID) {
      ctx.push(`Session: ${this.sessionID.slice(0, 5)}...`);
    }

    if (this.userID) {
      ctx.push(`User: ${this.userID.slice(0, 5)}...`);
    }

    if (this.customerID) {
      ctx.push(`Customer: ${this.customerID.slice(0, 5)}...`);
    }

    return ctx.join(' | ');
  }

  toggleToolDetails(message: Message) {
    message.toggleToolCallDetails();
  }

  toggleNodeDetails(message: Message) {
    message.toggleNodeDetails();
  }

  // 添加調試方法
  debugMessage(message: Message) {
    console.log('Message debug:', {
      role: message.role,
      hasToolCalls: message.tool_calls && message.tool_calls.length > 0,
      toolCallsLength: message.tool_calls?.length,
      showToolCallDetails: message.showToolCallDetails,
      toolCalls: message.tool_calls
    });
  }

  getToolDetailsState(message: Message): boolean {
    return message.showToolCallDetails;
  }

  getNodeDetailsState(message: Message): boolean {
    return message.showNodeDetails;
  }

  toggleMessageCollapse(message: Message) {
    message.toggleCollapse();
  }

  sendMsg(input: HTMLInputElement) {
    const nc = this.natsService.nc;
    if (nc == undefined) return;

    const app = this.selectedApp;
    if (app == undefined) return;

    const ctx: ChatContext = {
      session_id: this.sessionID,
      user_id: this.userID,
      customer_id: this.customerID,
    }

    let content = input.value;
    input.value = '';

    if (content.trim()) {
      this.messages.push(HumanMessage(content));
    }

    this.loading = true;
    this.currentMessage = undefined;

    // 在這次請求的範圍內維護 tool_call 映射
    const messagesByToolCallID = new Map<string, Message>();

    this.aiService.sendMessage(ctx, content).pipe(
      map((chunk) => {
        if (chunk == undefined) return;

        let message = this.currentMessage;

        if (chunk.is_new) {
          if (message) {
            message.completeStreaming();
          }

          message = new Message(chunk.role, chunk.content || '');
          this.currentMessage = message;
        }

        if (message === undefined) return;

        if (message) {
          message.processChunk(chunk);
        }

        // 針對 AI 角色：處理 tool_calls
        if (chunk.role === 'ai') {
          if (chunk.tool_calls && chunk.tool_calls.length > 0) {
            chunk.tool_calls.forEach(toolCall => {
              if (toolCall.id && !messagesByToolCallID.has(toolCall.id)) {
                messagesByToolCallID.set(toolCall.id, message);
              }
            });
          }
        }

        
        // 針對 Tool 角色：處理 tool_call_id 對應的結果
        if (chunk.role === 'tool') {
          const toolMessage = chunk as { tool_call_id: string; content: string };
          const message = messagesByToolCallID.get(toolMessage.tool_call_id);
          if (message) {
            message.addToolResult(toolMessage.tool_call_id, toolMessage.content);
          }
        }

        if (!chunk.is_new) {
          return undefined;
        }

        return message;
      }),
      filter((message): message is Message => message !== undefined),
      filter((message) => message.role !== 'tool'),
    ).subscribe({
      next: (message) => this.messages.push(message),
      error: (err) => {
        console.error(err);
        this.loading = false;
        messagesByToolCallID.clear();
      },
      complete: () => {
        if (this.currentMessage) {
          this.currentMessage.completeStreaming();
        }

        this.currentMessage = undefined;
        this.loading = false;
        messagesByToolCallID.clear();
      },
    });
  }

  public get isNatsConnected(): boolean {
    return this.natsService.isConnected;
  }
}
