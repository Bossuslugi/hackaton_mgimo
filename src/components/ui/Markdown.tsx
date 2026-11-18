import { Fragment, type ReactNode } from 'react';

/**
 * Безопасный мини-рендерер Markdown → React (без dangerouslySetInnerHTML).
 * Поддержка: #–###, абзацы, списки (- / 1.), > цитаты, ``` код, ---, таблицы GFM,
 * **жирный**, *курсив*, `код`, [ссылки](url).
 */

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyPrefix}-${i++}`;
    if (tok.startsWith('**')) {
      out.push(
        <strong key={k} className="font-semibold text-slate-900">
          {inline(tok.slice(2, -2), k)}
        </strong>,
      );
    } else if (tok.startsWith('`')) {
      out.push(
        <code key={k} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800 break-words">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith('[')) {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      const href = mm?.[2] ?? '#';
      const safe = /^(https?:|mailto:|\/)/.test(href) ? href : '#';
      out.push(
        <a key={k} href={safe} target="_blank" rel="noreferrer" className="text-blue-600 underline underline-offset-2 break-all">
          {mm?.[1]}
        </a>,
      );
    } else {
      out.push(<em key={k}>{inline(tok.slice(1, -1), k)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

export function Markdown({ source, compact = false }: { source: string; compact?: boolean }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const gap = compact ? 'mt-2' : 'mt-4';

  while (i < lines.length) {
    const line = lines[i];
    const k = `b${key++}`;

    if (!line.trim()) {
      i++;
      continue;
    }

    if (line.startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      blocks.push(
        <pre
          key={k}
          className={`${gap} overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800`}
        >
          {buf.join('\n')}
        </pre>,
      );
      continue;
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const cls =
        level === 1
          ? 'text-xl font-semibold tracking-tight text-slate-900'
          : level === 2
            ? 'text-base font-semibold text-slate-900'
            : 'text-sm font-semibold text-slate-900';
      const Tag = (level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4') as 'h2' | 'h3' | 'h4';
      blocks.push(
        <Tag key={k} className={`${blocks.length ? (compact ? 'mt-3' : 'mt-6') : ''} ${cls}`}>
          {inline(h[2], k)}
        </Tag>,
      );
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push(<hr key={k} className={`${gap} border-slate-200`} />);
      i++;
      continue;
    }

    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(splitRow(lines[i++]));
      blocks.push(
        <div key={k} className={`${gap} overflow-x-auto rounded-lg border border-slate-200`}>
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {head.map((c, j) => (
                  <th key={j} className="px-3 py-2 font-medium">
                    {inline(c, `${k}h${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t border-slate-200">
                  {r.map((c, j) => (
                    <td key={j} className="px-3 py-2 text-slate-700">
                      {inline(c, `${k}r${ri}c${j}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (line.startsWith('>')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(
        <blockquote key={k} className={`${gap} border-l-2 border-blue-600 bg-slate-50 py-2 pl-3 pr-2 text-sm text-slate-700`}>
          {inline(buf.join(' '), k)}
        </blockquote>,
      );
      continue;
    }

    const isUl = /^\s*[-*•]\s+/.test(line);
    const isOl = /^\s*\d+[.)]\s+/.test(line);
    if (isUl || isOl) {
      const items: string[] = [];
      const re = isUl ? /^\s*[-*•]\s+/ : /^\s*\d+[.)]\s+/;
      while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ''));
      const ListTag = isUl ? 'ul' : 'ol';
      blocks.push(
        <ListTag
          key={k}
          className={`${gap} space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 ${isUl ? 'list-disc marker:text-slate-400' : 'list-decimal marker:text-slate-500 marker:tabular-nums'}`}
        >
          {items.map((it, j) => (
            <li key={j}>{inline(it, `${k}-${j}`)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }

    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|```|>|\s*[-*•]\s|\s*\d+[.)]\s|\|)/.test(lines[i])
    ) {
      buf.push(lines[i++]);
    }
    if (!buf.length) buf.push(lines[i++]);
    blocks.push(
      <p key={k} className={`${blocks.length ? gap : ''} text-sm leading-relaxed text-slate-700 break-words`}>
        {buf.map((b, j) => (
          <Fragment key={j}>
            {j > 0 && ' '}
            {inline(b, `${k}-${j}`)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className="min-w-0">{blocks}</div>;
}
