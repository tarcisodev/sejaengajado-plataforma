import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BrnAlertDialogContent } from '@spartan-ng/brain/alert-dialog';
import { HlmButton } from '@spartan-ng/helm/button';

import { HlmAlertDialogImports } from '../ui/alert-dialog/src';

/**
 * Confirmação reutilizável (FLUXO-FELIZ §7).
 * O gatilho fica DENTRO do hlm-alert-dialog (mesmo DI) — content projection
 * quebra o hlmAlertDialogTrigger.
 */
@Component({
  selector: 'app-confirm-action',
  imports: [BrnAlertDialogContent, HlmAlertDialogImports, HlmButton],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <hlm-alert-dialog>
      <button
        hlmBtn
        hlmAlertDialogTrigger
        type="button"
        [class]="'h-11 ' + triggerClass()"
        [variant]="triggerVariant()"
        [disabled]="disabled()"
        [attr.data-action]="action() || null"
        [attr.data-suspend-site]="suspendAttr() ? '1' : null"
        [attr.aria-label]="ariaLabel() || title()"
        [attr.title]="verb()"
      >
        <ng-content />
        {{ triggerLabel() || verb() }}
      </button>
      <ng-template brnAlertDialogContent>
        <div hlmAlertDialogContent>
          <h2 hlmAlertDialogTitle class="font-display text-xl">{{ title() }}</h2>
          <p class="text-sm text-muted-foreground">{{ effect() }}</p>
          @if (undoHint()) {
            <p class="mt-2 text-sm text-muted-foreground">{{ undoHint() }}</p>
          }
          <div hlmAlertDialogFooter>
            <button hlmAlertDialogCancel class="h-11" type="button" (click)="cancel.emit()">
              Cancelar
            </button>
            <button
              hlmAlertDialogAction
              class="h-11"
              type="button"
              [variant]="destructive() ? 'destructive' : 'default'"
              [attr.data-confirm-verb]="verb()"
              (click)="confirm.emit()"
            >
              {{ verb() }}
            </button>
          </div>
        </div>
      </ng-template>
    </hlm-alert-dialog>
  `,
})
export class ConfirmActionComponent {
  readonly title = input.required<string>();
  readonly effect = input.required<string>();
  readonly verb = input.required<string>();
  readonly undoHint = input('');
  readonly destructive = input(false);
  readonly disabled = input(false);
  /** data-action on the trigger (publish | unpublish | archive). */
  readonly action = input('');
  readonly ariaLabel = input('');
  readonly triggerLabel = input('');
  readonly triggerClass = input('');
  readonly triggerVariant = input<'default' | 'outline' | 'destructive'>('default');
  /** Adds empty data-suspend-site on the trigger (admin list). */
  readonly suspendAttr = input(false);

  readonly confirm = output<void>();
  readonly cancel = output<void>();
}
