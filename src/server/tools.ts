import { z } from 'zod';
import type {
  AgentId,
  CitationItem,
  KnowledgeDocument,
  SavedMemory,
  ToolAvailability,
  ToolCallRecord,
  ToolName,
  ToolStage,
} from '../shared/types.ts';
import { AGENT_DEFINITIONS } from './agents.ts';
import type { ModelGateway } from './modelGateway.ts';
import { detectSecretInText, wrapUntrustedData } from './validation.ts';

export const MAX_TOOL_OUTPUT_CHARS = 12_000;

export interface ToolExecutionContext {
  documents: KnowledgeDocument[];
  memories: SavedMemory[];
  confirmedByUser?: boolean;
  gateway?: ModelGateway;
  mockMode?: boolean;
  signal?: AbortSignal;
}

export const CitationItemSchema = z.object({
  id: z.string().min(1),
  sourceTitle: z.string().min(1),
  sourceType: z.enum(['document', 'memory', 'tool', 'web']),
  excerpt: z.string(),
  url: z.string().url().optional(),
  documentId: z.string().optional(),
  chunkIndex: z.number().int().optional(),
});

export const ToolResultPayloadSchema = z.object({
  formattedOutput: z.string().min(1),
  citations: z.array(CitationItemSchema).optional(),
  svgArtifact: z.string().optional(),
});

export type ToolResultPayload = z.infer<typeof ToolResultPayloadSchema>;

export interface ToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: ToolName;
  stage: ToolStage;
  availability: ToolAvailability;
  requiresConfirmation: boolean;
  description: string;
  inputSchema: TSchema;
  outputSchema: z.ZodTypeAny;
  outputSchemaSummary: string;
  allowedAgents: AgentId[];
  timeoutMs: number;
  maxCallsPerTask: number;
  errorStrategy: 'return_structured_error' | 'graceful_fallback_notice';
  resultFormat: string;
  setupGuide?: string;
  execute: (args: z.infer<TSchema>, context: ToolExecutionContext) => Promise<ToolResultPayload>;
}

/**
 * Safe recursive-descent arithmetic evaluator.
 * Supports +, -, *, /, %, ^, parentheses, unary +/-, pi, e, sqrt(), abs(), round(), min(), max().
 * Never uses eval() or Function().
 */
export function evaluateSafeMath(rawExpression: string): number {
  const expr = rawExpression.replace(/\s+/g, '');
  if (!expr || expr.length > 160) {
    throw new Error('Expression must be between 1 and 160 characters.');
  }
  if (/[^0-9.+\-*/%^(),a-zA-Z]/.test(expr)) {
    throw new Error('Expression contains unsupported characters.');
  }

  let pos = 0;

  function peek(): string {
    return expr[pos] ?? '';
  }

  function consume(expected?: string): string {
    const ch = expr[pos] ?? '';
    if (expected && ch !== expected) {
      throw new Error(`Expected '${expected}' at position ${pos}`);
    }
    pos += 1;
    return ch;
  }

  function parseExpression(): number {
    let val = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      val = op === '+' ? val + right : val - right;
    }
    return val;
  }

  function parseTerm(): number {
    let val = parsePower();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = consume();
      const right = parsePower();
      if ((op === '/' || op === '%') && right === 0) {
        throw new Error('Division by zero is undefined.');
      }
      if (op === '*') val *= right;
      else if (op === '/') val /= right;
      else val %= right;
    }
    return val;
  }

  function parsePower(): number {
    const base = parseUnary();
    if (peek() === '^') {
      consume('^');
      const exponent = parsePower();
      return Math.pow(base, exponent);
    }
    return base;
  }

  function parseUnary(): number {
    if (peek() === '+') {
      consume('+');
      return parseUnary();
    }
    if (peek() === '-') {
      consume('-');
      return -parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    if (peek() === '(') {
      consume('(');
      const val = parseExpression();
      consume(')');
      return val;
    }

    if (/[a-zA-Z]/.test(peek())) {
      let ident = '';
      while (/[a-zA-Z]/.test(peek())) {
        ident += consume();
      }
      const fn = ident.toLowerCase();
      if (fn === 'pi') return Math.PI;
      if (fn === 'e') return Math.E;

      const supportedFns = new Set(['sqrt', 'abs', 'round', 'min', 'max']);
      if (!supportedFns.has(fn)) {
        throw new Error(`Unsupported math function '${ident}'.`);
      }

      consume('(');
      const args: number[] = [parseExpression()];
      while (peek() === ',') {
        consume(',');
        args.push(parseExpression());
      }
      consume(')');

      if (fn === 'sqrt') {
        if ((args[0] ?? 0) < 0) throw new Error('Square root of negative number.');
        return Math.sqrt(args[0] ?? 0);
      }
      if (fn === 'abs') return Math.abs(args[0] ?? 0);
      if (fn === 'round') return Math.round(args[0] ?? 0);
      if (fn === 'min') return Math.min(...args);
      return Math.max(...args);
    }

    let numStr = '';
    while (/[0-9.]/.test(peek())) {
      numStr += consume();
    }
    if (!numStr || Number.isNaN(Number(numStr))) {
      throw new Error(`Invalid number near position ${pos}.`);
    }
    return Number(numStr);
  }

  const result = parseExpression();
  if (pos !== expr.length) {
    throw new Error(`Unexpected token '${peek()}' at position ${pos}.`);
  }
  if (!Number.isFinite(result)) {
    throw new Error('Calculation overflowed finite bounds.');
  }
  return Number(result.toFixed(8));
}

export interface CsvColumnSummary {
  column: string;
  nonEmptyCount: number;
  missingCount: number;
  numeric: boolean;
  min?: number;
  max?: number;
  mean?: number;
  sum?: number;
}

export interface CsvAnalysisSummary {
  rowCount: number;
  columnCount: number;
  headers: string[];
  columns: CsvColumnSummary[];
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function analyzeCsvDataset(csvText: string): CsvAnalysisSummary {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV input must include a header row and at least one data row.');
  }

