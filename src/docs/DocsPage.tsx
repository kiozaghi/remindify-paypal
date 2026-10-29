import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent } from "react";
import { Icon } from "../components/Icon";
import type { AuthUser } from "../types";
import { NAV_EVENT } from "../lib/router";
import type { Navigate } from "../landing/Chrome";
import { PublicFooter, PublicNav, spaClick } from "../landing/Chrome";
import {
  DOCS_GROUPS, DOCS_PAGES, docsHref, docsNeighbours, docsPage,
} from "./pages";
import { renderMarkdown } from "./markdown";

type DocsPageProps = {
  slug?: string;
  onNavigate: Navigate;
  user?: AuthUser | null;
};

function score(query: string, page: (typeof DOCS_PAGES)[number]) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const label = page.label.toLowerCase();
  const title = page.title.toLowerCase();
  const summary = `${page.description} ${page.keywords}`.toLowerCase();
  const body = page.body.toLowerCase();
  let total = 0;
  for (const word of words) {
    if (label.includes(word)) total += 5;
    else if (title.includes(word)) total += 4;
    else if (summary.includes(word)) total += 2;
    else if (body.includes(word)) total += 1;
    else return -1;
  }
  return total;
}

export default function DocsPage({ slug, onNavigate, user }: DocsPageProps) {
  const page = docsPage(slug);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHeading, setActiveHeading] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const rendered = useMemo(() => renderMarkdown(page?.body || ""), [page?.body]);
  const results = useMemo(() => {
    if (!query) return [];
    return DOCS_PAGES
      .map((item) => ({ item, rank: score(query, item) }))
      .filter((entry) => entry.rank >= 0)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 8)
      .map((entry) => entry.item);
  }, [query]);
  const { previous, next } = docsNeighbours(slug);

  useEffect(() => {
    setMenuOpen(false);
  }, [slug]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!rendered.toc.length) {
      setActiveHeading("");
      return;
    }
    const elements = rendered.toc
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!elements.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActiveHeading(visible.target.id);
      },
      { rootMargin: "-96px 0px -72% 0px", threshold: 0 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [rendered]);

  const go = (target?: string) => {
    setMenuOpen(false);
    setQuery("");
    onNavigate("docs", target ? { slug: target } : undefined);
  };

  const jump = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
    setActiveHeading(id);
  };

  const onContentClick = async (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const copy = target.closest<HTMLButtonElement>("[data-copy]");
    if (copy) {
      const code = copy.closest(".docs-code")?.querySelector("code")?.textContent || "";
      try {
        await navigator.clipboard.writeText(code);
        copy.textContent = "Copied";
        copy.dataset.copied = "true";
        window.setTimeout(() => {
          copy.textContent = "Copy";
          delete copy.dataset.copied;
        }, 1600);
      } catch {
        copy.textContent = "Press ⌘C";
      }
      return;
    }

    const anchor = target.closest("a");
    if (!anchor) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = anchor.getAttribute("href") || "";

    if (href.startsWith("#")) {
      jump(event as unknown as MouseEvent<HTMLAnchorElement>, href.slice(1));
      return;
    }
    if (!href.startsWith("/") || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

    event.preventDefault();
    const docs = href.match(/^\/docs(?:\/([^?#]+))?/);
    if (docs) {
      go(docs[1]);
      return;
    }
    window.history.pushState(null, "", href);
    window.dispatchEvent(new Event(NAV_EVENT));
  };

  const onSearchKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setQuery("");
      event.currentTarget.blur();
      return;
    }
    if (event.key === "Enter" && results[0]) {
      event.preventDefault();
      go(results[0].slug);
    }
  };

  return (
    <div className="landing public-page docs-page page-docs">
      <PublicNav page="docs" onNavigate={onNavigate} user={user} />

      <main className="docs-main">
        <div className="docs-shell">
          <aside className={`docs-side ${menuOpen ? "open" : ""}`}>
            <div className="docs-search">
              <Icon name="search" size={14} />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKey}
                placeholder="Search docs"
                aria-label="Search documentation"
                autoComplete="off"
              />
              <kbd>⌘K</kbd>
              {query && (
                <div className="docs-search-results">
                  {results.length ? results.map((result) => (
                    <a
                      key={result.slug}
                      href={docsHref(result.slug)}
                      onClick={spaClick(() => go(result.slug))}
                    >
                      <span>{result.label}</span>
                      <em>{result.group}</em>
                    </a>
                  )) : (
                    <p>No page matches “{query}”.</p>
                  )}
                </div>
              )}
            </div>

            <nav className="docs-side-nav" aria-label="Documentation">
              {DOCS_GROUPS.map((group) => (
                <div key={group} className="docs-group">
                  <span className="eyebrow">{group}</span>
                  {DOCS_PAGES.filter((item) => item.group === group).map((item) => (
                    <a
                      key={item.slug || "index"}
                      href={docsHref(item.slug)}
                      onClick={spaClick(() => go(item.slug))}
                      className={page?.slug === item.slug ? "on" : ""}
                      aria-current={page?.slug === item.slug ? "page" : undefined}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              ))}
            </nav>

            <div className="docs-side-foot">
              <span className="eyebrow">Preview API</span>
              <p>Machine endpoints are live. Billing and proof uploads are still in preview.</p>
              <a href={docsHref("reference/api")} onClick={spaClick(() => go("reference/api"))}>
                Read the reference <Icon name="arrowRight" size={12} />
              </a>
            </div>
          </aside>

          <div className="docs-content">
            <div className="docs-top">
              <button
                type="button"
                className="docs-menu-btn"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
              >
                <Icon name={menuOpen ? "x" : "menu"} size={15} />
                Docs menu
              </button>
              <span className="docs-crumb">
                <a href={docsHref("")} onClick={spaClick(() => go(""))}>Docs</a>
                {page && (
                  <>
                    <Icon name="chevronRight" size={10} />
                    <span>{page.group}</span>
                    <Icon name="chevronRight" size={10} />
                    <strong>{page.label}</strong>
                  </>
                )}
              </span>
            </div>

            {page ? (
              <>
                <article
                  className="docs-body"
                  onClick={onContentClick}
                  dangerouslySetInnerHTML={{ __html: rendered.html }}
                />
                <nav className="docs-pager" aria-label="Documentation pages">
                  {previous ? (
                    <a
                      className="docs-pager-prev"
                      href={docsHref(previous.slug)}
                      onClick={spaClick(() => go(previous.slug))}
                    >
                      <span><Icon name="chevronLeft" size={12} /> Previous</span>
                      <strong>{previous.label}</strong>
                    </a>
                  ) : <span />}
                  {next ? (
                    <a
                      className="docs-pager-next"
                      href={docsHref(next.slug)}
                      onClick={spaClick(() => go(next.slug))}
                    >
                      <span>Next <Icon name="chevronRight" size={12} /></span>
                      <strong>{next.label}</strong>
                    </a>
                  ) : <span />}
                </nav>
              </>
            ) : (
              <div className="docs-missing">
                <span className="eyebrow">404 · not in the manual</span>
                <h1>This page is not in the docs.</h1>
                <p>The link may be old, or the page may have moved. Start from the overview or search the sidebar.</p>
                <a className="btn btn-ink btn-sm" href={docsHref("")} onClick={spaClick(() => go(""))}>
                  Back to the docs <Icon name="arrowRight" size={13} />
                </a>
              </div>
            )}
          </div>

          {rendered.toc.length > 1 && (
            <aside className="docs-toc">
              <span className="eyebrow">On this page</span>
              {rendered.toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(event) => jump(event, item.id)}
                  className={`${item.depth === 3 ? "sub" : ""} ${activeHeading === item.id ? "on" : ""}`}
                >
                  {item.text}
                </a>
              ))}
            </aside>
          )}
        </div>
      </main>

      <PublicFooter onNavigate={onNavigate} user={user} />
    </div>
  );
}
