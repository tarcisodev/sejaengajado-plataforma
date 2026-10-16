import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMoon, lucideSun } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmToaster } from '@spartan-ng/helm/sonner';

import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';

/** Placeholder da área /revenda (conteúdo na parte 2). */
@Component({
  selector: 'app-reseller-shell',
  imports: [RouterOutlet, NgIcon, HlmButton, HlmToaster],
  providers: [provideIcons({ lucideMoon, lucideSun })],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './reseller-shell.component.html',
})
export class ResellerShellComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);

  leave(): void {
    void this.auth.signOut();
  }
}