  const headers = parseCsvLine(lines[0]).map((h, i) => h || `Column_${i + 1}`);
  const rows = lines.slice(1, 2001).map(parseCsvLine);

  const columns: CsvColumnSummary[] = headers.map((header, colIdx) => {
    const rawValues = rows.map((r) => (r[colIdx] ?? '').trim());
    const nonEmpty = rawValues.filter((v) => v.length > 0);
    const numericVals = nonEmpty
      .map((v) => Number(v.replace(/[,$%]/g, '')))
      .filter((n) => Number.isFinite(n));

    const isNumeric = nonEmpty.length > 0 && numericVals.length === nonEmpty.length;
    if (!isNumeric) {
      return {
        column: header,
        nonEmptyCount: nonEmpty.length,
        missingCount: rows.length - nonEmpty.length,
        numeric: false,
      };
    }

    const sum = numericVals.reduce((acc, v) => acc + v, 0);
    const min = Math.min(...numericVals);
    const max = Math.max(...numericVals);
    const mean = sum / numericVals.length;

    return {
      column: header,
      nonEmptyCount: nonEmpty.length,
      missingCount: rows.length - nonEmpty.length,
      numeric: true,
      min: Number(min.toFixed(4)),
      max: Number(max.toFixed(4)),
      mean: Number(mean.toFixed(4)),
      sum: Number(sum.toFixed(4)),
    };
  });

  return {
    rowCount: rows.length,
    columnCount: headers.length,
    headers,
    columns,
  };
}

export function inspectAndFormatJson(rawJson: string): {
  valid: boolean;
  rootType: 'object' | 'array' | 'primitive';
  topLevelKeys: string[];
  itemCount?: number;
  formattedPreview: string;
} {
  const parsed: unknown = JSON.parse(rawJson);
  const pretty = JSON.stringify(parsed, null, 2);
  if (Array.isArray(parsed)) {
    const first = parsed[0];
    const sampleKeys =
      first && typeof first === 'object' && !Array.isArray(first)
        ? Object.keys(first).slice(0, 20)
        : [];
    return {
      valid: true,
      rootType: 'array',
      topLevelKeys: sampleKeys,
      itemCount: parsed.length,
      formattedPreview: pretty.slice(0, 6000),
    };
  }
  if (parsed && typeof parsed === 'object') {
    return {
      valid: true,
      rootType: 'object',
      topLevelKeys: Object.keys(parsed).slice(0, 30),
      formattedPreview: pretty.slice(0, 6000),
    };
  }
  return {
    valid: true,
    rootType: 'primitive',
    topLevelKeys: [],
    formattedPreview: pretty.slice(0, 1000),
  };
}

/**
 * Deterministic Structured Formatter (v0.2 Tool Registry).
 * Converts JSON arrays/objects, CSV rows, or key:value pairs into canonical JSON or Markdown tables.
 */
export function formatStructuredContent(
  rawInput: string,
  targetFormat: 'markdown_table' | 'json'
): { targetFormat: 'markdown_table' | 'json'; rowCount: number; formatted: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Structured formatter input cannot be empty.');
  }

  let records: Record<string, string | number | boolean | null>[] = [];

  // 1. Try JSON first
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        records = parsed.slice(0, 50).map((item, idx) =>
          item && typeof item === 'object' && !Array.isArray(item)
            ? Object.fromEntries(
                Object.entries(item as Record<string, unknown>).map(([k, v]) => [
                  k,
                  typeof v === 'object' ? JSON.stringify(v) : (v as string | number | boolean | null),
                ])
              )
            : { index: idx + 1, value: String(item) }
        );
      } else if (parsed && typeof parsed === 'object') {
        records = Object.entries(parsed as Record<string, unknown>).map(([k, v]) => ({
          Field: k,
          Value: typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''),
        }));
      }
    } catch {
      // Fall through to CSV or key:value parsing
    }
  }

  // 2. Try CSV lines
  if (records.length === 0) {
    const lines = trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length >= 2 && lines[0].includes(',')) {
      const headers = parseCsvLine(lines[0]);
      records = lines.slice(1, 51).map((ln) => {
        const vals = parseCsvLine(ln);
        return Object.fromEntries(headers.map((h, i) => [h || `Col_${i + 1}`, vals[i] ?? '']));
      });
    } else {
      // 3. Key: value lines or bullet list items
      records = lines.slice(0, 50).map(
        (ln, idx): Record<string, string | number | boolean | null> => {
          const clean = ln.replace(/^[-*•]\s+/, '');
          const sepIdx = clean.indexOf(':');
          if (sepIdx > 0 && sepIdx < 48) {
            return {
              Key: clean.slice(0, sepIdx).trim(),
              Value: clean.slice(sepIdx + 1).trim(),
            };
          }
          return { Item: idx + 1, Content: clean };
        }
      );
    }
  }

  if (targetFormat === 'json') {
    return {
      targetFormat: 'json',
      rowCount: records.length,
      formatted: JSON.stringify(records, null, 2),
    };
  }

  const columns = Array.from(
    records.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  const headerLine = `| ${columns.join(' | ')} |`;
  const dividerLine = `| ${columns.map(() => '---').join(' | ')} |`;
  const bodyLines = records.map(
    (row) =>
      `| ${columns
        .map((c) => String(row[c] ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' '))
        .join(' | ')} |`
  );

  return {
    targetFormat: 'markdown_table',
    rowCount: records.length,
    formatted: [headerLine, dividerLine, ...bodyLines].join('\n'),
  };
}

export interface StaticCodeFinding {
  rule: string;
  severity: 'high' | 'medium' | 'low';
  line: number;
  message: string;
}

export interface StaticCodeReviewReport {
  language: string;
  lineCount: number;
  nonEmptyLineCount: number;
  functionOrMethodCount: number;
  executedCode: false;
  findings: StaticCodeFinding[];
  summary: string;
}

/**
 * Deterministic Static Code Reviewer (VAELOR v0.3 Phase 5).
 * Inspects source code syntax/patterns statically without ever executing untrusted code.
 */
