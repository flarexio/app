import { Routes } from '@angular/router';

import { ScannerComponent } from './scanner/scanner.component';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  { path: 'scan', component: ScannerComponent, canActivate: [ authGuard ] },
];
