import { Routes } from '@angular/router';

import { EdgeComponent } from './edge/edge.component';
import { ScannerComponent } from './scanner/scanner.component';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  { path: 'edges', component: EdgeComponent, canActivate: [ authGuard ] },
  { path: 'scan', component: ScannerComponent, canActivate: [ authGuard ] },
];
