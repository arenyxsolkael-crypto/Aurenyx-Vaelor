import React, { useState } from 'react';
import katex from 'katex';
import { Check, Copy, Download } from 'lucide-react';
import { parseSafeMarkdownLink } from '../shared/markdownSafety';

interface MarkdownViewProps {
  content: string;
}

interface ContentSegment {
  type: 'text' | 'code' | 'math-block';
  lang?: string;
  value: string;
}

function splitMathBlocks(textChunk: string): ContentSegment[] {
  const out: ContentSegment[] = [];
  const blockMathRegex = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = blockMathRegex.exec(textChunk)) !== null) {
    if (m.index > lastIdx) {
      out.push({ type: 'text', value: textChunk.slice(lastIdx, m.index) });
    }
    const expr = (m[1] ?? m[2] ?? '').trim();
    out.push({ type: 'math-block', value: expr });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < textChunk.length) {
    out.push({ type: 'text', value: textChunk.slice(lastIdx) });
  }
  return out;
}

function splitCodeFences(raw: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const fenceRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push(...splitMathBlocks(raw.slice(lastIndex, match.index)));
    }
    segments.push({
      type: 'code',
      lang: match[1] || 'code',
      value: match[2].replace(/\n$/, ''),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    segments.push(...splitMathBlocks(raw.slice(lastIndex)));
  }

  return segments;
}

function renderSafeMathHtml(expr: string, displayMode: boolean): string {
  try {
    return katex.renderToString(expr, {
      displayMode,
      throwOnError: false,
      trust: false,
      output: 'mathml',
    });
  } catch {
    return '';
  }
}

const KEYWORD_SET = new Set([
  'import',
  'export',
  'from',
  'const',
  'let',
  'var',
  'function',
  'async',
  'await',
  'return',
  'if',
  'else',
  'for',
  'while',
  'try',
  'catch',
  'throw',
  'new',
  'class',
  'interface',
  'type',
  'true',
  'false',
  'null',
  'undefined',
  'def',
  'select',
  'where',
  'create',
  'table',
]);

function highlightCodeLine(line: string): React.ReactNode {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('# ')) {
    return <span className="text-[#8e86a8] italic">{line}</span>;
  }

  const tokens = line.split(/("[^"]*"|'[^']*'|`[^`]*`|\b[A-Za-z_][A-Za-z0-9_]*\b|\b\d+(?:\.\d+)?\b)/g);
  return tokens.map((tok, i) => {
    if (!tok) return null;
    if (
      (tok.startsWith('"') && tok.endsWith('"')) ||
      (tok.startsWith("'") && tok.endsWith("'")) ||
      (tok.startsWith('`') && tok.endsWith('`'))
    ) {
      return (
        <span key={i} className="text-emerald-300">
          {tok}
        </span>
      );
    }
    if (/^\d+(?:\.\d+)?$/.test(tok)) {
      return (
        <span key={i} className="text-amber-300">
          {tok}
        </span>
      );
    }
    if (KEYWORD_SET.has(tok.toLowerCase())) {
      return (
        <span key={i} className="text-[#c4b1ff] font-medium">
          {tok}
        </span>
      );
    }
    return <React.Fragment key={i}>{tok}</React.Fragment>;
  });
}