export function analyzeCodeStatically(
  rawInput: string,
  languageHint?: string
): StaticCodeReviewReport {
  const fenceMatch = rawInput.match(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/);
  const detectedLang = (languageHint || fenceMatch?.[1] || 'source').trim() || 'source';
  const code = (fenceMatch?.[2] ?? rawInput).slice(0, 30_000);
  const lines = code.split(/\r?\n/);
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  const findings: StaticCodeFinding[] = [];

  let functionCount = 0;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    if (
      /\bfunction\s+[A-Za-z0-9_]+|\b(?:const|let|var)\s+[A-Za-z0-9_]+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|\bdef\s+[A-Za-z0-9_]+\s*\(|\bfun\s+[A-Za-z0-9_]+\s*\(/.test(
        line
      )
    ) {
      functionCount += 1;
    }

    if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(line)) {
      findings.push({
        rule: 'dynamic-code-execution',
        severity: 'high',
        line: lineNum,
        message: 'Avoid eval() or new Function() on untrusted input due to code-injection risk.',
      });
    }

    if (detectSecretInText(line)) {
      findings.push({
        rule: 'hardcoded-secret-pattern',
        severity: 'high',
        line: lineNum,
        message: 'Potential hardcoded API key or private credential detected; move secrets to server env.',
      });
    }

    if (
      /\b(?:SELECT|INSERT|UPDATE|DELETE)\b[\s\S]{0,80}\$\{/i.test(line) ||
      /\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^;\n]*\+\s*[A-Za-z0-9_]+/i.test(line)
    ) {
      findings.push({
        rule: 'sql-string-interpolation',
        severity: 'high',
        line: lineNum,
        message: 'Possible raw SQL string concatenation/interpolation; use parameterized queries.',
      });
    }

    if (/\bdangerouslySetInnerHTML\b|\.innerHTML\s*=/.test(line)) {
      findings.push({
        rule: 'raw-dom-html-sink',
        severity: 'medium',
        line: lineNum,
        message: 'Raw HTML sink detected; ensure untrusted content is escaped or sanitized against XSS.',
      });
    }

    if (/\bwindow\.(?:alert|confirm|prompt|open)\s*\(/.test(line)) {
      findings.push({
        rule: 'iframe-blocking-dialog',
        severity: 'low',
        line: lineNum,
        message: 'Avoid window.alert/confirm/open in sandboxed iframe environments; use inline UI.',
      });
    }
  });

  if (/catch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(code)) {
    findings.push({
      rule: 'silent-empty-catch',
      severity: 'low',
      line: 1,
      message: 'Empty catch block detected; log sanitized context or surface a structured error state.',
    });
  }

  const trimmedFindings = findings.slice(0, 20);
  const summary =
    trimmedFindings.length === 0
      ? `Static inspection completed across ${lines.length} line(s): 0 high/medium risk patterns detected (code was NOT executed).`
      : `Static inspection identified ${trimmedFindings.length} finding(s) across ${lines.length} line(s) (code was NOT executed).`;

  return {
    language: detectedLang,
    lineCount: lines.length,
    nonEmptyLineCount: nonEmptyLines.length,
    functionOrMethodCount: functionCount,
    executedCode: false,
    findings: trimmedFindings,
    summary,
  };
}

