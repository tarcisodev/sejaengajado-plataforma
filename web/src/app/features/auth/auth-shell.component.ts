import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-shell',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <main
      class="grid min-h-dvh place-items-center bg-background px-4 py-6 text-foreground"
      id="conteudo"
    >
      <router-outlet />
    </main>
  `,
})
export class AuthShellComponent {}
