import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth";
import { Icon } from "../components/Icon";
import { Logo } from "../components/Logo";
import { isAppRoute, type AppRoute, type Route } from "../lib/router";
import type { Navigate } from "./Chrome";
import { SectionTag } from "./Chrome";

const NOTICES: Record<string, string> = {
  google_not_configured: "Google sign-in isn’t available on this build yet. Use email or a wallet instead.",
  google_state: "That Google sign-in link expired. Please try again.",
  google_failed: "Google sign-in didn’t complete. Try again, or continue with email.",
};

function GoogleGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.94v2.33A9 9 0 009 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 013.69 9c0-.6.1-1.18.28-1.72V4.95H.94A9 9 0 000 9c0 1.45.35 2.82.94 4.05l3.03-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58A8.65 8.65 0 009 0 9 9 0 00.94 4.95l3.03 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function nextRoute(next?: string): Route {
  return next && isAppRoute(next) ? (next as AppRoute) : "today";
}

export default function AuthPage({
  mode, next, notice, onNavigate,
}: {
  mode: "login" | "signup";
  next?: string;
  notice?: string | null;
  onNavigate: Navigate;
}) {
  const { config, login, signup, startGoogle, connectWallet } = useAuth();
  const [tab, setTab] = useState(mode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<"email" | "google" | "wallet" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTab(mode);
    setError(null);
  }, [mode]);

  useEffect(() => {
    if (notice) setError(NOTICES[notice] || null);
  }, [notice]);

  const switchTab = (nextTab: "login" | "signup") => {
    setTab(nextTab);
    setError(null);
    onNavigate(nextTab, next ? { next } : undefined);
  };

  const submitEmail = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy("email");
    try {
      if (tab === "signup") await signup(name, email, password);
      else await login(email, password);
      onNavigate(nextRoute(next));
    } catch (err: any) {
      setError(err?.message || "That didn’t work. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const useGoogle = () => {
    setError(null);
    if (!config.google) {
      setError(NOTICES.google_not_configured);
      return;
    }
    setBusy("google");
    startGoogle();
  };

  const useWallet = async () => {
    setError(null);
    setBusy("wallet");
    try {
      await connectWallet();
      onNavigate(nextRoute(next));
    } catch (err: any) {
      setError(err?.message || "Wallet sign-in didn’t complete.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="landing auth-page">
      <header className="auth-top">
        <button className="site-brand" onClick={() => onNavigate("home")}>
          <Logo />
          <span className="site-word">remindify</span>
          <span className="site-beta">preview</span>
        </button>
        <button className="auth-back" onClick={() => onNavigate("home")}>
          <Icon name="arrowLeft" size={14} /> Back to the story
        </button>
      </header>

      <main className="auth-layout">
        <aside className="auth-aside">
          <div className="auth-aside-grid" aria-hidden="true" />
          <SectionTag light>Your register is waiting</SectionTag>
          <h1>Give the recurring<br />work <em>a home.</em></h1>
          <p>
            One calm place for the renewals, filings, people and small things that become
            large when forgotten. Humans and agents, on the same shift.
          </p>

          <div className="auth-preview">
            <div className="auth-preview-head">
              <span className="eyebrow">Tuesday · the register</span>
              <span className="mini-live"><i /> live</span>
            </div>
            <div className="auth-preview-item">
              <span className="auth-check" />
              <div><strong>Warehouse insurance</strong><em>Remy is preparing a plan</em></div>
              <span className="auth-due">12d</span>
            </div>
            <div className="auth-preview-item">
              <span className="auth-check" />
              <div><strong>Payroll filing</strong><em>With Ledger · proof required</em></div>
              <span className="auth-due">21d</span>
            </div>
            <div className="auth-preview-item">
              <span className="auth-check" />
              <div><strong>Mum’s birthday</strong><em>Backup: Mira</em></div>
              <span className="auth-due">6d</span>
            </div>
            <div className="auth-preview-foot">
              <span><Icon name="shield" size={13} /> Offchain by default</span>
              <span><Icon name="wallet" size={13} /> Wallet optional</span>
            </div>
          </div>

          <blockquote className="auth-quote">
            “The point isn’t to do more.<br /><em>It’s to carry less.”</em>
          </blockquote>
          <div className="auth-aside-foot">
            <span>No token</span><i /><span>No custody</span><i /><span>Export always</span>
          </div>
        </aside>

        <section className="auth-panel">
          <div className="auth-card">
            <div className="auth-card-head">
              <span className="eyebrow">{tab === "signup" ? "Create your register" : "Welcome back"}</span>
              <h2>{tab === "signup" ? "Start with one thing." : "Pick up where you left off."}</h2>
              <p>
                {tab === "signup"
                  ? "No card during preview. No token. Use email, Google or a wallet."
                  : "Your obligations, agents and proof trail are exactly where you left them."}
              </p>
            </div>

            <div className="auth-tabs" role="tablist">
              <button className={tab === "login" ? "on" : ""} onClick={() => switchTab("login")} role="tab" aria-selected={tab === "login"}>
                Sign in
              </button>
              <button className={tab === "signup" ? "on" : ""} onClick={() => switchTab("signup")} role="tab" aria-selected={tab === "signup"}>
                Create account
              </button>
            </div>

            {error && (
              <div className="auth-error" role="alert">
                <Icon name="alert" size={15} />
                <span>{error}</span>
              </div>
            )}

            <div className="auth-options">
              <button className="auth-option" onClick={useGoogle} disabled={busy !== null}>
                {busy === "google" ? <span className="spinner dark" /> : <GoogleGlyph />}
                Continue with Google
              </button>
              <button className="auth-option" onClick={useWallet} disabled={busy !== null}>
                {busy === "wallet" ? <span className="spinner dark" /> : <Icon name="wallet" size={17} />}
                Continue with wallet
              </button>
            </div>

            <div className="auth-divider"><span>or use email</span></div>

            <form className="auth-form" onSubmit={submitEmail}>
              {tab === "signup" && (
                <label className="auth-field">
                  <span>Your name <em>optional</em></span>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Solomon Tigabu"
                    autoComplete="name"
                    maxLength={80}
                  />
                </label>
              )}
              <label className="auth-field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>
              <label className="auth-field">
                <span>Password <em>{tab === "signup" ? "8 characters minimum" : ""}</em></span>
                <div className="auth-password">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={tab === "signup" ? "Make it memorable" : "Your password"}
                    autoComplete={tab === "signup" ? "new-password" : "current-password"}
                    minLength={8}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    <Icon name={showPassword ? "eye" : "lock"} size={15} />
                  </button>
                </div>
              </label>

              <button className="btn btn-ink auth-submit" type="submit" disabled={busy !== null}>
                {busy === "email" ? <span className="spinner" /> : <Icon name="arrowRight" size={15} />}
                {tab === "signup" ? "Create my register" : "Sign in"}
              </button>
            </form>

            <p className="auth-terms">
              By continuing you agree to our{" "}
              <button onClick={() => onNavigate("terms")}>Terms</button> and{" "}
              <button onClick={() => onNavigate("privacy")}>Privacy</button>.
              You can export or delete your register at any time.
            </p>

            <div className="auth-panel-foot">
              <span><i className="dot dot-teal" /> Preview build</span>
              <span>Email, Google and wallet are optional identities on the same account model.</span>
            </div>
          </div>

          <div className="auth-help">
            <span>Just looking?</span>
            <button onClick={() => onNavigate("home")}>Explore the story first <Icon name="arrowRight" size={12} /></button>
          </div>
        </section>
      </main>

      <footer className="auth-foot">
        <span>© 2026 Remindify. Built in Addis Ababa, for everywhere.</span>
        <span>
          <button onClick={() => onNavigate("security")}>Security</button>
          <button onClick={() => onNavigate("privacy")}>Privacy</button>
          <button onClick={() => onNavigate("terms")}>Terms</button>
        </span>
      </footer>
    </div>
  );
}
