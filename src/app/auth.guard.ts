import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { WalletService } from './wallet.service';

export const authGuard: CanActivateFn = (route, state) => {
  const svc = inject(WalletService);
  const router = inject(Router);

  if (svc.currentWallet == undefined) {
    router.navigate(['/']);
    return false;
  }

  return true;
};