const CodeBlock: React.FC<{ lang: string; code: string }> = ({ lang, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const extMap: Record<string, string> = {
      typescript: 'ts',
      ts: 'ts',
      tsx: 'tsx',
      javascript: 'js',
      js: 'js',
      json: 'json',
      csv: 'csv',
      python: 'py',
      py: 'py',
      sql: 'sql',
      html: 'html',
      css: 'css',
      markdown: 'md',
      md: 'md',
    };
    const ext = extMap[lang.toLowerCase()] || 'txt';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vaelor-snippet.${ext}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const codeLines = code.split('\n');

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-white/10 bg-[#09080e] text-[#e6e1f4]">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#12101b] px-3.5 py-2 text-xs text-[#a59ec0]">
        <span className="font-mono">{lang}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleDownload}
            aria-label={`Download ${lang} snippet`}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-md px-2 py-1 text-xs text-[#c7c0da] hover:bg-white/8 hover:text-white whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`Copy ${lang} code snippet`}
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[#c7c0da] hover:bg-white/8 hover:text-white whitespace-nowrap"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>{copied ? 'Copied' : 'Copy code'}</span>
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-[#e6e1f4]">
        <code>
          {codeLines.map((ln, idx) => (
            <React.Fragment key={idx}>
              {highlightCodeLine(ln)}
              {idx < codeLines.length - 1 ? '\n' : ''}
            </React.Fragment>
          ))}
        </code>
      </pre>
    </div>
  );
};

function renderInlineFormatting(line: string): React.ReactNode[] {
  const inlinePattern =
    /(`[^`]+`|\[[^\]]+\]\((?:[^()\n]|\([^()\n]*\))+\)|\\\([^\n]+?\\\)|\$(?!\s)(?:[A-Za-z\\{(]|[^$\n]{1,120}?[\\^_=+\-*/{}])[^$\n]{0,120}?(?<!\s)\$|\*\*[^*]+\*\*|(?<!\*)\*(?!\s|\*)[^*\n]+?(?<!\s|\*)\*(?!\*))/g;
  const tokens = line.split(inlinePattern);
  return tokens.map((token, idx) => {
    if (!token) return null;
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code
          key={idx}
          className="rounded bg-[#1d182b] px-1.5 py-0.5 font-mono text-[0.84em] text-[#d8cbfc]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('[') && token.endsWith(')') && token.includes('](')) {
      const parsedLink = parseSafeMarkdownLink(token);
      if (parsedLink) {
        if (parsedLink.href) {
          return (
            <a
              key={idx}
              href={parsedLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#bca8fc] underline underline-offset-2 hover:text-white break-all"
            >
              {parsedLink.label}
            </a>
          );
        }
        return (
          <span
            key={idx}
            className="text-[#9e97b0]"
            title={`Blocked unsafe link scheme (${parsedLink.blockedScheme || 'unsafe'})`}
          >
            [{parsedLink.label}] (unsafe link blocked)
          </span>
        );
      }
    }
    if (
      (token.startsWith('\\(') && token.endsWith('\\)')) ||
      (token.startsWith('$') && token.endsWith('$') && token.length >= 3)
    ) {
      const expr = token.startsWith('\\(') ? token.slice(2, -2).trim() : token.slice(1, -1).trim();
      const mathHtml = renderSafeMathHtml(expr, false);
      if (mathHtml) {
        return (
          <span
            key={idx}
            className="inline-block align-middle text-[#f2effb] px-0.5"
            dangerouslySetInnerHTML={{ __html: mathHtml }}
          />
        );
      }
    }
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-[#f6f4fc]">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (
      token.startsWith('*') &&
      token.endsWith('*') &&
      !token.startsWith('**') &&
      token.length >= 3
    ) {
      return (
        <em key={idx} className="italic text-[#cfc9e6]">
          {renderInlineFormatting(token.slice(1, -1))}
        </em>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

function parseTableRow(rowLine: string): string[] {
  return rowLine
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isSeparatorRow(rowLine: string): boolean {
  const trimmed = rowLine.trim();
  if (!trimmed.includes('|')) return false;
  const cells = parseTableRow(trimmed);
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function renderTextBlocks(textValue: string): React.ReactNode[] {
  const lines = textValue.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trimEnd();

    // Detect Markdown table block: header row + |---|---| separator row
    if (
      line.trim().startsWith('|') &&
      i + 1 < lines.length &&
      isSeparatorRow(lines[i + 1] ?? '')
    ) {
      const headers = parseTableRow(line);
      const bodyRows: string[][] = [];
      i += 2;
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('|')) {
        bodyRows.push(parseTableRow(lines[i] ?? ''));
        i += 1;
      }

      nodes.push(
        <div
          key={`tbl-${i}`}
          className="my-3 overflow-x-auto rounded-xl border border-white/10 bg-[#13111d]"
        >
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="border-b border-white/10 text-[#9e97b0]">
              <tr>
                {headers.map((h, hIdx) => (
                  <th key={hIdx} className="px-3.5 py-2.5 font-semibold text-[#f1eef9]">
                    {renderInlineFormatting(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-white/[0.02]">
                  {headers.map((_h, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2.5 text-[#ddd8ec]">
                      {renderInlineFormatting(row[cIdx] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Group consecutive Markdown blockquote lines (> ...) into a clean subtle callout container
    if (line.trimStart().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i] ?? '').trimStart().startsWith('>')) {
        quoteLines.push((lines[i] ?? '').trimStart().replace(/^>\s?/, ''));
        i += 1;
      }
      nodes.push(
        <blockquote
          key={`bq-${i}`}
          className="my-2 space-y-1 rounded-xl border border-white/10 bg-[#141120] px-3.5 py-2.5 text-xs leading-relaxed text-[#cfc9e6]"
        >
          {quoteLines.map((ql, qIdx) =>
            ql.trim() ? (
              <p key={qIdx}>{renderInlineFormatting(ql)}</p>
            ) : (
              <div key={qIdx} className="h-1" />
            )
          )}
        </blockquote>
      );
      continue;
    }

    if (!line.trim()) {
      nodes.push(<div key={`sp-${i}`} className="h-1" />);
    } else if (line.startsWith('### ')) {
      nodes.push(
        <h4 key={`h4-${i}`} className="pt-2 text-sm font-semibold text-[#f5f3fc]">
          {renderInlineFormatting(line.slice(4))}
        </h4>
      );
    } else if (line.startsWith('## ')) {
      nodes.push(
        <h3 key={`h3-${i}`} className="pt-2.5 text-base font-semibold text-[#f5f3fc]">
          {renderInlineFormatting(line.slice(3))}
        </h3>
      );
    } else if (line.startsWith('# ')) {
      nodes.push(
        <h2 key={`h2-${i}`} className="pt-3 text-lg font-semibold text-[#f5f3fc]">
          {renderInlineFormatting(line.slice(2))}
        </h2>
      );
    } else if (/^[-*]\s+/.test(line.trimStart())) {
      const bulletText = line.trimStart().replace(/^[-*]\s+/, '');
      nodes.push(
        <div key={`ul-${i}`} className="flex items-start gap-2.5 pl-1">
          <span
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#9a82f7]"
            aria-hidden="true"
          />
          <span className="flex-1">{renderInlineFormatting(bulletText)}</span>
        </div>
      );
    } else {
      const orderedMatch = line.trimStart().match(/^(\d+)\.\s+(.*)$/);
      if (orderedMatch) {
        nodes.push(
          <div key={`ol-${i}`} className="flex items-start gap-2.5 pl-1">
            <span className="font-mono text-xs text-[#a394db] tabular-nums mt-0.5 shrink-0">
              {orderedMatch[1]}.
            </span>
            <span className="flex-1">{renderInlineFormatting(orderedMatch[2])}</span>
          </div>
        );
      } else {
        nodes.push(<p key={`p-${i}`}>{renderInlineFormatting(line)}</p>);
      }
    }

    i += 1;
  }

  return nodes;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content }) => {
  const segments = splitCodeFences(content);

  return (
    <div className="space-y-2.5 text-[15px] leading-relaxed text-[#ddd8ec] break-words">
      {segments.map((seg, idx) => {
        if (seg.type === 'code') {
          return <CodeBlock key={idx} lang={seg.lang || 'text'} code={seg.value} />;
        }
        if (seg.type === 'math-block') {
          const mathHtml = renderSafeMathHtml(seg.value, true);
          return mathHtml ? (
            <div
              key={idx}
              className="my-3 overflow-x-auto rounded-xl border border-white/10 bg-[#12101c] px-4 py-3 text-center text-[#f4f1fc]"
              dangerouslySetInnerHTML={{ __html: mathHtml }}
            />
          ) : (
            <pre
              key={idx}
              className="my-3 overflow-x-auto rounded-xl border border-white/10 bg-[#12101c] p-3 font-mono text-xs text-[#e6e1f4]"
            >
              {seg.value}
            </pre>
          );
        }
        return (
          <div key={idx} className="space-y-2">
            {renderTextBlocks(seg.value)}
          </div>
        );
      })}
    </div>
  );
};
