import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DomSanitizer, SafeHtml, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

import { LEGAL_DOCS, type LegalSlug, isLegalSlug } from './legal-documents';
import { LEGAL_NAV } from './legal-links';
import { markdownToHtml } from './markdown-to-html';

type LegalPageView = { slug: LegalSlug; title: string; html: SafeHtml };

@Component({
  selector: 'app-legal-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './legal-page.component.html',
  styleUrl: './legal-page.component.scss',
})
export class LegalPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly sanitizer = inject(DomSanitizer);

  readonly nav = LEGAL_NAV;

  readonly doc = toSignal(
    this.route.data.pipe(
      map((data): LegalPageView | null => {
        const slug = String(data['legalSlug'] ?? '');
        if (!isLegalSlug(slug)) {
          return null;
        }
        const document = LEGAL_DOCS[slug];
        this.title.setTitle(`${document.title} · Seja Engajado`);
        return {
          slug,
          title: document.title,
          html: this.sanitizer.bypassSecurityTrustHtml(markdownToHtml(document.markdown)),
        };
      }),
    ),
    { initialValue: null as LegalPageView | null },
  );
}
