import { markdownToHtml } from './markdown-to-html';

describe('markdownToHtml', () => {
  it('renders headings, emphasis and escapes raw HTML', () => {
    const html = markdownToHtml('# Título\n\nTexto com **negrito** e <script>');
    expect(html).toContain('<h1>Título</h1>');
    expect(html).toContain('<strong>negrito</strong>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('renders lists and tables', () => {
    const html = markdownToHtml(
      '- um\n- dois\n\n| A | B |\n| --- | --- |\n| 1 | 2 |',
    );
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>um</li>');
    expect(html).toContain('<th>A</th>');
    expect(html).toContain('<td>1</td>');
  });
});
