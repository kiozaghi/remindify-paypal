import { useEffect, useState } from "react";
import { useApp } from "../store";
import { Icon } from "./Icon";
import { Modal } from "./ui";
import { docsHref } from "../docs/pages";

const SEEN_KEY = "remindify:welcome-seen:v1";

type Step = {
  icon: string;
  eyebrow: string;
  title: string;
  body: string;
  route?: string;
  cta?: string;
};

const STEPS: Step[] = [
  {
    icon: "today",
    eyebrow: "Welcome",
    title: "Everything that comes back, on one board",
    body: "Vendor renewals, compliance filings, contractor deliverables and invoices to chase. Each one carries an owner, a risk score and a proof requirement, so nothing quietly rolls over.",
  },
  {
    icon: "list",
    eyebrow: "The register",
    title: "Start from what you already owe",
    body: "Twelve obligations are already seeded so there is something to look at. Change an autonomy level and the agent's mandate changes with it — notify, prepare, approve, or autopilot within limits.",
    route: "obligations",
    cta: "Open the register",
  },
  {
    icon: "sparkle",
    eyebrow: "Capture",
    title: "Paste the letter, get the deadlines",
    body: "A renewal notice, a tax demand, a messy contractor handoff. Remindify pulls out the dates, amounts and providers and shows you the draft before anything is scheduled.",
    route: "capture",
    cta: "Try a capture",
  },
  {
    icon: "bot",
    eyebrow: "Delegation",
    title: "Hire an agent or a human bench",
    body: "Delegate a single obligation or post a new job. Payment sits in a PayPal authorization hold and only releases when the proof clears the auditor.",
    route: "market",
    cta: "Browse the marketplace",
  },
  {
    icon: "key",
    eyebrow: "Agent access",
    title: "Bring your own agent",
    body: "Scoped machine keys let an outside agent read, prepare and close obligations on your behalf — with every call logged and revocable per key.",
    route: "access",
    cta: "Mint a key",
  },
];

export function WelcomeTour() {
  const { state, overlays, navigate } = useApp();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const anyOverlay =
    !!overlays.drawer || !!overlays.agentDrawer || !!overlays.hire || !!overlays.escrowFor ||
    overlays.palette || overlays.newAgent || overlays.newObligation || overlays.templates || overlays.deleteAccount;

  useEffect(() => {
    if (!state) return;
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(SEEN_KEY);
    } catch {
      seen = "1";
    }
    if (!seen) setOpen(true);
  }, [state]);

  if (!open || anyOverlay) return null;

  const close = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage blocked — the tour still closes for this session */
    }
    setOpen(false);
    setStep(0);
  };

  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const jump = () => {
    if (current.route) navigate(current.route);
    close();
  };

  return (
    <Modal
      className="welcome-modal"
      width={540}
      eyebrow={current.eyebrow}
      title={current.title}
      onClose={close}
      footer={
        <>
          <div className="welcome-dots">
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                className={i === step ? "on" : ""}
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1}`}
              />
            ))}
          </div>
          <button className="btn btn-ghost" onClick={close}>Skip</button>
          {step > 0 && (
            <button className="btn btn-ghost" onClick={() => setStep((n) => n - 1)}>
              <Icon name="arrowLeft" size={14} /> Back
            </button>
          )}
          {last ? (
            <button className="btn btn-ink" onClick={close}>
              <Icon name="check" size={15} /> Start using it
            </button>
          ) : (
            <button className="btn btn-ink" onClick={() => setStep((n) => n + 1)}>
              Next <Icon name="arrowRight" size={14} />
            </button>
          )}
        </>
      }
    >
      <div className="welcome-step">
        <span className="welcome-icon"><Icon name={current.icon} size={22} /></span>
        <p>{current.body}</p>
      </div>

      {current.route && (
        <button className="welcome-jump" onClick={jump}>
          <Icon name="arrowUpRight" size={14} /> {current.cta}
        </button>
      )}

      {step === STEPS.length - 1 && (
        <div className="welcome-docs">
          <span className="welcome-docs-icon"><Icon name="book" size={15} /></span>
          <div>
            <strong>Building against it?</strong>
            <em>
              The docs cover scopes, passports and the REST API your agent will actually call.
            </em>
          </div>
          <a className="btn btn-ghost btn-sm" href={docsHref("concepts/workspaces-and-keys")}>
            Read the docs <Icon name="arrowUpRight" size={13} />
          </a>
        </div>
      )}
    </Modal>
  );
}
