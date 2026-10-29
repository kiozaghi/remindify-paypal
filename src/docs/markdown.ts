import { Marked } from "marked";
import type { Tokens } from "marked";

export type TocItem = { id: string; text: string; depth: number };

export type RenderedDoc = { html: string; toc: TocItem[] };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function headingSlug(text: string) {
  const clean = text
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[`*_~]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return clean || "section";
}

/** Render authored markdown with stable heading ids and a table of contents. */
export function renderMarkdown(markdown: string): RenderedDoc {
  const toc: TocItem[] = [];
  const seen = new Map<string, number>();

  const marked = new Marked({
    gfm: true,
    renderer: {
      heading(token: Tokens.Heading) {
        const html = this.parser.parseInline(token.tokens);
        const text = html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        const base = headingSlug(text);
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        const id = count ? `${base}-${count}` : base;
        if (token.depth === 2 || token.depth === 3) toc.push({ id, text, depth: token.depth });
        return `<h${token.depth} id="${id}">${html}<a class="docs-anchor" href="#${id}" aria-label="Link to ${escapeHtml(text)}">#</a></h${token.depth}>`;
      },
      code(token: Tokens.Code) {
        const language = (token.lang || "").split(/\s+/)[0];
        const label = language || "text";
        return [
          `<div class="docs-code">`,
          `<div class="docs-code-bar"><span class="docs-code-lang">${escapeHtml(label)}</span>`,
          `<button type="button" class="docs-copy" data-copy>Copy</button></div>`,
          `<pre><code class="language-${escapeHtml(label)}">${escapeHtml(token.text)}</code></pre>`,
          `</div>`,
        ].join("");
      },
    },
  });

  const html = marked.parse(markdown, { async: false }) as string;
  return { html, toc };
}
