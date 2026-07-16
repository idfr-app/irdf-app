import Link from "next/link";
import { PRODUCT } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * Public landing. BI-NET always shown with its full form. The console lives at
 * /app (protected); this page routes people to sign in.
 */
export default function Landing() {
  return (
    <main className="land">
      <nav className="lnav">
        <div className="wordmark">
          <span className="dot" />
          <b>{PRODUCT.name}</b>
        </div>
        <Link className="btn primary sm" href="/login">Sign in</Link>
      </nav>

      <section className="hero">
        <p className="eyebrow">{PRODUCT.full}</p>
        <h1>See how AI and the internet<br />perceive your brand.</h1>
        <p className="lead">
          Then shape it, generate it, and ship it — with you in control at every
          step. {PRODUCT.name} watches how answer-engines describe your brand,
          turns that into a truth-anchored plan, writes the content in your voice,
          and never touches a real audience without your approval.
        </p>
        <div className="cta">
          <Link className="btn primary" href="/login">Get started free</Link>
          <a className="btn ghost" href="#how">How it works</a>
        </div>
      </section>

      <section id="how" className="pillars">
        <Pillar t="AI-Perception Radar" d="Track what ChatGPT, Gemini, Perplexity, Claude & Copilot say about your brand — presence, accuracy, sentiment, share-of-voice — and fold it into strategy before acting." />
        <Pillar t="Augmented autonomy" d="Manual, Semi, or Full. The engine does the work; you own the risk. A kill switch always works, and audience-facing actions stay behind an approval gate." />
        <Pillar t="It generates, not just suggests" d="Finished blog, per-platform social, SEO packs, email/WhatsApp copy and GEO assets — brand-voice-locked, in your accent, in your languages." />
        <Pillar t="Truth-anchored" d="No fabricated facts, stats or quotes. Sources cited, AI assistance disclosed. Every observation, plan and action sealed to a tamper-evident ledger." />
      </section>

      <footer className="lfoot">
        <span>{PRODUCT.label}</span>
      </footer>
    </main>
  );
}

function Pillar({ t, d }: { t: string; d: string }) {
  return (
    <div className="pillar">
      <h3>{t}</h3>
      <p>{d}</p>
    </div>
  );
}
