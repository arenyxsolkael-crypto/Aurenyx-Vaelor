import React from "react";

/*
  Home, About, FAQ, Privacy and Terms for Aurenyx Vaelor / TrustGrid.
  Items in [SQUARE BRACKETS] are placeholders you must fill in or confirm.
  The Privacy and Terms text is a plain-language draft, not legal advice. Have it reviewed before you publish.
*/

export type SitePageId = "home" | "about" | "faq" | "privacy" | "terms";

const CONTACT = "[CONTACT EMAIL]";
const UPDATED = "[DATE LAST UPDATED]";

const CSS = `
.sp{color:#e8f1fb;max-width:720px;margin:0 auto;padding:24px 18px;font:400 16px/1.6 inherit}
.sp *{box-sizing:border-box}
.sp h1{margin:0;font-size:clamp(2rem,8vw,3.2rem);line-height:1.1;letter-spacing:-.02em}
.sp h2{margin:32px 0 6px;font-size:1.3rem;line-height:1.2}
.sp h3{margin:0;font-size:1.02rem}
.sp p{margin:.5em 0}.sp .mu{color:#93a8c2}.sp .sm{font-size:.875rem}
.sp .tag{color:#35C8FF;letter-spacing:.08em;font-size:.85rem;font-weight:500}
.sp .grid{display:grid;gap:12px;margin:14px 0}
.sp .card{border:1px solid #1d3453;background:#0c1b31;border-radius:10px;padding:14px 16px}
.sp .card p{margin:.3em 0 0;color:#93a8c2}
.sp .btn{background:#1685FF;color:#06101F;border:0;border-radius:8px;padding:12px 18px;font:inherit;font-weight:500;cursor:pointer;margin-top:10px}
.sp .btn:focus-visible,.sp summary:focus-visible{outline:2px solid #35C8FF;outline-offset:2px}
.sp details{border-bottom:1px solid #1d3453;padding:6px 0}
.sp summary{cursor:pointer;font-weight:500;padding:8px 0}
.sp li{margin:.35em 0}
.sp .note{border-left:3px solid #35C8FF;padding:2px 12px;margin:16px 0}
`;

const Card = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <div className="card"><h3>{t}</h3><p>{children}</p></div>
);

function Home({ onStart }: { onStart?: () => void }) {
  return (
    <>
      <p className="tag">AURENYX TRUSTGRID</p>
      <h1>Intelligence. Integrity. Infinity.</h1>
      <p className="mu">AI workflow governance you can read. Describe how your team uses AI, see a transparent risk score, and keep a Passport that records the rules, the answers and the safeguards.</p>
      {onStart && <button className="btn" onClick={onStart}>Start an assessment</button>}

      <h2>What TrustGrid does</h2>
      <div className="grid">
        <Card t="Scores a workflow">Eight questions about task, data, oversight, impact, audience, tool, logging and disclosure produce a provisional score from 0 to 100.</Card>
        <Card t="Shows its reasoning">Every rule and every point is visible on the Passport. There is no hidden model behind the number.</Card>
        <Card t="Suggests safeguards">Each flagged answer comes with a practical safeguard you can adopt, assign or reject.</Card>
        <Card t="Keeps a record">Export a Passport as a PDF through your browser’s print dialog, or as Markdown.</Card>
      </div>

      <h2>How it works</h2>
      <ol>
        <li>Name one AI workflow and answer the questions.</li>
        <li>Review the score, the rules applied and the suggested safeguards.</li>
        <li>Save, print or export the Passport, and re-run it when the workflow changes.</li>
      </ol>

      <h2>What it is not</h2>
      <div className="note">TrustGrid is a documentation aid. Scores are provisional and rules-based. It does not certify compliance with any law or standard, and it is not legal advice.</div>
    </>
  );
}

function About() {
  return (
    <>
      <h1>About Aurenyx Vaelor</h1>
      <p className="mu">Aurenyx Vaelor was founded by Arenyx Sol Kael. It builds a modular, mobile-first AI workspace, and TrustGrid is its AI workflow governance suite.</p>
      <h2>What we believe</h2>
      <div className="grid">
        <Card t="Be transparent">If a score exists, the rules behind it should be visible and arguable.</Card>
        <Card t="Make no inflated claims">TrustGrid does not claim certifications, partnerships or results it has not earned.</Card>
        <Card t="Keep data close">The assessment runs in your browser, and saved Passports stay on your device.</Card>
        <Card t="Support human judgement">The score prompts a conversation. People make the decision.</Card>
      </div>
      <h2>Status</h2>
      <p>TrustGrid is an early free-tier release. The risk rules are provisional and will change as they are tested against more real workflows.</p>
      <p>Contact: {CONTACT}</p>
    </>
  );
}