export function buildDeterministicSvgChart(params: {
  title: string;
  chartType: 'bar' | 'line';
  series: { label: string; value: number }[];
  unit?: string;
}): string {
  const items = params.series.slice(0, 10);
  if (items.length === 0) {
    throw new Error('Chart requires at least one data point.');
  }

  const width = 760;
  const height = 390;
  const padLeft = 68;
  const padRight = 34;
  const padTop = 64;
  const padBottom = 68;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = Math.max(...items.map((d) => Math.abs(d.value)), 1);
  const unitSuffix = params.unit ? ` ${escapeXml(params.unit)}` : '';
  const safeTitle = escapeXml(params.title.slice(0, 72));

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = Math.round(padTop + plotH * (1 - ratio));
    const tickVal = Number((maxVal * ratio).toFixed(1));
    return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#8b6ff7" stroke-opacity="0.16" stroke-width="1"/>
    <text x="${padLeft - 10}" y="${y + 4}" text-anchor="end" fill="#a29ab8" font-family="JetBrains Mono, monospace" font-size="11">${tickVal}</text>`;
  });

  let marks = '';
  if (params.chartType === 'bar') {
    const slotW = plotW / items.length;
    const barW = Math.max(18, Math.min(58, slotW * 0.58));
    marks = items
      .map((item, idx) => {
        const val = Math.max(0, item.value);
        const barH = Math.max(3, Math.round((val / maxVal) * plotH));
        const x = Math.round(padLeft + idx * slotW + (slotW - barW) / 2);
        const y = Math.round(padTop + plotH - barH);
        const cx = Math.round(x + barW / 2);
        const shortLabel = escapeXml(item.label.slice(0, 14));
        return `<rect x="${x}" y="${y}" width="${Math.round(barW)}" height="${barH}" rx="6" fill="#8b6ff7" fill-opacity="0.82"/>
        <text x="${cx}" y="${y - 8}" text-anchor="middle" fill="#f1eef9" font-family="JetBrains Mono, monospace" font-size="11">${val}${unitSuffix}</text>
        <text x="${cx}" y="${padTop + plotH + 24}" text-anchor="middle" fill="#b8b0ce" font-family="Plus Jakarta Sans, sans-serif" font-size="11">${shortLabel}</text>`;
      })
      .join('\n');
  } else {
    const stepX = items.length > 1 ? plotW / (items.length - 1) : 0;
    const coords = items.map((item, idx) => {
      const val = Math.max(0, item.value);
      const x = Math.round(padLeft + (items.length > 1 ? idx * stepX : plotW / 2));
      const y = Math.round(padTop + plotH - (val / maxVal) * plotH);
      return { x, y, label: item.label, val };
    });
    const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
    const circles = coords
      .map(
        (c) =>
          `<circle cx="${c.x}" cy="${c.y}" r="4.5" fill="#c6b5fd" stroke="#120f1d" stroke-width="2"/>
          <text x="${c.x}" y="${c.y - 10}" text-anchor="middle" fill="#f1eef9" font-family="JetBrains Mono, monospace" font-size="11">${c.val}${unitSuffix}</text>
          <text x="${c.x}" y="${padTop + plotH + 24}" text-anchor="middle" fill="#b8b0ce" font-family="Plus Jakarta Sans, sans-serif" font-size="11">${escapeXml(c.label.slice(0, 14))}</text>`
      )
      .join('\n');
    marks = `<polyline fill="none" stroke="#8b6ff7" stroke-width="2.5" points="${polylinePoints}"/>\n${circles}`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${safeTitle}">
  <rect width="${width}" height="${height}" rx="14" fill="#100e19"/>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="13" fill="none" stroke="#8b6ff7" stroke-opacity="0.25"/>
  <text x="${padLeft}" y="36" fill="#f5f3fc" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="600">${safeTitle}</text>
  ${gridLines.join('\n  ')}
  ${marks}
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const CalculatorSchema = z.object({
  expression: z.string().trim().min(1).max(160),
});

const DateTimeUtilitySchema = z.object({
  operation: z.enum(['now', 'diff']).default('now'),
  startDate: z.string().trim().max(64).optional(),
  endDate: z.string().trim().max(64).optional(),
  timeZone: z.string().trim().max(64).default('UTC'),
});

const TextSummarizerSchema = z.object({
  text: z.string().trim().min(1).max(20000),
  maxKeyPoints: z.number().int().min(2).max(8).default(5),
});

const TextTransformerSchema = z.object({
  text: z.string().trim().min(1).max(20000),
  mode: z.enum(['stats', 'slug', 'uppercase', 'lowercase', 'markdown_list']).default('stats'),
});

const JsonValidatorSchema = z.object({
  jsonText: z.string().trim().min(1).max(30000),
});

const StructuredFormatterSchema = z.object({
  rawInput: z.string().trim().min(1).max(30000),
  targetFormat: z.enum(['markdown_table', 'json']).default('markdown_table'),
});

const CodeStaticReviewerSchema = z.object({
  code: z.string().trim().min(1).max(30000),
  language: z.string().trim().max(40).optional(),
});

const TaskPlannerSchema = z.object({
  objective: z.string().trim().min(3).max(2000),
  domain: z.enum(['software', 'research', 'strategy', 'general']).default('general'),
});

const DocumentProcessorSchema = z.object({
  query: z.string().trim().min(2).max(1000),
  maxPassages: z.number().int().min(1).max(5).default(3),
});

const CsvAnalyzerSchema = z.object({
  csvText: z.string().trim().min(3).max(40000),
});

const ResearchFrameworkSchema = z.object({
  topic: z.string().trim().min(3).max(1500),
});

const ChartGeneratorSchema = z.object({
  title: z.string().trim().min(2).max(100).default('Data Comparison'),
  chartType: z.enum(['bar', 'line']).default('bar'),
  unit: z.string().trim().max(16).optional(),
  series: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        value: z.number().finite(),
      })
    )
    .min(1)
    .max(10),
});

const WebSearchConnectorSchema = z.object({
  query: z.string().trim().min(2).max(400),
});

const WorkflowConnectorGateSchema = z.object({
  connector: z.enum(['supabase_persistence', 'google_workspace_oauth', 'scheduled_automation']),
  actionSummary: z.string().trim().min(3).max(300),
});

export const TOOL_REGISTRY: Record<ToolName, ToolDefinition<any>> = {
  calculator: {
    name: 'calculator',
    stage: 'A',
    availability: 'available',
    requiresConfirmation: false,
    description: 'Evaluates deterministic arithmetic expressions safely without eval().',
    inputSchema: CalculatorSchema,
    outputSchema: ToolResultPayloadSchema,
    outputSchemaSummary: '{ expression: string, value: number }',
    allowedAgents: ['vaelor-core', 'aurenyx-research', 'vaelor-forge', 'vaelor-analyst'],
    timeoutMs: 1500,
    maxCallsPerTask: 2,
    errorStrategy: 'return_structured_error',
    resultFormat: 'JSON numeric result with normalized expression',
    execute: async ({ expression }) => {
      const value = evaluateSafeMath(expression);
      return {
        formattedOutput: JSON.stringify({ expression, value }),
      };
    },
  },

  datetime_utility: {
    name: 'datetime_utility',
    stage: 'A',
    availability: 'available',
    requiresConfirmation: false,
    description: 'Computes ISO-8601 UTC timestamps, timezone formatting, and exact date intervals.',
    inputSchema: DateTimeUtilitySchema,
    outputSchema: ToolResultPayloadSchema,
    outputSchemaSummary: '{ isoUtc: string, unixSeconds: number, formatted: string }',
    allowedAgents: ['vaelor-core', 'aurenyx-research', 'vaelor-forge', 'vaelor-analyst'],
    timeoutMs: 1500,
    maxCallsPerTask: 2,
    errorStrategy: 'return_structured_error',
    resultFormat: 'ISO-8601 timestamp and optional interval calculation',
    execute: async ({ operation, startDate, endDate, timeZone }) => {
      const now = new Date();
      let formattedZone = now.toISOString();
      try {
        formattedZone = new Intl.DateTimeFormat('en-US', {
          timeZone,
          dateStyle: 'full',
          timeStyle: 'long',
        }).format(now);
      } catch {
        formattedZone = `${now.toISOString()} (UTC fallback; unrecognized timezone '${timeZone}')`;
      }

      if (operation === 'diff' && startDate && endDate) {
        const startMs = Date.parse(startDate);
        const endMs = Date.parse(endDate);
        if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
          throw new Error('Provide valid ISO-8601 dates (YYYY-MM-DD) for startDate and endDate.');
        }
        const diffMs = endMs - startMs;
        return {
          formattedOutput: JSON.stringify(
            {
              startDate,
              endDate,
              daysDifference: Number((diffMs / 86_400_000).toFixed(2)),
              hoursDifference: Number((diffMs / 3_600_000).toFixed(2)),
              referenceUtcNow: now.toISOString(),
            },
            null,
            2
          ),
        };
      }

      return {
        formattedOutput: JSON.stringify(
          {
            isoUtc: now.toISOString(),
            unixSeconds: Math.floor(now.getTime() / 1000),
            timeZone,
            formatted: formattedZone,
          },
          null,
          2
        ),
      };
    },
  },

  text_summarizer: {
    name: 'text_summarizer',
    stage: 'A',
    availability: 'available',
    requiresConfirmation: false,
    description: 'Extracts structural statistics and salient sentences from untrusted user text.',
    inputSchema: TextSummarizerSchema,
    outputSchema: ToolResultPayloadSchema,
    outputSchemaSummary: '{ wordCount: number, sentenceCount: number, salientExcerpts: string[] }',
    allowedAgents: ['vaelor-core', 'aurenyx-research', 'vaelor-analyst', 'vaelor-knowledge'],
    timeoutMs: 2500,
    maxCallsPerTask: 2,
    errorStrategy: 'return_structured_error',
    resultFormat: 'Structural text profile with top salient sentences',
    execute: async ({ text, maxKeyPoints }: { text: string; maxKeyPoints: number }) => {
      const words = text.split(/\s+/).filter(Boolean);
      const sentences = text
        .split(/(?<=[.!?])\s+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 25);
      const selected = sentences.slice(0, maxKeyPoints);
      const summaryPayload = {
        wordCount: words.length,
        sentenceCount: sentences.length,
        salientExcerpts: selected,
      };
      return {
        formattedOutput: wrapUntrustedData(
          'text_summarizer',
          JSON.stringify(summaryPayload, null, 2)
        ),
      };
    },
  },

  text_transformer: {
    name: 'text_transformer',
    stage: 'A',
    availability: 'available',
    requiresConfirmation: false,
    description:
      'Transforms text casing/slugs/lists and calculates word, line, and reading-time metrics.',
    inputSchema: TextTransformerSchema,
    outputSchema: ToolResultPayloadSchema,
    outputSchemaSummary: '{ mode: string, wordCount: number, preview: string }',
    allowedAgents: ['vaelor-core', 'aurenyx-research', 'vaelor-knowledge'],
    timeoutMs: 2000,
    maxCallsPerTask: 2,
    errorStrategy: 'return_structured_error',
    resultFormat: 'Text metrics and transformed output',
    execute: async ({ text, mode }) => {
      const words = text.split(/\s+/).filter(Boolean);
      const lines = text.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
      const readingMinutes = Math.max(1, Math.ceil(words.length / 220));
      let transformed = text;
      if (mode === 'slug') {
        transformed = text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 120);
      } else if (mode === 'uppercase') {
        transformed = text.toUpperCase().slice(0, 4000);
      } else if (mode === 'lowercase') {
        transformed = text.toLowerCase().slice(0, 4000);
      } else if (mode === 'markdown_list') {
        transformed = lines.map((l: string) => `- ${l.trim()}`).join('\n');
      }

      return {
        formattedOutput: JSON.stringify(
          {
            mode,
            charCount: text.length,
            wordCount: words.length,
            nonEmptyLines: lines.length,
            estimatedReadingMinutes: readingMinutes,
            preview: transformed.slice(0, 1200),
          },
          null,
          2
        ),
      };
    },
  },

  json_validator: {
    name: 'json_validator',
    stage: 'A',
    availability: 'available',
    requiresConfirmation: false,
    description:
      'Validates JSON syntax, inspects top-level structure, and formats canonical JSON safely.',
    inputSchema: JsonValidatorSchema,
    outputSchema: ToolResultPayloadSchema,
    outputSchemaSummary: '{ valid: boolean, rootType: string, topLevelKeys: string[] }',
    allowedAgents: ['vaelor-core', 'vaelor-forge', 'vaelor-analyst', 'vaelor-knowledge'],
    timeoutMs: 2000,
    maxCallsPerTask: 2,
    errorStrategy: 'return_structured_error',
    resultFormat: 'JSON validity report, root schema keys, and pretty-printed preview',
    execute: async ({ jsonText }) => {
      const report = inspectAndFormatJson(jsonText);
      return {
        formattedOutput: wrapUntrustedData('json_validator', JSON.stringify(report, null, 2)),
      };
    },
  },

  structured_formatter: {
    name: 'structured_formatter',
    stage: 'A',
    availability: 'available',
    requiresConfirmation: false,
    description:
      'Normalizes JSON objects, CSV rows, or key-value lists into clean Markdown tables or canonical JSON.',
    inputSchema: StructuredFormatterSchema,
    outputSchema: ToolResultPayloadSchema,
    outputSchemaSummary: '{ targetFormat: "markdown_table" | "json", rowCount: number, formatted: string }',
    allowedAgents: [
      'vaelor-core',
      'aurenyx-research',
      'vaelor-forge',
      'vaelor-analyst',
      'vaelor-knowledge',
    ],
    timeoutMs: 2000,
    maxCallsPerTask: 2,
    errorStrategy: 'return_structured_error',
    resultFormat: 'Markdown table or canonical JSON array',
    execute: async ({ rawInput, targetFormat }) => {
      const res = formatStructuredContent(rawInput, targetFormat);
      return {
        formattedOutput: wrapUntrustedData('structured_formatter', JSON.stringify(res, null, 2)),
      };
    },
  },

  code_static_reviewer: {
    name: 'code_static_reviewer',
    stage: 'A',
    availability: 'available',
    requiresConfirmation: false,
    description:
      'Performs deterministic static security and quality inspection on pasted code without executing it.',
    inputSchema: CodeStaticReviewerSchema,
    outputSchema: ToolResultPayloadSchema,
    outputSchemaSummary:
      '{ language: string, lineCount: number, executedCode: false, findings: StaticCodeFinding[] }',
    allowedAgents: ['vaelor-forge', 'vaelor-core'],
    timeoutMs: 2000,
    maxCallsPerTask: 2,
    errorStrategy: 'return_structured_error',
    resultFormat: 'Static security & code quality report (non-executing)',
    execute: async ({ code, language }: { code: string; language?: string }) => {
      const report = analyzeCodeStatically(code, language);
      return {
        formattedOutput: wrapUntrustedData('code_static_reviewer', JSON.stringify(report, null, 2)),
      };
    },
  },

  task_planner: {
    name: 'task_planner',
    stage: 'A',
    availability: 'available',
    requiresConfirmation: false,
    description:
      'Generates a bounded milestone checklist and verification criteria for complex objectives.',
    inputSchema: TaskPlannerSchema,
    outputSchema: ToolResultPayloadSchema,
    outputSchemaSummary: '{ objective: string, domain: string, boundedStages: string[] }',
    allowedAgents: ['vaelor-core', 'aurenyx-research', 'vaelor-forge', 'vaelor-analyst'],
    timeoutMs: 2000,
    maxCallsPerTask: 1,
    errorStrategy: 'return_structured_error',
    resultFormat: 'Structured 4-stage execution blueprint',
    execute: async ({ objective, domain }) => {
      const stages =
        domain === 'software'
          ? [
              '1. Requirements & Threat Boundary Definition',
              '2. Data Schema & API Contract Validation',
              '3. Modular Implementation (₹0 Free-Tier Compatible)',
              '4. Deterministic Unit & Acceptance Verification',
            ]
          : [
              '1. Scope & Core Objective Framing',
              '2. Constraint & Resource Inventory',
              '3. Phased Execution Milestones',
              '4. Risk Review & Measurable Verification',
            ];
      return {
        formattedOutput: JSON.stringify(
          {
            objective: objective.slice(0, 240),
            domain,
            boundedStages: stages,
          },
          null,
          2
        ),
      };
    },
  },

  document_processor: {
    name: 'document_processor',
    stage: 'A',
    availability: 'available',
    requiresConfirmation: false,
    description:
      'Searches indexed session documents and explicitly saved user memories for passages matching the query.',
    inputSchema: DocumentProcessorSchema,
    outputSchema: ToolResultPayloadSchema,
    outputSchemaSummary: '{ retrievedPassages: Passage[], savedMemories: Memory[], citations: Citation[] }',
    allowedAgents: ['vaelor-knowledge'],
    timeoutMs: 3000,
    maxCallsPerTask: 2,
    errorStrategy: 'return_structured_error',
    resultFormat: 'Ranked untrusted document excerpts with genuine citation metadata',
    execute: async ({ query, maxPassages }: { query: string; maxPassages: number }, context) => {
      const terms = query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w: string) => w.length >= 3 && !STOP_WORDS.has(w));

      const scored: {
        score: number;
        docId: string;
        docTitle: string;
        chunkIndex: number;
        text: string;
      }[] = [];

      for (const doc of context.documents) {
        for (const chunk of doc.chunks) {
          const hay = chunk.text.toLowerCase();
          let score = 0;
          for (const term of terms) {
            if (hay.includes(term)) {
              score += 2;
            }
          }
          if (doc.title.toLowerCase().split(/\s+/).some((t) => terms.includes(t))) {
            score += 1.5;
          }
          if (score === 0 && context.documents.length <= 3 && chunk.index === 0) {
            score = 0.5;
          }
          if (score > 0) {
            scored.push({
              score,
              docId: doc.id,
              docTitle: doc.title,
              chunkIndex: chunk.index + 1,
              text: chunk.text,
            });
          }
        }
      }

      scored.sort((a, b) => b.score - a.score);
      const topChunks = scored.slice(0, maxPassages);

      const citations: CitationItem[] = topChunks.map((item, idx) => ({
        id: `cit-${idx + 1}-${item.docId.slice(0, 6)}`,
        sourceTitle: `${item.docTitle} (Passage #${item.chunkIndex})`,
        sourceType: 'document',
        excerpt: item.text.slice(0, 260),
        documentId: item.docId,
        chunkIndex: item.chunkIndex,
      }));

      const relevantMemories = context.memories.slice(0, 5);
      for (const mem of relevantMemories) {
        if (
          terms.some(
            (t: string) =>
              mem.content.toLowerCase().includes(t) || mem.label.toLowerCase().includes(t)
          )
        ) {
          citations.push({
            id: `cit-mem-${mem.id.slice(0, 6)}`,
            sourceTitle: `Saved Memory: ${mem.label}`,
            sourceType: 'memory',
            excerpt: mem.content.slice(0, 220),
          });
        }
      }

      const payload = {
        indexedDocumentCount: context.documents.length,
        savedMemoryCount: context.memories.length,
        retrievedPassages: topChunks.map((c) => ({
          documentTitle: c.docTitle,
          passageNumber: c.chunkIndex,
          excerpt: c.text,
        })),
        savedMemories: relevantMemories.map((m) => ({
          label: m.label,
          category: m.category,
          content: m.content,
        })),
      };

      return {
        formattedOutput: wrapUntrustedData(
          'document_processor',
          JSON.stringify(payload, null, 2)
        ),
        citations,
      };
    },
  },

  csv_analyzer: {
    name: 'csv_analyzer',
    stage: 'B',
    availability: 'available',
    requiresConfirmation: false,
    description:
      'Computes deterministic CSV dataset row/column counts, missing-value audits, and numeric column statistics (min, max, mean, sum).',
    inputSchema: CsvAnalyzerSchema,
    outputSchema: ToolResultPayloadSchema,
    outputSchemaSummary: '{ rowCount: number, columnCount: number, columns: CsvColumnSummary[] }',
    allowedAgents: [
      'vaelor-core',
      'aurenyx-research',
      'vaelor-forge',
      'vaelor-analyst',
      'vaelor-knowledge',
    ],
    timeoutMs: 2500,
    maxCallsPerTask: 2,
    errorStrategy: 'return_structured_error',
    resultFormat: 'Structured CSV statistical profile',
    execute: async ({ csvText }) => {
      const analysis = analyzeCsvDataset(csvText);
      return {
        formattedOutput: wrapUntrustedData('csv_analyzer', JSON.stringify(analysis, null, 2)),
      };
    },
  },

  research_framework: {
    name: 'research_framework',
    stage: 'B',
    availability: 'available',
    requiresConfirmation: false,
    description:
      'Constructs an evidence-grading matrix separating Verified Facts, Working Assumptions, and Open Unknowns.',
    inputSchema: ResearchFrameworkSchema,
    outputSchema: ToolResultPayloadSchema,
    outputSchemaSummary: '{ topic: string, groundedSearchMode: string, evidenceRubric: string[] }',
    allowedAgents: ['aurenyx-research'],
    timeoutMs: 2000,
    maxCallsPerTask: 1,
    errorStrategy: 'graceful_fallback_notice',
    resultFormat: 'Structured inquiry matrix + live search connectivity status',
    execute: async ({ topic }, context) => {
      const gatewayStatus = context.gateway?.getStatus();
      const groundedMode = gatewayStatus?.groundedSearchMode ?? 'unavailable';
      const searchConfigured = Boolean(
        process.env.SEARCH_API_KEY?.trim() || gatewayStatus?.liveSearchConfigured
      );
      return {
        formattedOutput: JSON.stringify(
          {
            topic: topic.slice(0, 240),
            liveSearchConnected: searchConfigured && !context.mockMode,
            groundedSearchMode: context.mockMode ? 'mock-mode-disabled' : groundedMode,
            connectivityNotice:
              searchConfigured && !context.mockMode
                ? 'Server-side search grounding adapter is configured; cite URLs strictly when web_search_connector returns verified groundingChunks.'
                : 'No live web search results are active for this run. Distinguish established domain knowledge from time-sensitive metrics requiring external primary-source lookup.',
            evidenceRubric: [
              '1. Direct Answer & Key Findings: Concise synthesis of verified facts',
              '2. Evidence & Citations: Verbatim passages or grounded web URLs retrieved in this run',
              '3. Uncertainties & Limitations: Current pricing, live benchmarks, or unverified claims requiring primary sources',
            ],
          },
          null,
          2
        ),
      };
    },
  },

  chart_generator: {
    name: 'chart_generator',
    stage: 'C',
    availability: 'available',
    requiresConfirmation: false,
    description:
      'Generates deterministic, zero-cost SVG bar and line charts from structured label/value numeric series.',
    inputSchema: ChartGeneratorSchema,
    outputSchema: ToolResultPayloadSchema,
    outputSchemaSummary: '{ title: string, chartType: "bar" | "line", pointCount: number, svgArtifact: string }',
    allowedAgents: ['vaelor-core', 'aurenyx-research', 'vaelor-forge', 'vaelor-analyst'],
    timeoutMs: 2000,
    maxCallsPerTask: 1,
    errorStrategy: 'return_structured_error',
    resultFormat: 'SVG vector chart artifact + numeric series summary',
    execute: async ({ title, chartType, series, unit }) => {
      const svg = buildDeterministicSvgChart({ title, chartType, series, unit });
      return {
        formattedOutput: JSON.stringify(
          {
            title,
            chartType,
            pointCount: series.length,
            unit: unit || null,
            series,
          },
          null,
          2
        ),
        svgArtifact: svg,
      };
    },
  },

  web_search_connector: {
    name: 'web_search_connector',
    stage: 'B',
    availability:
      process.env.GEMINI_API_KEY?.trim() || process.env.SEARCH_API_KEY?.trim()
        ? 'available'
        : 'requires_config',
    requiresConfirmation: false,
    description:
      'Server-side grounded web search via Gemini Google Search Grounding (or SEARCH_API_KEY). Never fabricates URLs when unavailable.',
    inputSchema: WebSearchConnectorSchema,
    outputSchema: ToolResultPayloadSchema,
    outputSchemaSummary: '{ status: "ok" | "no_sources" | "unavailable", sources: { title, url }[] }',
    allowedAgents: ['aurenyx-research'],
    timeoutMs: 12_500,
    maxCallsPerTask: 1,
    errorStrategy: 'graceful_fallback_notice',
    resultFormat: 'Verified grounded web citations or transparent unavailability notice',
    setupGuide:
      'Uses server-side GEMINI_API_KEY Google Search Grounding automatically when quota permits, or optional SEARCH_API_KEY.',
    execute: async ({ query }, context) => {
      if (context.mockMode) {
        return {
          formattedOutput: JSON.stringify(
            {
              query,
              liveSearchConnected: false,
              status: 'mock_mode',
              message:
                'Local Mock Mode is active: external live web search was intentionally skipped. Do not invent URLs or live citations.',
            },
            null,
            2
          ),
          citations: [],
        };
      }

      if (context.gateway?.searchGroundedWeb) {
        const grounded = await context.gateway.searchGroundedWeb(query, {
          timeoutMs: 11_000,
          signal: context.signal,
        });

        if (grounded.status === 'ok' && grounded.citations.length > 0) {
          return {
            formattedOutput: wrapUntrustedData(
              'web_search_results',
              JSON.stringify(
                {
                  query,
                  liveSearchConnected: true,
                  status: 'ok',
                  sourceCount: grounded.citations.length,
                  summary: grounded.summaryText,
                  sources: grounded.citations.map((c) => ({
                    title: c.sourceTitle,
                    url: c.url,
                  })),
                },
                null,
                2
              )
            ),
            citations: grounded.citations,
          };
        }

        return {
          formattedOutput: JSON.stringify(
            {
              query,
              liveSearchConnected: false,
              status: grounded.status,
              message: grounded.note,
            },
            null,
            2
          ),
          citations: [],
        };
      }

      const searchKey = process.env.SEARCH_API_KEY?.trim();
      if (!searchKey) {
        return {
          formattedOutput: JSON.stringify(
            {
              query,
              liveSearchConnected: false,
              status: 'requires_config',
              message:
                'Live web search is not configured on this server. Do not invent URLs or live search results.',
            },
            null,
            2
          ),
          citations: [],
        };
      }

      return {
        formattedOutput: JSON.stringify({
          query,
          liveSearchConnected: false,
          status: 'requires_config',
          note: 'SEARCH_API_KEY detected; external search adapter not bound in this runtime.',
        }),
        citations: [],
      };
    },
  },

  workflow_connector_gate: {
    name: 'workflow_connector_gate',
    stage: 'D',
    availability: 'requires_config',
    requiresConfirmation: true,
    description:
      'User-authorized Stage D workflow gate for external connectors (Supabase Cloud Sync, Workspace OAuth, Scheduled Jobs).',
    inputSchema: WorkflowConnectorGateSchema,
    outputSchema: ToolResultPayloadSchema,
    outputSchemaSummary: '{ connector: string, confirmedByUser: boolean, connectorStatus: string }',
    allowedAgents: ['vaelor-core'],
    timeoutMs: 2000,
    maxCallsPerTask: 1,
    errorStrategy: 'return_structured_error',
    resultFormat: 'Authorization audit & connector readiness status',
    setupGuide:
      'Requires explicit per-action user confirmation plus connector credentials (SUPABASE_URL / OAuth client) on the server.',
    execute: async ({ connector, actionSummary }, context) => {
      if (!context.confirmedByUser) {
        throw new Error(
          `User authorization required: Stage D connector '${connector}' cannot run without explicit user confirmation.`
        );
      }
      return {
        formattedOutput: JSON.stringify(
          {
            connector,
            actionSummary,
            confirmedByUser: true,
            connectorStatus: 'requires_config',
            notice:
              'Authorization gate verified, but external connector credentials are not configured in ₹0 local/ephemeral mode. No external write was performed.',
          },
          null,
          2
        ),
      };
    },
  },
};

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'what',
  'how',
  'are',
  'was',
  'were',
  'have',
  'has',
  'about',
  'into',
  'summarize',
  'analyze',
  'document',
]);

