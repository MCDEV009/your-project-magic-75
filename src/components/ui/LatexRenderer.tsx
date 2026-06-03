import { useMemo } from 'react';
import katex from 'katex';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
  text: string;
  className?: string;
}

const renderMath = (math: string, displayMode: boolean) => {
  try {
    return katex.renderToString(math, {
      throwOnError: false,
      displayMode,
      strict: 'ignore',
      trust: false,
      output: 'html',
    });
  } catch {
    return `<code class="px-1 rounded bg-muted text-foreground/80">${math}</code>`;
  }
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const LatexRenderer = ({ text, className }: LatexRendererProps) => {
  const rendered = useMemo(() => {
    if (!text) return '';

    // Tokenize so we can escape plain text but keep rendered math HTML intact.
    // Order matters: longer / display delimiters first.
    const patterns: { re: RegExp; display: boolean }[] = [
      { re: /\$\$([\s\S]+?)\$\$/g, display: true },
      { re: /\\\[([\s\S]+?)\\\]/g, display: true },
      { re: /\\\(([\s\S]+?)\\\)/g, display: false },
      { re: /\$([^\n$]+?)\$/g, display: false },
    ];

    type Part = { type: 'text' | 'math'; value: string; display?: boolean };
    let parts: Part[] = [{ type: 'text', value: text }];

    for (const { re, display } of patterns) {
      const next: Part[] = [];
      for (const p of parts) {
        if (p.type !== 'text') { next.push(p); continue; }
        let lastIdx = 0;
        const src = p.value;
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src)) !== null) {
          if (m.index > lastIdx) next.push({ type: 'text', value: src.slice(lastIdx, m.index) });
          next.push({ type: 'math', value: m[1], display });
          lastIdx = m.index + m[0].length;
        }
        if (lastIdx < src.length) next.push({ type: 'text', value: src.slice(lastIdx) });
      }
      parts = next;
    }

    // Auto-detect: a text part that is entirely a LaTeX expression without delimiters
    // (starts with \ command or contains \frac/\sqrt/^/_ with braces) → render as math.
    const looksLikeBareLatex = (s: string) =>
      /^\s*\\[a-zA-Z]+(\{|\[|\s|$)/.test(s) ||
      /\\(frac|sqrt|sum|int|lim|left|right|begin|end|cdot|times|alpha|beta|gamma|theta|pi|infty)\b/.test(s);

    const html = parts
      .map((p) => {
        if (p.type === 'math') return renderMath(p.value, !!p.display);
        if (looksLikeBareLatex(p.value)) {
          // Render the whole chunk as inline math
          return renderMath(p.value.trim(), false);
        }
        // Plain text: escape and keep line breaks
        return escapeHtml(p.value).replace(/\n/g, '<br/>');
      })
      .join('');

    return DOMPurify.sanitize(html, {
      ADD_TAGS: ['math', 'mrow', 'mi', 'mn', 'mo', 'msup', 'msub', 'mfrac', 'msqrt', 'mtext', 'semantics', 'annotation'],
      ADD_ATTR: ['xmlns', 'mathvariant', 'class', 'style', 'aria-hidden'],
    });
  }, [text]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
};

export default LatexRenderer;