function Faq() {
  const items: [string, string][] = [
    ["Is TrustGrid a certification?", "No. It documents how AI is used and gives a provisional, rules-based score. It does not certify compliance with any law, regulation or standard."],
    ["How is the score worked out?", "Each answer earns 0 to 5 points, multiplied by that question’s weight and scaled to 100. A floor rule sets the minimum to High when sensitive data or serious harm is possible and review is weak. Every step is shown on the Passport."],
    ["How accurate is it?", "It is a structured starting point, not a verdict. The weights are provisional. Treat the score as a prompt for discussion."],
    ["Where is my data stored?", "Assessments and saved Passports live in your browser’s local storage on your device. Clearing your browsing data deletes them, and they do not follow you to another device."],
    ["Does anything leave my device?", "Not during the assessment. If the optional AI assistant is switched on, the workflow name, score and answers are sent to the AI provider the site uses when you press its buttons. The owner field is not sent."],
    ["Can I use it for my team?", "Yes. Assess one workflow at a time and export each Passport. Shared accounts and team sync are not part of this release."],
    ["Does it cost anything?", "The current release is free. [CONFIRM ANY FUTURE PLANS BEFORE STATING THEM]"],
  ];
  return (
    <>
      <h1>Frequently asked questions</h1>
      {items.map(([q, a]) => (
        <details key={q}><summary>{q}</summary><p className="mu">{a}</p></details>
      ))}
    </>
  );
}

function Privacy() {
  return (
    <>
      <h1>Privacy</h1>
      <p className="mu sm">Last updated: {UPDATED}. Draft for review.</p>
      <h2>The short version</h2>
      <p>TrustGrid is built to keep your assessments on your device. We do not ask you to create an account to use it.</p>
      <h2>What stays on your device</h2>
      <p>Your workflow names, owner names, answers and saved Passports are stored in your browser’s local storage. We do not receive them. You can delete any Passport in the History tab, or clear your browser data to remove everything.</p>
      <h2>The optional AI assistant</h2>
      <p>If the assistant is enabled, pressing “Explain this score” or “Draft safeguards” sends the workflow name, score and answers to [AI PROVIDER NAME] to generate a reply. The owner field is not sent. Do not put confidential details in the workflow name. [CONFIRM RETENTION AND TRAINING TERMS OF THE PROVIDER YOU USE]</p>
      <h2>Analytics and cookies</h2>
      <p>[STATE ACCURATELY WHAT THE SITE USES, FOR EXAMPLE NONE, OR NAME THE ANALYTICS TOOL AND WHAT IT COLLECTS. Links shared from social media may add tracking parameters to the address before they reach us.]</p>
      <h2>Your choices</h2>
      <ul>
        <li>Delete saved Passports from the History tab.</li>
        <li>Clear your browser’s site data to remove everything stored.</li>
        <li>Skip the assistant, which is optional.</li>
      </ul>
      <h2>Contact</h2>
      <p>Questions about privacy: {CONTACT}</p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h1>Terms of use</h1>
      <p className="mu sm">Last updated: {UPDATED}. Draft for review.</p>
      <h2>What TrustGrid is</h2>
      <p>TrustGrid is a documentation tool that produces provisional, rules-based scores and suggested safeguards. It is provided for information only.</p>
      <h2>Not advice or certification</h2>
      <p>Nothing in TrustGrid is legal, compliance, financial or professional advice, and no Passport certifies that a workflow meets any law, regulation or standard. You remain responsible for your own decisions and for checking requirements that apply to you.</p>
      <h2>AI-generated content</h2>
      <p>Where the optional assistant is used, its output may be wrong or incomplete. Check it before relying on it.</p>
      <h2>Your content</h2>
      <p>You own what you enter. Keep confidential or personal data out of workflow names and notes. Saved Passports live on your device, so you are responsible for keeping copies you need.</p>
      <h2>Availability and changes</h2>
      <p>TrustGrid is an early release provided as it is, without guarantees of availability or accuracy. Features, scoring rules and these terms may change. [HAVE A QUALIFIED PERSON REVIEW LIABILITY AND GOVERNING-LAW WORDING FOR YOUR REGION]</p>
      <h2>Contact</h2>
      <p>{CONTACT}</p>
    </>
  );
}

export default function SitePage({ page, onStart }: { page: SitePageId; onStart?: () => void }) {
  return (
    <div className="sp">
      <style>{CSS}</style>
      {page === "home" && <Home onStart={onStart} />}
      {page === "about" && <About />}
      {page === "faq" && <Faq />}
      {page === "privacy" && <Privacy />}
      {page === "terms" && <Terms />}
    </div>
  );
}
