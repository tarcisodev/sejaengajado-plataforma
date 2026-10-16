import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';

@Component({
  selector: 'app-legal-accept',
  imports: [RouterLink, HlmCheckbox],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <label class="flex items-start gap-3 text-sm leading-snug" data-legal-accept>
      <hlm-checkbox
        class="mt-0.5"
        [checked]="accepted()"
        (checkedChange)="accepted.set($event === true)"
      />
      <span>
        Li e aceito os
        <a class="underline underline-offset-2" routerLink="/termos" target="_blank" rel="noopener"
          >Termos de Uso</a
        >, a
        <a
          class="underline underline-offset-2"
          routerLink="/privacidade"
          target="_blank"
          rel="noopener"
          >Política de Privacidade</a
        >, a
        <a
          class="underline underline-offset-2"
          routerLink="/uso-aceitavel"
          target="_blank"
          rel="noopener"
          >Política de Uso Aceitável</a
        >
        e a
        <a class="underline underline-offset-2" routerLink="/cobranca" target="_blank" rel="noopener"
          >Política de Cobrança</a
        >. Revendedores também aceitam o
        <a
          class="underline underline-offset-2"
          routerLink="/contrato-revenda"
          target="_blank"
          rel="noopener"
          >Contrato de Revenda</a
        >.
      </span>
    </label>
  `,
})
export class LegalAcceptComponent {
  /** Two-way binding for the acceptance checkbox. */
  readonly accepted = model(false);
}
