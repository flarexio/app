import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { Observable, scan, switchMap } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';

import { NatsService } from '../nats.service';
import { OllamaService, Model } from '../ollama.service';

@Component({
  selector: 'app-ollama',
  standalone: true,
  imports: [
    AsyncPipe, 
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  templateUrl: './ollama.component.html',
  styleUrl: './ollama.component.scss'
})
export class OllamaComponent {
  ver: Observable<string | undefined>;
  models: Observable<Model[] | undefined>;

  selectedModel: Model | undefined;

  question: string | undefined;
  answer: string | undefined;
  loading: boolean = false;

  constructor(
    private natsService: NatsService,
    private ollamaService: OllamaService,
  ) {
    this.ver = this.natsService.connectionChange.pipe(
      switchMap((_) => this.ollamaService.getVersion())
    );

    this.models = this.natsService.connectionChange.pipe(
      switchMap((_) => this.ollamaService.listModels())
    );
  }

  sendMsg(input: HTMLInputElement) {
    const msg = input.value;
    input.value = '';

    const nc = this.natsService.nc;
    if (nc == undefined) return;

    const model = this.selectedModel;
    if (model == undefined) return;

    this.loading = true;

    this.question = msg;

    this.ollamaService.chat(
      model.model, msg
    ).pipe(
      scan((acc, curr) => acc + curr, '')
    ).subscribe({
      next: result => this.answer = result,
      error: (err) => console.error(err),
      complete: () => this.loading = false,
    });
  }

  public get isNatsConnected(): boolean {
    return this.natsService.isConnected;
  }
}
