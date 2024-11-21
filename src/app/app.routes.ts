import { Routes } from '@angular/router';

import { authGuard } from './auth.guard';
import { EdgeComponent } from './edge/edge.component';
import { GameComponent } from './game/game.component';
import { OllamaComponent } from './ollama/ollama.component';
import { ScannerComponent } from './scanner/scanner.component';
import { ToolkitComponent } from './toolkit/toolkit.component';

export const routes: Routes = [
  { path: 'edges', component: EdgeComponent, canActivate: [ authGuard ] },
  { path: 'game', component: GameComponent, canActivate: [ authGuard ] },
  { path: 'ollama', component: OllamaComponent, canActivate: [ authGuard ] },
  { path: 'scan', component: ScannerComponent, canActivate: [ authGuard ] },
  { path: 'toolkit', component: ToolkitComponent, canActivate: [ authGuard ] },
];
