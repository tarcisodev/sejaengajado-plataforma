import { Injectable, signal } from '@angular/core';

import { User } from '../../core/models/domain';

const KEY = 'seja.customer.session';

@Injectable({ providedIn: 'root' })
export class CustomerSession {
  readonly user = signal<User | null>(readSession());

  enter(user: User): void {
    this.user.set(user);
    sessionStorage.setItem(KEY, JSON.stringify(user));
  }

  clear(): void {
    this.user.set(null);
    sessionStorage.removeItem(KEY);
  }
}

function readSession(): User | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    const user = JSON.parse(raw) as User;
    return user?.role === 'CUSTOMER' ? user : null;
  } catch {
    return null;
  }
}
