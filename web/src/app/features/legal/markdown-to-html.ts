/** Minimal Markdown → HTML for legal docs (headings, lists, tables, emphasis). */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let i = 0;
  let inUl = false;
  let inOl = false;
  let inTable = false;

  const closeLists = (): void => {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
  };

  const closeTable = (): void => {
    if (inTable) {
      html.push('</tbody></table>');
      inTable = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      closeLists();
      closeTable();
      i += 1;
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeLists();
      const cells = splitTableRow(trimmed);
      const next = lines[i + 1]?.trim() ?? '';
      if (!inTable && isTableSeparator(next)) {
        html.push('<table><thead><tr>');
        for (const cell of cells) {
          html.push(`<th>${inline(cell)}</th>`);
        }
        html.push('</tr></thead><tbody>');
        inTable = true;
        i += 2;
        continue;
      }
      if (inTable) {
        html.push('<tr>');
        for (const cell of cells) {
          html.push(`<td>${inline(cell)}</td>`);
        }
        html.push('</tr>');
        i += 1;
        continue;
      }
    }

    closeTable();

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      closeLists();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('> ')) {
      closeLists();
      html.push(`<blockquote><p>${inline(trimmed.slice(2))}</p></blockquote>`);
      i += 1;
      continue;
    }

    const ul = /^[-*]\s+(.+)$/.exec(trimmed);
    if (ul) {
      closeTable();
      if (inOl) {
        html.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul>');
        inUl = true;
      }
      html.push(`<li>${inline(ul[1])}</li>`);
      i += 1;
      continue;
    }

    const ol = /^(\d+)\.\s+(.+)$/.exec(trimmed);
    if (ol) {
      closeTable();
      if (inUl) {
        html.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        html.push('<ol>');
        inOl = true;
      }
      html.push(`<li>${inline(ol[2])}</li>`);
      i += 1;
      continue;
    }

    closeLists();
    html.push(`<p>${inline(trimmed)}</p>`);
    i += 1;
  }

  closeLists();
  closeTable();
  return html.join('\n');
}

function splitTableRow(line: string): string[] {
  return line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  if (!line.startsWith('|') || !line.endsWith('|')) {
    return false;
  }
  return splitTableRow(line).every((cell) => /^:?-{3,}:?$/.test(cell));
}

function inline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" rel="noopener noreferrer">$1</a>',
  );
  return out;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
