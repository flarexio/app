import { Routes } from '@angular/router';

import { EdgeComponent } from './edge/edge.component';
import { OllamaComponent } from './ollama/ollama.component';
import { ScannerComponent } from './scanner/scanner.component';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  { path: 'edges', component: EdgeComponent, canActivate: [ authGuard ] },
  { path: 'ollama', component: OllamaComponent, canActivate: [ authGuard ] },
  { path: 'scan', component: ScannerComponent, canActivate: [ authGuard ] },
];