export async function executeToolWithPermissions(params: {
  agentId: AgentId;
  toolName: string;
  rawArgs: Record<string, unknown>;
  context: ToolExecutionContext;
}): Promise<{ record: ToolCallRecord; citations: CitationItem[] }> {
  const started = Date.now();
  const agent = AGENT_DEFINITIONS[params.agentId];

  // 1. Verify tool exists in registry
  if (!Object.prototype.hasOwnProperty.call(TOOL_REGISTRY, params.toolName)) {
    return {
      record: {
        tool: params.toolName,
        input: params.rawArgs,
        output: '',
        status: 'denied',
        durationMs: Date.now() - started,
        error: `Unauthorized or unregistered tool '${params.toolName}' rejected by Tool Gateway.`,
      },
      citations: [],
    };
  }

  const typedName = params.toolName as ToolName;
  const toolDef = TOOL_REGISTRY[typedName];

  // 2. Enforce strict per-agent allowlist
  if (!agent.permittedTools.includes(typedName) || !toolDef.allowedAgents.includes(params.agentId)) {
    return {
      record: {
        tool: typedName,
        input: params.rawArgs,
        output: '',
        status: 'denied',
        durationMs: Date.now() - started,
        error: `Permission denied: ${agent.name} is not authorized to invoke '${typedName}'.`,
      },
      citations: [],
    };
  }

  // 3. Enforce Stage D explicit user confirmation gate
  if (toolDef.requiresConfirmation && !params.context.confirmedByUser) {
    return {
      record: {
        tool: typedName,
        input: params.rawArgs,
        output: '',
        status: 'denied',
        durationMs: Date.now() - started,
        error: `User confirmation required before executing Stage ${toolDef.stage} workflow tool '${typedName}'.`,
      },
      citations: [],
    };
  }

  // 4. Validate input arguments against server-side Zod schema
  const parsed = toolDef.inputSchema.safeParse(params.rawArgs);
  if (!parsed.success) {
    return {
      record: {
        tool: typedName,
        input: params.rawArgs,
        output: '',
        status: 'failed',
        durationMs: Date.now() - started,
        error: parsed.error.issues[0]?.message || `Invalid tool arguments for '${typedName}'.`,
      },
      citations: [],
    };
  }

  // 5. Execute within strict timeout boundary & validate output schema
  try {
    const rawResult = await withTimeout(
      toolDef.execute(parsed.data, params.context),
      toolDef.timeoutMs,
      `Tool '${typedName}' timed out after ${toolDef.timeoutMs}ms.`
    );

    const validatedOut = toolDef.outputSchema.safeParse(rawResult);
    if (!validatedOut.success) {
      return {
        record: {
          tool: typedName,
          input: parsed.data as Record<string, unknown>,
          output: '',
          status: 'failed',
          durationMs: Date.now() - started,
          error: `Tool '${typedName}' output failed schema validation.`,
        },
        citations: [],
      };
    }

    const result = validatedOut.data as ToolResultPayload;
    const boundedOutput =
      result.formattedOutput.length > MAX_TOOL_OUTPUT_CHARS
        ? `${result.formattedOutput.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n...[truncated at ${MAX_TOOL_OUTPUT_CHARS.toLocaleString()}-char tool safety limit]`
        : result.formattedOutput;
    return {
      record: {
        tool: typedName,
        input: parsed.data as Record<string, unknown>,
        output: boundedOutput,
        status: 'completed',
        durationMs: Date.now() - started,
        svgArtifact: result.svgArtifact,
      },
      citations: result.citations ?? [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Tool execution failed safely.';
    return {
      record: {
        tool: typedName,
        input: parsed.data as Record<string, unknown>,
        output: '',
        status: 'failed',
        durationMs: Date.now() - started,
        error: message,
      },
      citations: [],
    };
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
