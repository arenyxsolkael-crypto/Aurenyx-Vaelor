/**
 * Pure Markdown & URL Safety Utilities (VAELOR v0.3 Phase 8 & 10).
 * Neutralizes dangerous link protocols (javascript:, data:, vbscript:, file:)
 * and detects raw executable HTML/event-handler payloads so untrusted model
 * or retrieved text cannot execute scripts in the browser.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function isSafeExternalUrl(rawUrl: string): boolean {
  if (typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  // Reject control characters or whitespace obfuscation inside scheme
  if (/[\u0000-\u001F\u007F\s]/.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    return ALLOWED_PROTOCOLS.has(parsed.protocol.toLowerCase());
  } catch {
    return false;
  }
}

export function sanitizeMarkdownUrl(rawUrl: string): string | null {
  if (!isSafeExternalUrl(rawUrl)) return null;
  return rawUrl.trim();
}

export interface ParsedMarkdownLink {
  label: string;
  href: string | null;
  blockedScheme?: string;
}

/**
 * Parses a `[label](target)` Markdown token and validates the target URL.
 * Unsafe protocols (`javascript:`, `data:text/html`, `vbscript:`, etc.) return `href: null`
 * so the renderer outputs inert plain text instead of an executable anchor.
 */
export function parseSafeMarkdownLink(token: string): ParsedMarkdownLink | null {
  const match = token.match(/^\[([^\]]+)\]\(((?:[^()\n]|\([^()\n]*\))+)\)$/);
  if (!match) return null;
  const label = match[1] ?? '';
  const rawTarget = (match[2] ?? '').trim();
  const safeHref = sanitizeMarkdownUrl(rawTarget);
  if (safeHref) {
    return { label, href: safeHref };
  }
  const schemeMatch = rawTarget.replace(/\s+/g, '').match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  return {
    label,
    href: null,
    blockedScheme: schemeMatch ? `${schemeMatch[1].toLowerCase()}:` : 'unsafe-url',
  };
}

const RAW_EXECUTABLE_HTML_PATTERNS: RegExp[] = [
  /<\s*script\b/i,
  /<\s*iframe\b/i,
  /<\s*object\b/i,
  /<\s*embed\b/i,
  /<\s*svg\b[^>]*\bon[a-z]+\s*=/i,
  /<\s*[a-z][^>]*\bon(?:error|load|click|mouseover|focus)\s*=/i,
];

export function containsRawExecutableHtml(input: string): boolean {
  return RAW_EXECUTABLE_HTML_PATTERNS.some((re) => re.test(input));
}

export interface MarkdownSafetyAudit {
  safeLinks: string[];
  blockedLinks: { label: string; blockedScheme: string }[];
  rawExecutableHtmlDetected: boolean;
}

/**
 * Audits a Markdown document for link safety and raw executable HTML tags.
 * Used by deterministic unit tests and Sentinel link checks.
 */
export function auditMarkdownSafety(markdown: string): MarkdownSafetyAudit {
  const safeLinks: string[] = [];
  const blockedLinks: { label: string; blockedScheme: string }[] = [];
  const linkRegex = /\[([^\]]+)\]\(((?:[^()\n]|\([^()\n]*\))+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(markdown)) !== null) {
    const parsed = parseSafeMarkdownLink(match[0]);
    if (!parsed) continue;
    if (parsed.href) {
      safeLinks.push(parsed.href);
    } else {
      blockedLinks.push({
        label: parsed.label,
        blockedScheme: parsed.blockedScheme || 'unsafe-url',
      });
    }
  }

  return {
    safeLinks,
    blockedLinks,
    rawExecutableHtmlDetected: containsRawExecutableHtml(markdown),
  };
}
