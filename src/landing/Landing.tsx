import type { AuthUser } from "../types";
import type { Route } from "../lib/router";
import type { Navigate } from "./Chrome";
import HomePage from "./HomePage";
import { AboutPage, LegalPage, PricingPage, SecurityPage } from "./Pages";
import DocsPage from "../docs/DocsPage";

export default function Landing({
  page, onNavigate, user, slug,
}: {
  page: Route;
  onNavigate: Navigate;
  user?: AuthUser | null;
  slug?: string;
}) {
  switch (page) {
    case "docs":
      return <DocsPage slug={slug} onNavigate={onNavigate} user={user} />;
    case "pricing":
      return <PricingPage onNavigate={onNavigate} user={user} />;
    case "security":
      return <SecurityPage onNavigate={onNavigate} user={user} />;
    case "about":
      return <AboutPage onNavigate={onNavigate} user={user} />;
    case "privacy":
      return <LegalPage kind="privacy" onNavigate={onNavigate} user={user} />;
    case "terms":
      return <LegalPage kind="terms" onNavigate={onNavigate} user={user} />;
    default:
      return <HomePage onNavigate={onNavigate} user={user} />;
  }
}
