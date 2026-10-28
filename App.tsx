import React, { useEffect, useMemo, useState } from "react";

/*
  Aurenyx Vælor / TrustGrid: the whole site in one file.
  Default export: <App ask={optionalAIFunction} />.
  Search for [SQUARE BRACKETS] and fill in the placeholders before you publish.
*/

// ===== TrustGrid =====
type Opt = [string, number];
type Question = { id: string; n: string; w: number; t: string; o: Opt[]; s: string };
export type Rec = { id: string; name: string; owner: string; date: string; a: Record<string, number> };
type View = "assess" | "passport" | "history";
type Example = { id: string; name: string; blurb: string; facts: string; a: number[] };

export const Q: Question[] = [
  { id: "use", n: "Task", w: 1.5, t: "What does the AI do in this workflow?", o: [["Drafts or summarises text", 1], ["Analyses data", 2], ["Talks to customers directly", 3], ["Recommends decisions about people or money", 5]], s: "Write down which decisions the AI may support, and keep a named person as the final decision-maker." },
  { id: "data", n: "Data", w: 2, t: "What is the most sensitive data that goes in?", o: [["None, or public information only", 0], ["Internal business information", 2], ["Personal information", 4], ["Health, financial or children’s data", 5]], s: "Remove or mask personal, health and financial details before they reach the tool, or use a tool with data controls." },
  { id: "oversight", n: "Oversight", w: 2, t: "Does a person review the output before it is used?", o: [["Always, before every use", 0], ["On a sample", 2], ["Only when something looks wrong", 4], ["No review", 5]], s: "Require a named reviewer to approve outputs before they are used or sent." },
  { id: "impact", n: "Impact", w: 2, t: "What happens if the output is wrong?", o: [["Minor annoyance", 0], ["Some rework", 1], ["Financial or reputational damage", 3], ["Harm to a person", 5]], s: "Add a check step and a rollback plan for outputs that could cause financial, reputational or personal harm." },
  { id: "audience", n: "Audience", w: 1, t: "Who sees the output?", o: [["Only me", 0], ["My team", 1], ["Customers", 3], ["The public", 4]], s: "Review anything customers or the public will see, and keep a copy of what was published." },
  { id: "model", n: "Tool", w: 1.5, t: "Which kind of AI tool is it?", o: [["Private or local model", 0], ["Business plan with data controls", 1], ["Consumer or free account", 3], ["Not sure", 5]], s: "Move to a business or private deployment with data-retention controls, and avoid free consumer accounts for work data." },
  { id: "record", n: "Logging", w: 1, t: "Are prompts and outputs recorded?", o: [["Yes, in a searchable log", 0], ["Partly", 2], ["No", 4]], s: "Keep prompts, outputs and reviewer decisions in a log you can search later." },
  { id: "disclose", n: "Disclosure", w: 1, t: "Are the people affected told AI is involved?", o: [["Yes, clearly", 0], ["Partly", 2], ["No", 4]], s: "Tell people when AI is involved in what they receive, in plain words." },
];

// Answers are option indexes in question order: task, data, oversight, impact, audience, tool, logging, disclosure.
export const EXAMPLES: Example[] = [
  { id: "meeting", name: "Internal meeting summaries", blurb: "Staff use a business AI plan to summarise their own meetings.", facts: "Drafts text · internal data · always reviewed · team only", a: [0, 1, 0, 1, 1, 1, 0, 0] },
  { id: "public-data", name: "Analysing public datasets", blurb: "An analyst runs AI over open data on a local model.", facts: "Analyses data · public data · always reviewed · only me", a: [1, 0, 0, 1, 0, 0, 2, 0] },
  { id: "marketing", name: "Marketing copy", blurb: "Public posts drafted on a free consumer account, sampled for review.", facts: "Drafts text · public audience · consumer tool · sampled review", a: [0, 0, 1, 2, 3, 2, 1, 1] },
  { id: "support", name: "Customer support replies", blurb: "AI drafts replies using customer details, with light review.", facts: "Talks to customers · personal data · sampled review · not disclosed", a: [2, 2, 1, 2, 2, 1, 1, 2] },
  { id: "cv-bad", name: "CV screening, no review", blurb: "A free AI tool ranks job applicants and nobody checks it.", facts: "Decisions about people · personal data · no review · no logs", a: [3, 2, 3, 3, 1, 2, 2, 2] },
  { id: "cv-good", name: "CV screening, with safeguards", blurb: "Same task with masked data, a business tool, human sign-off, logs and disclosure.", facts: "Decisions about people · internal data · always reviewed · logged", a: [3, 1, 0, 3, 1, 1, 0, 0] },
  { id: "medical", name: "Medical note summaries", blurb: "Clinic staff paste patient notes into a consumer chatbot.", facts: "Drafts text · health data · reviewed only when odd · consumer tool", a: [0, 3, 2, 3, 1, 2, 2, 1] },
  { id: "loan", name: "Loan pre-checks", blurb: "A private model recommends decisions on financial data, sampled for review.", facts: "Decisions about money · financial data · sampled review · private tool", a: [3, 3, 1, 2, 2, 0, 0, 1] },
];

export const BANDS: [string, string][] = [["Low", "#22c55e"], ["Moderate", "#eab308"], ["High", "#f97316"], ["Critical", "#ef4444"]];
export const W = Q.reduce((s, q) => s + q.w, 0);
// Rule constants live here so the Risk Rules page reads the same values the engine uses.
export const BAND_EDGES = [25, 50, 75]; // Low < 25, Moderate < 50, High < 75, Critical otherwise
export const FLAG_AT = 3; // an answer worth this many points or more is flagged and triggers a safeguard
export const FLOOR = { sensitiveAt: 5, oversightAt: 4, minScore: 50 };
const KEY = "tg_hist";
const bandOf = (p: number) => (p < BAND_EDGES[0] ? 0 : p < BAND_EDGES[1] ? 1 : p < BAND_EDGES[2] ? 2 : 3);
const pts = (a: Record<string, number>, id: string) => Q.find((q) => q.id === id)!.o[a[id]][1];
export const toRecord = (arr: number[]) => Object.fromEntries(Q.map((q, i) => [q.id, arr[i]]));

export function score(a: Record<string, number>) {
  const rows = Q.map((q) => {
    const p = q.o[a[q.id]][1];
    return { q, ans: q.o[a[q.id]][0], p, c: (((p / 5) * q.w) / W) * 100, hit: p >= FLAG_AT };
  });
  let pct = rows.reduce((s, r) => s + r.c, 0);
  let floor = false;
  if ((pts(a, "data") >= FLOOR.sensitiveAt || pts(a, "impact") >= FLOOR.sensitiveAt) && pts(a, "oversight") >= FLOOR.oversightAt && pct < FLOOR.minScore) {
    pct = FLOOR.minScore;
    floor = true;
  }
  pct = Math.round(pct);
  return { rows, pct, b: bandOf(pct), floor };
}

export function loadHist(): Rec[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function saveHist(h: Rec[]) {
  try { localStorage.setItem(KEY, JSON.stringify(h)); } catch { /* storage unavailable */ }
}

function toMarkdown(r: Rec) {
  const s = score(r.a);
  const flagged = s.rows.filter((x) => x.hit);
  return [
    `# AI Workflow Passport: ${r.name}`, "",
    `Passport ${r.id} | ${r.date}${r.owner ? ` | Owner: ${r.owner}` : ""}`, "",
    `**Provisional risk: ${BANDS[s.b][0]} (${s.pct}/100)**`, "",
    "## Rules applied", "",
    ...s.rows.map((x) => `- ${x.q.n}: ${x.ans} (+${x.c.toFixed(1)})${x.hit ? " [flagged]" : ""}`),
    ...(s.floor ? ["- Floor rule: sensitive data or serious impact without regular review sets the minimum to High."] : []),
    "", "## Suggested safeguards", "",
    ...(flagged.length ? flagged.map((x) => `- ${x.q.s}`) : ["- No rule flagged. Keep reviewing as the workflow changes."]),
    "", "*Provisional and rules-based. This document is not a certification or legal advice.*", "",
  ].join("\n");
}

const CSS_TG = `
.tg{--bg:#0b0a10;--sf:#0c1b31;--tx:#e8f1fb;--mu:#93a8c2;--ln:#1d3453;--ac:#1685FF;--cy:#35C8FF;color:var(--tx);max-width:720px;margin:0 auto;padding:24px 18px;font:400 16px/1.55 inherit}
.tg *,.tg *::before,.tg *::after{box-sizing:border-box}
.tg h1,.tg h2{margin:0;line-height:1.12;font-weight:700}
.tg h1{font-size:clamp(2rem,8vw,3rem);letter-spacing:-.02em}.tg h2{font-size:1.35rem}.tg h3{margin:0;font-size:1.05rem}
.tg p{margin:.4em 0}.tg .mu{color:var(--mu)}.tg .sm{font-size:.875rem}
.tg nav{display:flex;gap:4px;margin-bottom:12px}
.tg nav button{background:none;border:1px solid transparent;color:var(--mu);font:inherit;padding:8px 12px;border-radius:8px;cursor:pointer}
.tg nav button[aria-current="page"]{color:var(--tx);border-color:var(--ln);background:var(--sf)}
.tg button:focus-visible,.tg input:focus-visible,.tg summary:focus-visible{outline:2px solid var(--cy);outline-offset:2px}
.tg fieldset{border:1px solid var(--ln);background:var(--sf);border-radius:10px;margin:14px 0;padding:14px 16px}
.tg legend{font-weight:500;padding:0 6px}
.tg .opt{display:flex;gap:10px;align-items:flex-start;padding:9px 6px;border-radius:8px;cursor:pointer}
.tg .opt:hover{background:rgba(22,133,255,.1)}.tg .opt input{margin-top:5px;accent-color:var(--ac)}
.tg .txt{width:100%;background:var(--sf);color:var(--tx);border:1px solid var(--ln);border-radius:8px;padding:11px 12px;font:inherit}
.tg .btn{background:var(--ac);color:#06101F;border:0;border-radius:8px;padding:12px 18px;font:inherit;font-weight:500;cursor:pointer}
.tg .btn.ghost{background:none;color:var(--tx);border:1px solid var(--ln)}
.tg .btn.small{padding:8px 12px;font-size:.9rem}
.tg .row{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}
.tg .err{color:#f87171;min-height:1.4em}.tg .ok{color:#4ade80}
.tg .meter{position:relative;display:flex;gap:3px;margin:22px 0 8px}
.tg .meter span{flex:1;height:14px;border-radius:3px;opacity:.85}
.tg .meter b{position:absolute;top:-7px;width:4px;height:28px;background:var(--tx);border-radius:2px;transform:translateX(-2px)}
.tg .big{font-size:4rem;line-height:1;font-weight:700}
.tg .pill{display:inline-block;border:1px solid currentColor;border-radius:99px;padding:2px 12px;font-weight:500;white-space:nowrap}
.tg .card{border:1px solid var(--ln);background:var(--sf);border-radius:10px;padding:16px;margin:14px 0}
.tg .tw{overflow-x:auto}.tg table{border-collapse:collapse;width:100%;min-width:480px}
.tg th,.tg td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--ln);vertical-align:top;font-size:.9rem}
.tg tr.hit td:last-child{color:#fbbf24;font-weight:500}
.tg li{margin:.4em 0}
.tg .note{border-left:3px solid var(--cy);padding:2px 12px;margin:14px 0}
.tg .hrow{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid var(--ln)}
.tg details{border:1px solid var(--ln);border-radius:10px;background:var(--sf);padding:4px 16px;margin:16px 0}
.tg summary{cursor:pointer;font-weight:500;padding:10px 0}
.tg .ex{border-top:1px solid var(--ln);padding:14px 0}
.tg .exh{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.tg .only-print{display:none}
@media print{
 body *{visibility:hidden!important}
 .tg-print,.tg-print *{visibility:visible!important}
 .tg-print{position:absolute;left:0;top:0;width:100%;padding:0 8mm;color:#000!important;background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
 .tg-print .mu{color:#444!important}
 .tg-print .card{background:#fff!important;border-color:#bbb!important}
 .tg-print th,.tg-print td{border-color:#ccc!important}
 .tg-print tr.hit td:last-child{color:#92400e!important}
 .tg-print .meter b{background:#000!important}
 .tg-print .tw{overflow:visible!important}.tg-print table{min-width:0!important}
 .tg-print .noprint{display:none!important}
 .tg-print .only-print{display:block!important}
 .tg-print .card,.tg-print tr,.tg-print li{break-inside:avoid}
}
`;

type Props = { ask?: (prompt: string) => Promise<string> };

function TrustGrid({ ask }: Props) {
  const [view, setView] = useState<View>("assess");
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [a, setA] = useState<Record<string, number>>({});
  const [rec, setRec] = useState<Rec | null>(null);
  const [hist, setHist] = useState<Rec[]>(() => loadHist());
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [aiOut, setAiOut] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const goTo = (v: View) => { setView(v); setMsg(""); setAiOut(""); window.scrollTo(0, 0); };

  const generate = () => {
    const missing = Q.filter((q) => a[q.id] === undefined);
    if (!name.trim()) return setErr("Name the workflow first.");
    if (missing.length) {
      setErr(`Answer ${missing.length} more question${missing.length > 1 ? "s" : ""} to score this workflow.`);
      document.getElementById("tg_" + missing[0].id)?.scrollIntoView({ block: "center" });
      return;
    }
    const r: Rec = { id: "TG-" + Date.now().toString(36).toUpperCase().slice(-6), name: name.trim(), owner: owner.trim(), date: new Date().toLocaleDateString(), a: { ...a } };
    const h = [...hist, r];
    setHist(h); saveHist(h); setRec(r); setErr(""); goTo("passport");
  };

  // Examples are shown without being saved to history.
  const viewExample = (ex: Example) => {
    setRec({ id: "EXAMPLE", name: ex.name, owner: "", date: new Date().toLocaleDateString(), a: toRecord(ex.a) });
    goTo("passport");
  };
  const loadExample = (ex: Example) => {
    setName(ex.name); setOwner(""); setA(toRecord(ex.a)); setErr("");
    window.scrollTo(0, 0);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(toMarkdown(rec!)); setMsg("Copied."); }
    catch { setMsg("Copy failed. Select the text and copy it manually."); }
  };
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([toMarkdown(rec!)], { type: "text/markdown" }));
      const el = document.createElement("a");
      el.href = url; el.download = `passport-${rec!.id}.md`;
      document.body.appendChild(el); el.click(); el.remove();
      URL.revokeObjectURL(url);
      setMsg("Downloaded.");
    } catch { setMsg("Download failed. Use Copy as Markdown instead."); }
  };
  // Optional assistant. The host site supplies `ask`, so no API key lives in this component.
  const runAI = async (kind: "explain" | "safeguards") => {
    if (!ask || !rec) return;
    const s = score(rec.a);
    const lines = s.rows.map((x) => `- ${x.q.n}: ${x.ans} (${x.hit ? "flagged" : "ok"})`).join("\n");
    const task = kind === "explain"
      ? "Explain in plain language why this workflow received this provisional score, and which two answers matter most."
      : "Draft a short, practical safeguards checklist (at most 6 items) for the flagged answers, most important first.";
    setAiBusy(true); setAiOut("");
    try {
      setAiOut(await ask(
        `You help small teams document how they use AI. Workflow: "${rec.name}". Provisional rules-based risk: ${BANDS[s.b][0]} (${s.pct}/100).\nAnswers:\n${lines}\n\n${task}\nRules: plain text only, no markdown, under 180 words. Do not claim compliance, certification or legal advice. Say the score is provisional if relevant.`
      ));
    } catch { setAiOut("The assistant couldn’t respond. Try again in a moment."); }
    setAiBusy(false);
  };
  const remove = (id: string) => { const h = hist.filter((r) => r.id !== id); setHist(h); saveHist(h); };

  const nav = (
    <nav aria-label="TrustGrid sections">
      {(["assess", "passport", "history"] as View[]).map((v) => (
        <button key={v} aria-current={view === v ? "page" : undefined} onClick={() => goTo(v)}>
          {v[0].toUpperCase() + v.slice(1)}
        </button>
      ))}
    </nav>
  );

  let body: React.ReactNode;

  if (view === "assess") {
    body = (
      <>
        <h1>Document how your team uses AI.</h1>
        <p className="mu">Answer eight questions about one workflow. You get a risk score with every rule shown, plus a Passport you can keep.</p>

        <details>
          <summary>Try an example ({EXAMPLES.length})</summary>
          {EXAMPLES.map((ex) => {
            const s = score(toRecord(ex.a));
            return (
              <div className="ex" key={ex.id}>
                <div className="exh">
                  <h3>{ex.name}</h3>
                  <span className="pill sm" style={{ color: BANDS[s.b][1] }}>{BANDS[s.b][0]} · {s.pct}</span>
                </div>
                <p className="mu sm" style={{ margin: "4px 0 0" }}>{ex.blurb}</p>
                <p className="mu sm" style={{ margin: "2px 0 0" }}>{ex.facts}</p>
                <div className="row" style={{ margin: "10px 0 0" }}>
                  <button className="btn small" onClick={() => viewExample(ex)}>View Passport</button>
                  <button className="btn small ghost" onClick={() => loadExample(ex)}>Load into form</button>
                </div>
              </div>
            );
          })}
          <p className="mu sm">Compare the two CV screening cases to see how safeguards change a score. Examples are illustrative and not saved to history.</p>
        </details>

        <p><label htmlFor="tg_nm"><b>Workflow name</b></label><input id="tg_nm" className="txt" maxLength={80} placeholder="e.g. Customer support replies" value={name} onChange={(e) => setName(e.target.value)} /></p>
        <p><label htmlFor="tg_ow"><b>Owner</b> <span className="mu sm">(optional)</span></label><input id="tg_ow" className="txt" maxLength={60} value={owner} onChange={(e) => setOwner(e.target.value)} /></p>
        {Q.map((q) => (
          <fieldset key={q.id} id={"tg_" + q.id}>
            <legend>{q.t}</legend>
            {q.o.map((o, i) => (
              <label key={i} className="opt">
                <input type="radio" name={q.id} checked={a[q.id] === i} onChange={() => setA({ ...a, [q.id]: i })} />
                <span>{o[0]}</span>
              </label>
            ))}
          </fieldset>
        ))}
        <p className="err" role="alert">{err}</p>
        <div className="row">
          <button className="btn" onClick={generate}>Generate Passport</button>
          <button className="btn ghost" onClick={() => { setName(""); setOwner(""); setA({}); setErr(""); }}>Clear answers</button>
        </div>
      </>
    );
  } else if (view === "passport") {
    if (!rec) {
      body = (<><h2>No Passport yet</h2><p className="mu">Answer the assessment or open an example to see one.</p><div className="row"><button className="btn" onClick={() => goTo("assess")}>Start assessment</button></div></>);
    } else {
      const s = score(rec.a);
      const c = BANDS[s.b][1];
      const flagged = s.rows.filter((x) => x.hit);
      body = (
        <div className="tg-print">
          <p className="only-print" style={{ fontWeight: 700, letterSpacing: ".04em" }}>AURENYX TRUSTGRID · AI WORKFLOW PASSPORT</p>
          <p className="mu sm">{rec.id === "EXAMPLE" ? "Example Passport" : `AI Workflow Passport ${rec.id}`} · {rec.date}</p>
          <h1>{rec.name}</h1>
          {rec.owner && <p className="mu">Owner: {rec.owner}</p>}
          <div className="card">
            <div className="big" style={{ color: c }}>{s.pct}<span className="mu sm"> / 100</span></div>
            <p><span className="pill" style={{ color: c }}>{BANDS[s.b][0]} risk, provisional</span></p>
            <div className="meter" role="img" aria-label={`Risk ${s.pct} of 100, ${BANDS[s.b][0]}`}>
              {BANDS.map((b) => <span key={b[0]} style={{ background: b[1] }} />)}
              <b style={{ left: s.pct + "%" }} />
            </div>
            <p className="mu sm">Bands: Low under {BAND_EDGES[0]}, Moderate {BAND_EDGES[0]} to {BAND_EDGES[1] - 1}, High {BAND_EDGES[1]} to {BAND_EDGES[2] - 1}, Critical {BAND_EDGES[2]} and over.</p>
          </div>
          <h2>Rules applied</h2>
          <div className="tw"><table><thead><tr><th>Factor</th><th>Answer</th><th>Points</th></tr></thead><tbody>
            {s.rows.map((x) => <tr key={x.q.id} className={x.hit ? "hit" : ""}><td>{x.q.n}</td><td>{x.ans}</td><td>+{x.c.toFixed(1)}</td></tr>)}
          </tbody></table></div>
          <p className="mu sm">Each answer scores 0 to 5, multiplied by the factor’s weight and scaled to 100. Highlighted rows scored {FLAG_AT} or more and trigger a safeguard.</p>
          {s.floor && <div className="note">Floor rule applied: sensitive data or serious impact with little or no review sets the minimum to High.</div>}
          <h2 style={{ marginTop: 22 }}>Suggested safeguards</h2>
          {flagged.length ? <ul>{flagged.map((x) => <li key={x.q.id}>{x.q.s}</li>)}</ul> : <p>No rule flagged. Keep reviewing as the workflow changes.</p>}
          <p className="mu sm" style={{ marginTop: 20 }}>Provisional and rules-based. TrustGrid documents AI use; this Passport is not a certification or legal advice.</p>
          {ask && (
            <div className="card noprint">
              <h3>Ask the assistant</h3>
              <p className="mu sm">Sends this workflow’s name, score and answers to the AI provider your site uses. Your owner field is not sent.</p>
              <div className="row" style={{ margin: "8px 0 0" }}>
                <button className="btn small ghost" disabled={aiBusy} onClick={() => runAI("explain")}>Explain this score</button>
                <button className="btn small ghost" disabled={aiBusy} onClick={() => runAI("safeguards")}>Draft safeguards</button>
              </div>
              {aiBusy && <p className="mu sm" role="status">Thinking…</p>}
              {aiOut && <p style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{aiOut}</p>}
              {aiOut && <p className="mu sm">AI-generated. Check it before relying on it.</p>}
            </div>
          )}
          <div className="row noprint">
            <button className="btn" onClick={() => window.print()}>Print or save as PDF</button>
            <button className="btn ghost" onClick={download}>Download Markdown</button>
            <button className="btn ghost" onClick={copy}>Copy as Markdown</button>
            <button className="btn ghost" onClick={() => goTo("assess")}>Assess another</button>
          </div>
          <p className="ok sm noprint" role="status">{msg}</p>
        </div>
      );
    }
  } else {
    body = hist.length ? (
      <>
        <h2>Saved Passports</h2>
        <p className="mu sm">Stored in this browser. Rules re-run when you open one.</p>
        {[...hist].reverse().map((r) => {
          const s = score(r.a);
          return (
            <div className="hrow" key={r.id}>
              <div><b>{r.name}</b><br /><span className="mu sm">{r.date} · <span style={{ color: BANDS[s.b][1] }}>{BANDS[s.b][0]} ({s.pct})</span></span></div>
              <div><button className="btn small ghost" onClick={() => { setRec(r); goTo("passport"); }}>Open</button> <button className="btn small ghost" onClick={() => remove(r.id)}>Delete</button></div>
            </div>
          );
        })}
      </>
    ) : (<><h2>No saved Passports</h2><p className="mu">Each Passport you generate is saved in this browser only.</p><div className="row"><button className="btn" onClick={() => goTo("assess")}>Start assessment</button></div></>);
  }

  return (
    <div className="tg">
      <style>{CSS_TG}</style>
      {nav}
      {body}
      <p className="mu sm" style={{ marginTop: 30 }}>Intelligence. Integrity. Infinity. Scores are provisional and rules-based. TrustGrid documents AI use; it does not certify compliance with any law or standard.</p>
    </div>
  );
}

// ===== SitePages =====
/*
  Home, About, FAQ, Privacy and Terms for Aurenyx Vaelor / TrustGrid.
  Items in [SQUARE BRACKETS] are placeholders you must fill in or confirm.
  The Privacy and Terms text is a plain-language draft, not legal advice. Have it reviewed before you publish.
*/

export type SitePageId = "home" | "about" | "faq" | "privacy" | "terms";

const CONTACT = "[CONTACT EMAIL]";
const UPDATED = "[DATE LAST UPDATED]";

const CSS_SP = `
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

function SitePage({ page, onStart }: { page: SitePageId; onStart?: () => void }) {
  return (
    <div className="sp">
      <style>{CSS_SP}</style>
      {page === "home" && <Home onStart={onStart} />}
      {page === "about" && <About />}
      {page === "faq" && <Faq />}
      {page === "privacy" && <Privacy />}
      {page === "terms" && <Terms />}
    </div>
  );
}

// ===== RiskRules =====
/*
  Risk Rules page. Every number here is read from TrustGrid.tsx, so this page
  cannot drift from what the engine actually does. Change a weight there and this updates.
*/

const share = (w: number) => (w / W) * 100;
const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

const CSS_RR = `
.rr{color:#e8f1fb;max-width:720px;margin:0 auto;padding:24px 18px;font:400 16px/1.6 inherit}
.rr *{box-sizing:border-box}
.rr h1{margin:0;font-size:clamp(2rem,8vw,3rem);line-height:1.1;letter-spacing:-.02em}
.rr h2{margin:34px 0 6px;font-size:1.3rem;line-height:1.2}
.rr h3{margin:0;font-size:1.02rem}
.rr p{margin:.5em 0}.rr .mu{color:#93a8c2}.rr .sm{font-size:.875rem}
.rr .card{border:1px solid #1d3453;background:#0c1b31;border-radius:10px;padding:14px 16px;margin:12px 0}
.rr .formula{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92rem;overflow-x:auto;white-space:nowrap}
.rr .tw{overflow-x:auto}.rr table{border-collapse:collapse;width:100%;min-width:460px}
.rr th,.rr td{text-align:left;padding:8px 10px;border-bottom:1px solid #1d3453;vertical-align:top;font-size:.9rem}
.rr .bar{height:8px;border-radius:4px;background:#1d3453;overflow:hidden;min-width:70px}
.rr .bar i{display:block;height:100%;background:#1685FF}
.rr .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px}
.rr .flag{color:#fbbf24}
.rr details{border-bottom:1px solid #1d3453;padding:6px 0}
.rr summary{cursor:pointer;font-weight:500;padding:8px 0}
.rr summary:focus-visible{outline:2px solid #35C8FF;outline-offset:2px}
.rr li{margin:.3em 0}
.rr .note{border-left:3px solid #35C8FF;padding:2px 12px;margin:16px 0}
`;

function RiskRules() {
  // Live worked example from the real data: first factor's top flagged answer.
  const ex = Q[1];
  const exOpt = ex.o[2];
  const exPts = (((exOpt[1] / 5) * ex.w) / W) * 100;

  return (
    <div className="rr">
      <style>{CSS_RR}</style>
      <h1>Risk rules</h1>
      <p className="mu">TrustGrid scores a workflow with fixed, published rules. There is no hidden model behind the number. This page is generated from the same data the scoring engine uses.</p>

      <h2>How a score is built</h2>
      <div className="card">
        <p className="formula">points = (answer points ÷ 5) × (factor weight ÷ {fmt(W)}) × 100</p>
        <p className="mu sm">Each answer is worth 0 to 5. Its share of the final score depends on the factor’s weight. Add the points for all {Q.length} factors for a score from 0 to 100.</p>
        <p className="sm">Example: for “{ex.n}”, the answer “{exOpt[0]}” is worth {exOpt[1]} of 5. That gives ({exOpt[1]} ÷ 5) × ({ex.w} ÷ {fmt(W)}) × 100 = <b>{fmt(exPts)}</b> points.</p>
      </div>

      <h2>Factors and weights</h2>
      <div className="tw"><table>
        <thead><tr><th>Factor</th><th>Weight</th><th>Max points</th><th aria-label="Share of score"></th></tr></thead>
        <tbody>
          {Q.map((q) => (
            <tr key={q.id}>
              <td>{q.n}</td><td>{q.w}</td><td>{fmt(share(q.w))}</td>
              <td><div className="bar" aria-hidden="true"><i style={{ width: share(q.w) * 4 + "%" }} /></div></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <p className="mu sm">Max points is the most a factor can add. They total 100. Oversight, impact and data count most because they decide how much harm a mistake can do.</p>

      <h2>Answer points</h2>
      {Q.map((q) => (
        <details key={q.id}>
          <summary>{q.n}: {q.t}</summary>
          <ul>
            {q.o.map(([label, p]) => (
              <li key={label} className={p >= FLAG_AT ? "flag" : undefined}>{label}: {p} of 5{p >= FLAG_AT ? " (flagged)" : ""}</li>
            ))}
          </ul>
        </details>
      ))}

      <h2>Risk bands</h2>
      <div className="tw"><table>
        <thead><tr><th>Band</th><th>Score</th></tr></thead>
        <tbody>
          <tr><td><span className="dot" style={{ background: BANDS[0][1] }} />{BANDS[0][0]}</td><td>Under {BAND_EDGES[0]}</td></tr>
          <tr><td><span className="dot" style={{ background: BANDS[1][1] }} />{BANDS[1][0]}</td><td>{BAND_EDGES[0]} to {BAND_EDGES[1] - 1}</td></tr>
          <tr><td><span className="dot" style={{ background: BANDS[2][1] }} />{BANDS[2][0]}</td><td>{BAND_EDGES[1]} to {BAND_EDGES[2] - 1}</td></tr>
          <tr><td><span className="dot" style={{ background: BANDS[3][1] }} />{BANDS[3][0]}</td><td>{BAND_EDGES[2]} and over</td></tr>
        </tbody>
      </table></div>

      <h2>The floor rule</h2>
      <div className="note">If the workflow handles the most sensitive data or could harm a person (an answer worth {FLOOR.sensitiveAt} of 5 on Data or Impact), and review is weak (an answer worth {FLOOR.oversightAt} or more on Oversight), the score is raised to at least {FLOOR.minScore}. A good total on other factors cannot hide this combination.</div>

      <h2>Flags and safeguards</h2>
      <p>Any answer worth {FLAG_AT} or more is flagged on the Passport and triggers the safeguard for that factor.</p>
      <div className="tw"><table>
        <thead><tr><th>Factor</th><th>Suggested safeguard</th></tr></thead>
        <tbody>{Q.map((q) => <tr key={q.id}><td>{q.n}</td><td>{q.s}</td></tr>)}</tbody>
      </table></div>

      <h2>Limits</h2>
      <div className="note">These weights and thresholds are expert judgement, not statistics from real incidents. They are provisional and will change as they are tested against more workflows. A score supports a conversation and does not replace human review, legal advice or any certification.</div>
    </div>
  );
}

// ===== Safeguards =====
/*
  Safeguards page. Safeguard text, trigger answers and point values are read from TrustGrid.tsx.
  Ticks live in component state only and are not saved.
*/


const CSS_SG = `
.sg{color:#e8f1fb;max-width:720px;margin:0 auto;padding:24px 18px;font:400 16px/1.6 inherit}
.sg *{box-sizing:border-box}
.sg h1{margin:0;font-size:clamp(2rem,8vw,3rem);line-height:1.1;letter-spacing:-.02em}
.sg h3{margin:0 0 6px;font-size:1.05rem}
.sg p{margin:.5em 0}.sg .mu{color:#93a8c2}.sg .sm{font-size:.875rem}
.sg .card{border:1px solid #1d3453;background:#0c1b31;border-radius:10px;padding:14px 16px;margin:14px 0}
.sg .tick{display:flex;gap:10px;align-items:flex-start;cursor:pointer}
.sg .tick input{margin-top:6px;width:18px;height:18px;accent-color:#1685FF;flex:none}
.sg ul{margin:8px 0 0;padding-left:1.2em}.sg li{margin:.25em 0;color:#93a8c2;font-size:.9rem}
.sg .btn{background:#1685FF;color:#06101F;border:0;border-radius:8px;padding:12px 18px;font:inherit;font-weight:500;cursor:pointer}
.sg .btn:focus-visible,.sg input:focus-visible{outline:2px solid #35C8FF;outline-offset:2px}
.sg .row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:16px 0}
.sg .ok{color:#4ade80}
.sg .note{border-left:3px solid #35C8FF;padding:2px 12px;margin:16px 0}
`;

function Safeguards() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");

  const copy = async () => {
    const text = ["# AI safeguards plan", "", ...Q.map((q) => `- [${done[q.id] ? "x" : " "}] ${q.n}: ${q.s}`), ""].join("\n");
    try { await navigator.clipboard.writeText(text); setMsg("Copied."); }
    catch { setMsg("Copy failed. Select the text and copy it manually."); }
  };
  const count = Q.filter((q) => done[q.id]).length;

  return (
    <div className="sg">
      <style>{CSS_SG}</style>
      <h1>Safeguards</h1>
      <p className="mu">Each risk factor has one safeguard. It applies when your answer scores {FLAG_AT} or more on that factor. Tick the ones you have in place, then copy the list into your own notes.</p>

      {Q.map((q) => {
        const triggers = q.o.filter(([, p]) => p >= FLAG_AT);
        return (
          <div className="card" key={q.id}>
            <label className="tick">
              <input type="checkbox" checked={!!done[q.id]} onChange={() => setDone({ ...done, [q.id]: !done[q.id] })} />
              <span><h3>{q.n}</h3>{q.s}</span>
            </label>
            <ul>
              {triggers.map(([label, p]) => (
                <li key={label}>Applies if: {label}. Fixing this can remove up to {fmt(((p / 5) * q.w) / W * 100)} points.</li>
              ))}
            </ul>
          </div>
        );
      })}

      <div className="row">
        <button className="btn" onClick={copy}>Copy checklist</button>
        <span className="mu sm">{count} of {Q.length} in place</span>
        <span className="ok sm" role="status">{msg}</span>
      </div>

      <div className="note">Putting a safeguard in place does not change your score by itself. Re-run the assessment with your updated answers to see the new result. Safeguards reduce risk but do not remove it, and none of this is legal advice or a certification.</div>
    </div>
  );
}

// ===== Testing =====
/*
  Testing page. Runs in the browser against the live scoring engine.
  EXPECTED holds the band each example should land in. If you change the rules and a row fails,
  decide whether the rules or the expectation is wrong. Do not edit a test just to make it pass.
*/

const EXPECTED: Record<string, string> = {
  meeting: "Low",
  "public-data": "Low",
  marketing: "Moderate",
  support: "High",
  "cv-bad": "Critical",
  "cv-good": "Moderate",
  medical: "High",
  loan: "High",
};

type Check = { name: string; pass: boolean; detail: string };

function runChecks(): Check[] {
  const best = Object.fromEntries(Q.map((q) => [q.id, 0]));
  const worst = Object.fromEntries(Q.map((q) => [q.id, q.o.length - 1]));
  const out: Check[] = [];

  const total = Q.reduce((s, q) => s + (q.w / W) * 100, 0);
  out.push({ name: "Maximum points across factors total 100", pass: Math.abs(total - 100) < 0.001, detail: `Total is ${total.toFixed(2)}.` });

  const w = score(worst);
  out.push({ name: "Riskiest possible answers score 90 or more and Critical", pass: w.pct >= 90 && w.b === 3, detail: `Scored ${w.pct}, ${BANDS[w.b][0]}. Audience, Logging and Disclosure top out at 4 of 5, so the maximum is below 100.` });

  const b = score(best);
  out.push({ name: "Safest answers stay in the Low band", pass: b.b === 0, detail: `Scored ${b.pct}, ${BANDS[b.b][0]}.` });

  let mono = true;
  let monoDetail = "No answer lowered the score when made riskier.";
  for (const q of Q) {
    for (let i = 0; i < q.o.length - 1; i++) {
      const lo = score({ ...best, [q.id]: i }).pct;
      const hi = score({ ...best, [q.id]: i + 1 }).pct;
      if (hi < lo) { mono = false; monoDetail = `${q.n}: option ${i + 1} scored lower than option ${i}.`; }
    }
  }
  out.push({ name: "A riskier answer never lowers the score", pass: mono, detail: monoDetail });

  const dataQ = Q.find((q) => q.id === "data")!;
  const overQ = Q.find((q) => q.id === "oversight")!;
  const dataTop = dataQ.o.findIndex(([, p]) => p >= FLOOR.sensitiveAt);
  const overWeak = overQ.o.findIndex(([, p]) => p >= FLOOR.oversightAt);
  const f = score({ ...best, data: dataTop, oversight: overWeak });
  out.push({ name: "Floor rule lifts sensitive data with weak review to the minimum", pass: f.floor && f.pct >= FLOOR.minScore, detail: `Scored ${f.pct}, floor ${f.floor ? "applied" : "not applied"}.` });

  const nf = score({ ...best, data: dataTop });
  out.push({ name: "Floor rule stays off when review is strong", pass: !nf.floor, detail: `Floor ${nf.floor ? "applied" : "not applied"} with sensitive data and full review.` });

  const bad = EXAMPLES.find((e) => e.id === "cv-bad")!;
  const good = EXAMPLES.find((e) => e.id === "cv-good")!;
  const sb = score(toRecord(bad.a)).pct;
  const sg = score(toRecord(good.a)).pct;
  out.push({ name: "Adding safeguards lowers the same task’s score", pass: sg < sb, detail: `CV screening fell from ${sb} to ${sg}.` });

  return out;
}

const CSS_TS = `
.ts{color:#e8f1fb;max-width:720px;margin:0 auto;padding:24px 18px;font:400 16px/1.6 inherit}
.ts *{box-sizing:border-box}
.ts h1{margin:0;font-size:clamp(2rem,8vw,3rem);line-height:1.1;letter-spacing:-.02em}
.ts h2{margin:32px 0 6px;font-size:1.3rem;line-height:1.2}
.ts p{margin:.5em 0}.ts .mu{color:#93a8c2}.ts .sm{font-size:.875rem}
.ts .sum{border:1px solid #1d3453;background:#0c1b31;border-radius:10px;padding:14px 16px;margin:16px 0;font-weight:500}
.ts .tw{overflow-x:auto}.ts table{border-collapse:collapse;width:100%;min-width:520px}
.ts th,.ts td{text-align:left;padding:8px 10px;border-bottom:1px solid #1d3453;vertical-align:top;font-size:.9rem}
.ts .pass{color:#4ade80;font-weight:500}.ts .fail{color:#f87171;font-weight:500}
.ts .note{border-left:3px solid #35C8FF;padding:2px 12px;margin:16px 0}
`;

function Testing() {
  const examples = useMemo(
    () => EXAMPLES.map((e) => {
      const s = score(toRecord(e.a));
      const want = EXPECTED[e.id];
      return { e, s, want, pass: want === BANDS[s.b][0] };
    }),
    []
  );
  const checks = useMemo(runChecks, []);
  const exPass = examples.filter((x) => x.pass).length;
  const chPass = checks.filter((c) => c.pass).length;
  const allPass = exPass === examples.length && chPass === checks.length;

  return (
    <div className="ts">
      <style>{CSS_TS}</style>
      <h1>Testing</h1>
      <p className="mu">These tests run in your browser against the live scoring rules each time this page loads. They check that the engine behaves consistently and that realistic examples land where a sensible reviewer would expect.</p>

      <div className="sum" role="status" style={{ color: allPass ? "#4ade80" : "#fbbf24" }}>
        {exPass} of {examples.length} examples as expected · {chPass} of {checks.length} rule checks passed
      </div>

      <h2>Example workflows</h2>
      <div className="tw"><table>
        <thead><tr><th>Workflow</th><th>Score</th><th>Band</th><th>Expected</th><th>Result</th></tr></thead>
        <tbody>
          {examples.map(({ e, s, want, pass }) => (
            <tr key={e.id}>
              <td>{e.name}</td><td>{s.pct}</td>
              <td><span style={{ color: BANDS[s.b][1] }}>{BANDS[s.b][0]}</span></td>
              <td>{want}</td>
              <td className={pass ? "pass" : "fail"}>{pass ? "Pass" : "Fail"}</td>
            </tr>
          ))}
        </tbody>
      </table></div>

      <h2>Rule checks</h2>
      <div className="tw"><table>
        <thead><tr><th>Check</th><th>Detail</th><th>Result</th></tr></thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.name}><td>{c.name}</td><td className="mu">{c.detail}</td><td className={c.pass ? "pass" : "fail"}>{c.pass ? "Pass" : "Fail"}</td></tr>
          ))}
        </tbody>
      </table></div>

      <div className="note">Passing these tests shows the rules are internally consistent. It does not show the scores match real-world outcomes. The expected bands are judgements made by the people who built the rules, and they will be revisited as more real workflows are tested.</div>
    </div>
  );
}

// ===== Dashboard =====
/*
  Dashboard. Summarises the Passports saved in this browser. Scores are re-run from the stored
  answers with the current rules, so the dashboard always matches the Passport page.
  Nothing here leaves the device.
*/

const valid = (r: Rec) =>
  !!r && !!r.a && Q.every((q) => Number.isInteger(r.a[q.id]) && r.a[q.id] >= 0 && r.a[q.id] < q.o.length);

function summarise(hist: Rec[]) {
  const rows = hist.filter(valid).map((r) => ({ r, s: score(r.a) }));
  const byBand = BANDS.map((_, i) => rows.filter((x) => x.s.b === i).length);
  const avg = rows.length ? Math.round(rows.reduce((t, x) => t + x.s.pct, 0) / rows.length) : 0;
  const top = [...rows].sort((a, b) => b.s.pct - a.s.pct).slice(0, 5);
  const flags = Q.map((q) => ({ q, n: rows.filter((x) => x.s.rows.find((y) => y.q.id === q.id)!.hit).length }))
    .sort((a, b) => b.n - a.n);
  return { rows, byBand, avg, top, flags };
}

const CSS_DB = `
.db{color:#e8f1fb;max-width:720px;margin:0 auto;padding:24px 18px;font:400 16px/1.6 inherit}
.db *{box-sizing:border-box}
.db h1{margin:0;font-size:clamp(2rem,8vw,3rem);line-height:1.1;letter-spacing:-.02em}
.db h2{margin:32px 0 8px;font-size:1.3rem;line-height:1.2}
.db p{margin:.5em 0}.db .mu{color:#93a8c2}.db .sm{font-size:.875rem}
.db .stats{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:18px 0}
.db .stat{border:1px solid #1d3453;background:#0c1b31;border-radius:10px;padding:14px 16px}
.db .stat b{display:block;font-size:2.2rem;line-height:1.1}
.db .brow{display:grid;grid-template-columns:96px 1fr 28px;gap:10px;align-items:center;margin:8px 0;font-size:.9rem}
.db .bar{height:12px;border-radius:6px;background:#1d3453;overflow:hidden}
.db .bar i{display:block;height:100%}
.db .item{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #1d3453}
.db .pill{white-space:nowrap;border:1px solid currentColor;border-radius:99px;padding:2px 12px;font-weight:500;font-size:.875rem}
.db .btn{background:#1685FF;color:#06101F;border:0;border-radius:8px;padding:12px 18px;font:inherit;font-weight:500;cursor:pointer}
.db .btn.ghost{background:none;color:#e8f1fb;border:1px solid #1d3453}
.db .btn:focus-visible{outline:2px solid #35C8FF;outline-offset:2px}
.db .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:16px 0}
.db .ok{color:#4ade80}
.db .note{border-left:3px solid #35C8FF;padding:2px 12px;margin:16px 0}
@media(min-width:560px){.db .stats{grid-template-columns:repeat(4,1fr)}}
`;

function Dashboard({ onStart }: { onStart?: () => void }) {
  const [hist, setHist] = useState<Rec[]>(() => loadHist());
  const [msg, setMsg] = useState("");
  const d = summarise(hist);
  const n = d.rows.length;

  const copy = async () => {
    const text = [
      "# TrustGrid summary", "",
      `Passports: ${n} | Average score: ${d.avg}`, "",
      "## By band", ...BANDS.map((b, i) => `- ${b[0]}: ${d.byBand[i]}`), "",
      "## Highest risk", ...d.top.map((x) => `- ${x.r.name}: ${x.s.pct} (${BANDS[x.s.b][0]})`), "",
      "## Most often flagged", ...d.flags.filter((f) => f.n).map((f) => `- ${f.q.n}: ${f.n} of ${n}`), "",
      "*Provisional, rules-based scores. Not a certification or legal advice.*", "",
    ].join("\n");
    try { await navigator.clipboard.writeText(text); setMsg("Copied."); }
    catch { setMsg("Copy failed. Select the text and copy it manually."); }
  };

  if (!n) {
    return (
      <div className="db">
        <style>{CSS_DB}</style>
        <h1>Dashboard</h1>
        <p className="mu">No saved Passports yet. Assess a workflow and its result will appear here. Examples are not counted.</p>
        {onStart && <div className="row"><button className="btn" onClick={onStart}>Start an assessment</button></div>}
      </div>
    );
  }

  return (
    <div className="db">
      <style>{CSS_DB}</style>
      <h1>Dashboard</h1>
      <p className="mu">A summary of the Passports saved in this browser.</p>

      <div className="stats">
        <div className="stat"><b>{n}</b><span className="mu sm">Passports</span></div>
        <div className="stat"><b>{d.avg}</b><span className="mu sm">Average score</span></div>
        <div className="stat"><b style={{ color: BANDS[2][1] }}>{d.byBand[2]}</b><span className="mu sm">High</span></div>
        <div className="stat"><b style={{ color: BANDS[3][1] }}>{d.byBand[3]}</b><span className="mu sm">Critical</span></div>
      </div>

      <h2>By risk band</h2>
      {BANDS.map((b, i) => (
        <div className="brow" key={b[0]}>
          <span>{b[0]}</span>
          <div className="bar" role="img" aria-label={`${b[0]}: ${d.byBand[i]} of ${n}`}><i style={{ width: (d.byBand[i] / n) * 100 + "%", background: b[1] }} /></div>
          <span>{d.byBand[i]}</span>
        </div>
      ))}

      <h2>Highest-risk workflows</h2>
      {d.top.map((x) => (
        <div className="item" key={x.r.id}>
          <div><b>{x.r.name}</b><br /><span className="mu sm">{x.r.date}{x.r.owner ? ` · ${x.r.owner}` : ""}</span></div>
          <span className="pill" style={{ color: BANDS[x.s.b][1] }}>{BANDS[x.s.b][0]} · {x.s.pct}</span>
        </div>
      ))}

      <h2>Most often flagged</h2>
      <p className="mu sm">How many Passports have an answer that triggers each factor’s safeguard.</p>
      {d.flags.map((f) => (
        <div className="brow" key={f.q.id}>
          <span>{f.q.n}</span>
          <div className="bar" role="img" aria-label={`${f.q.n}: ${f.n} of ${n}`}><i style={{ width: (f.n / n) * 100 + "%", background: "#1685FF" }} /></div>
          <span>{f.n}</span>
        </div>
      ))}

      <div className="row">
        <button className="btn" onClick={copy}>Copy summary</button>
        <button className="btn ghost" onClick={() => { setHist(loadHist()); setMsg(""); }}>Refresh</button>
        <span className="ok sm" role="status">{msg}</span>
      </div>

      <div className="note">This dashboard only sees Passports saved in this browser on this device. Scores are provisional and rules-based, and they are not a certification or legal advice.</div>
    </div>
  );
}

// ===== NewPages =====
/* Product, Solutions, Demo, Reports, Implementation and Contact. Placeholders are in [SQUARE BRACKETS]. */

const CSS_NP = `
.np{color:#e8f1fb;max-width:720px;margin:0 auto;padding:24px 18px;font:400 16px/1.6 inherit}
.np *{box-sizing:border-box}
.np h1{margin:0;font-size:clamp(2rem,8vw,3rem);line-height:1.1;letter-spacing:-.02em}
.np h2{margin:32px 0 6px;font-size:1.3rem;line-height:1.2}
.np h3{margin:0;font-size:1.02rem}
.np p{margin:.5em 0}.np .mu{color:#93a8c2}.np .sm{font-size:.875rem}
.np .grid{display:grid;gap:12px;margin:14px 0}
.np .card{border:1px solid #1d3453;background:#0c1b31;border-radius:10px;padding:14px 16px}
.np .card p{margin:.3em 0 0;color:#93a8c2}
.np .tw{overflow-x:auto}.np table{border-collapse:collapse;width:100%;min-width:480px}
.np th,.np td{text-align:left;padding:8px 10px;border-bottom:1px solid #1d3453;vertical-align:top;font-size:.9rem}
.np tr.hit td:last-child{color:#fbbf24;font-weight:500}
.np .btn{background:#1685FF;color:#06101F;border:0;border-radius:8px;padding:10px 16px;font:inherit;font-weight:500;cursor:pointer}
.np .btn.ghost{background:none;color:#e8f1fb;border:1px solid #1d3453}
.np .btn[aria-pressed="true"]{background:#0c1b31;border-color:#35C8FF}
.np .btn:focus-visible{outline:2px solid #35C8FF;outline-offset:2px}
.np .row{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.np .meter{position:relative;display:flex;gap:3px;margin:20px 0 8px}
.np .meter span{flex:1;height:14px;border-radius:3px;opacity:.85}
.np .meter b{position:absolute;top:-7px;width:4px;height:28px;background:#e8f1fb;border-radius:2px;transform:translateX(-2px)}
.np .big{font-size:3.6rem;line-height:1;font-weight:700}
.np pre{background:#0c1b31;border:1px solid #1d3453;border-radius:10px;padding:14px;overflow-x:auto;font-size:.82rem;line-height:1.5;white-space:pre-wrap}
.np li{margin:.35em 0}
.np a{color:#35C8FF}
.np .note{border-left:3px solid #35C8FF;padding:2px 12px;margin:16px 0}
`;

const Cell = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <div className="card"><h3>{t}</h3><p>{children}</p></div>
);

function Product({ onGo }: { onGo?: (id: string) => void }) {
  return (
    <div className="np">
      <style>{CSS_NP}</style>
      <h1>TrustGrid</h1>
      <p className="mu">A documentation tool for AI workflows. It turns a few plain questions into a provisional risk score, the rules behind it, suggested safeguards and a Passport you can keep.</p>
      {onGo && <div className="row"><button className="btn" onClick={() => onGo("assessment")}>Start an assessment</button><button className="btn ghost" onClick={() => onGo("demo")}>See a demo</button></div>}
      <h2>What is included</h2>
      <div className="grid">
        <Cell t="Assessment">Eight questions about one workflow, answered in about two minutes.</Cell>
        <Cell t="Transparent risk rules">Published weights, bands and a floor rule. No hidden model.</Cell>
        <Cell t="AI Workflow Passport">A printable, exportable record of the answers, the score and the safeguards.</Cell>
        <Cell t="Safeguards checklist">One practical safeguard per risk factor, with what each fix can remove from the score.</Cell>
        <Cell t="Examples and tests">Eight sample workflows and built-in checks you can run to see the rules behave consistently.</Cell>
        <Cell t="Dashboard">A summary of every Passport saved in your browser.</Cell>
      </div>
      <h2>What it does not do yet</h2>
      <ul className="mu">
        <li>Accounts, shared workspaces or team sync.</li>
        <li>Automatic discovery of the AI tools your team uses.</li>
        <li>Integrations with other software.</li>
        <li>Certification or legal advice of any kind.</li>
      </ul>
    </div>
  );
}

function Solutions({ onGo }: { onGo?: (id: string) => void }) {
  const items: [string, string][] = [
    ["Recruiting and HR", "AI that screens, ranks or summarises people affects careers. Review, logging and telling applicants matter most here."],
    ["Customer support", "AI-drafted replies reach customers directly. Personal data, review and disclosure usually drive the score."],
    ["Marketing and content", "Public-facing copy raises audience and reputational risk, while data sensitivity is usually low."],
    ["Healthcare administration", "Notes and records can contain health data. Data handling and the tool you choose are the key factors."],
    ["Finance and lending", "Recommendations about money carry impact and data risk. Oversight and logging carry the most weight."],
    ["Education", "Marking help and student communication involve young people’s data and trust. Oversight and disclosure matter most."],
  ];
  return (
    <div className="np">
      <style>{CSS_NP}</style>
      <h1>Solutions</h1>
      <p className="mu">TrustGrid works on any workflow where AI is used. These are common areas and the factors that tend to matter in each. They are illustrative, not case studies or endorsements.</p>
      <div className="grid">{items.map(([t, d]) => <Cell key={t} t={t}>{d}</Cell>)}</div>
      {onGo && <div className="row"><button className="btn" onClick={() => onGo("demo")}>See sample scores</button></div>}
    </div>
  );
}

function Demo({ onGo }: { onGo?: (id: string) => void }) {
  const [id, setId] = useState(EXAMPLES[0].id);
  const ex = EXAMPLES.find((e) => e.id === id)!;
  const s = score(toRecord(ex.a));
  const c = BANDS[s.b][1];
  const flagged = s.rows.filter((r) => r.hit);
  return (
    <div className="np">
      <style>{CSS_NP}</style>
      <h1>Demo</h1>
      <p className="mu">Pick a sample workflow to see its Passport. Nothing is saved.</p>
      <div className="row" role="group" aria-label="Sample workflows">
        {EXAMPLES.map((e) => <button key={e.id} className="btn ghost" aria-pressed={e.id === id} onClick={() => setId(e.id)}>{e.name}</button>)}
      </div>
      <h2>{ex.name}</h2>
      <p className="mu">{ex.blurb}</p>
      <div className="card">
        <div className="big" style={{ color: c }}>{s.pct}<span className="mu sm"> / 100</span></div>
        <p style={{ color: c, fontWeight: 500 }}>{BANDS[s.b][0]} risk, provisional</p>
        <div className="meter" role="img" aria-label={`Risk ${s.pct} of 100, ${BANDS[s.b][0]}`}>
          {BANDS.map((b) => <span key={b[0]} style={{ background: b[1] }} />)}
          <b style={{ left: s.pct + "%" }} />
        </div>
      </div>
      <div className="tw"><table>
        <thead><tr><th>Factor</th><th>Answer</th><th>Points</th></tr></thead>
        <tbody>{s.rows.map((r) => <tr key={r.q.id} className={r.hit ? "hit" : ""}><td>{r.q.n}</td><td>{r.ans}</td><td>+{r.c.toFixed(1)}</td></tr>)}</tbody>
      </table></div>
      <h2>Suggested safeguards</h2>
      {flagged.length ? <ul>{flagged.map((r) => <li key={r.q.id}>{r.q.s}</li>)}</ul> : <p>No rule flagged.</p>}
      {onGo && <div className="row"><button className="btn" onClick={() => onGo("assessment")}>Assess your own workflow</button></div>}
    </div>
  );
}

function Reports() {
  const sample = EXAMPLES.find((e) => e.id === "support")!;
  const md = toMarkdown({ id: "SAMPLE", name: sample.name, owner: "", date: new Date().toLocaleDateString(), a: toRecord(sample.a) });
  return (
    <div className="np">
      <style>{CSS_NP}</style>
      <h1>Reports</h1>
      <p className="mu">Every assessment produces an AI Workflow Passport, a plain record of what was asked, what was answered and what the rules concluded.</p>
      <h2>What a Passport contains</h2>
      <ul className="mu">
        <li>The workflow name, owner, date and a Passport ID.</li>
        <li>The provisional score and risk band, with a meter.</li>
        <li>Every rule applied and the points each answer added.</li>
        <li>Whether the floor rule changed the result.</li>
        <li>Suggested safeguards for each flagged answer.</li>
        <li>A statement that the result is provisional and not a certification.</li>
      </ul>
      <h2>Ways to keep one</h2>
      <ul className="mu">
        <li>Print or save as PDF from the Passport page. The print layout shows only the report.</li>
        <li>Download or copy it as Markdown for documents, wikis or tickets.</li>
        <li>Leave it in History, saved in your browser on this device.</li>
      </ul>
      <h2>Sample, as Markdown</h2>
      <pre>{md}</pre>
      <div className="note">Re-run the assessment when the workflow, the tool or the data changes, and keep the earlier Passport so you can show how it changed.</div>
    </div>
  );
}

function Implementation() {
  const acts: [string, string][] = [
    [BANDS[0][0], "Record it and re-check when the workflow changes."],
    [BANDS[1][0], "Apply the flagged safeguards, name an owner and re-check within six months."],
    [BANDS[2][0], "Put safeguards in place before wider use, add a second reviewer and re-check every quarter."],
    [BANDS[3][0], "Pause or restrict use until safeguards are in place, escalate to leadership and take specialist advice."],
  ];
  const range = (i: number) => (i === 0 ? `Under ${BAND_EDGES[0]}` : i === 3 ? `${BAND_EDGES[2]} and over` : `${BAND_EDGES[i - 1]} to ${BAND_EDGES[i] - 1}`);
  return (
    <div className="np">
      <style>{CSS_NP}</style>
      <h1>Implementation</h1>
      <p className="mu">A simple way to make AI documentation a routine instead of a one-off. Adapt it to your team.</p>
      <h2>Roles</h2>
      <div className="grid">
        <Cell t="Workflow owner">Answers the assessment honestly, keeps the Passport and re-runs it when things change.</Cell>
        <Cell t="Reviewer">Checks outputs where oversight is required and signs off before use.</Cell>
        <Cell t="Sponsor">Reads the dashboard, decides on High and Critical workflows and makes sure safeguards get done.</Cell>
      </div>
      <h2>When to assess</h2>
      <ul className="mu">
        <li>Before a new AI workflow goes live.</li>
        <li>When the tool, the data or the audience changes.</li>
        <li>After an error or complaint linked to AI output.</li>
        <li>On a regular schedule, such as quarterly for anything High.</li>
      </ul>
      <h2>What to do with a score</h2>
      <div className="tw"><table>
        <thead><tr><th>Band</th><th>Score</th><th>Suggested action</th></tr></thead>
        <tbody>{acts.map(([b, a], i) => <tr key={b}><td style={{ color: BANDS[i][1] }}>{b}</td><td>{range(i)}</td><td>{a}</td></tr>)}</tbody>
      </table></div>
      <p className="mu sm">Starting points only, not legal or compliance advice.</p>
      <h2>A 30-day start</h2>
      <ol className="mu">
        <li>Week 1: list the AI workflows your team uses, including informal ones.</li>
        <li>Week 2: assess the five with the widest reach or the most sensitive data.</li>
        <li>Week 3: put the top safeguards in place and re-run those assessments.</li>
        <li>Week 4: review the dashboard together and set a re-check schedule.</li>
      </ol>
      <div className="note">The {Q.length} questions are a starting point for a conversation. Add your own review steps where your work needs them.</div>
    </div>
  );
}

function Contact({ email }: { email: string }) {
  return (
    <div className="np">
      <style>{CSS_NP}</style>
      <h1>Contact</h1>
      <p className="mu">Questions, corrections or feedback on the risk rules are welcome.</p>
      <div className="card">
        <h3>Email</h3>
        <p><a href={`mailto:${email}`}>{email}</a></p>
      </div>
      <h2>Feedback that helps most</h2>
      <ul className="mu">
        <li>A type of workflow that scored higher or lower than it should have, and why.</li>
        <li>A safeguard that is unclear or impractical.</li>
        <li>Anything on the site that overstates what TrustGrid does.</li>
      </ul>
      <p className="mu sm">Please do not send confidential or personal data by email.</p>
    </div>
  );
}

// ===== App shell =====
type PageId = "home" | "product" | "solutions" | "demo" | "assessment" | "dashboard" | "reports" | "implementation" | "risk-rules" | "safeguards" | "testing" | "about" | "faq" | "contact" | "privacy" | "terms";

const GROUPS: [string, [PageId, string][]][] = [
  ["Product", [["product", "Product"], ["solutions", "Solutions"], ["demo", "Demo"]]],
  ["Use it", [["assessment", "Assessment"], ["dashboard", "Dashboard"], ["reports", "Reports"], ["implementation", "Implementation"]]],
  ["Trust", [["risk-rules", "Risk rules"], ["safeguards", "Safeguards"], ["testing", "Testing"]]],
  ["Company", [["about", "About"], ["faq", "FAQ"], ["contact", "Contact"], ["privacy", "Privacy"], ["terms", "Terms"]]],
];
const PAGE_IDS: string[] = ["home", ...GROUPS.flatMap(([, l]) => l.map(([id]) => id))];

function pageFromHash(): PageId {
  try {
    const h = window.location.hash.replace("#", "");
    return (PAGE_IDS.includes(h) ? h : "home") as PageId;
  } catch { return "home"; }
}

const CSS_APP = `
.app{min-height:100vh;background:#06101F;color:#e8f1fb;font-family:inherit}
.app *{box-sizing:border-box}
.app header{display:flex;justify-content:space-between;align-items:center;gap:12px;max-width:720px;margin:0 auto;padding:16px 18px 6px}
.app .brand{background:none;border:0;color:#e8f1fb;font:inherit;font-weight:700;letter-spacing:.04em;cursor:pointer;padding:6px 0}
.app .brand i{color:#35C8FF;font-style:normal}
.app .menu{background:none;border:1px solid #1d3453;color:#e8f1fb;font:inherit;border-radius:8px;padding:8px 14px;cursor:pointer}
.app button:focus-visible,.app a:focus-visible{outline:2px solid #35C8FF;outline-offset:2px}
.app .panel{max-width:720px;margin:0 auto;padding:6px 18px 12px;display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}
.app .panel h4{margin:0 0 4px;color:#93a8c2;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;font-weight:500}
.app .panel button{display:block;width:100%;text-align:left;background:none;border:0;color:#e8f1fb;font:inherit;padding:7px 0;cursor:pointer}
.app .panel button[aria-current="page"]{color:#35C8FF;font-weight:500}
.app footer{max-width:720px;margin:20px auto 0;padding:18px 18px 32px;border-top:1px solid #1d3453;color:#93a8c2;font-size:.85rem}
`;

export default function App({ ask }: { ask?: (prompt: string) => Promise<string> }) {
  const [page, setPage] = useState<PageId>(pageFromHash);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (id: string) => {
    const p = (PAGE_IDS.includes(id) ? id : "home") as PageId;
    try { window.location.hash = p; } catch { /* hash unavailable */ }
    setPage(p); setOpen(false); window.scrollTo(0, 0);
  };

  let body: React.ReactNode;
  switch (page) {
    case "home": body = <SitePage page="home" onStart={() => go("assessment")} />; break;
    case "about": case "faq": case "privacy": case "terms": body = <SitePage page={page} />; break;
    case "product": body = <Product onGo={go} />; break;
    case "solutions": body = <Solutions onGo={go} />; break;
    case "demo": body = <Demo onGo={go} />; break;
    case "assessment": body = <TrustGrid ask={ask} />; break;
    case "dashboard": body = <Dashboard onStart={() => go("assessment")} />; break;
    case "reports": body = <Reports />; break;
    case "implementation": body = <Implementation />; break;
    case "risk-rules": body = <RiskRules />; break;
    case "safeguards": body = <Safeguards />; break;
    case "testing": body = <Testing />; break;
    case "contact": body = <Contact email={CONTACT} />; break;
  }

  return (
    <div className="app">
      <style>{CSS_APP}</style>
      <header>
        <button className="brand" onClick={() => go("home")}>AURENYX <i>TRUSTGRID</i></button>
        <button className="menu" aria-expanded={open} aria-controls="app-panel" onClick={() => setOpen(!open)}>{open ? "Close" : "Menu"}</button>
      </header>
      {open && (
        <nav className="panel" id="app-panel" aria-label="Site">
          {GROUPS.map(([group, links]) => (
            <div key={group}>
              <h4>{group}</h4>
              {links.map(([id, label]) => <button key={id} aria-current={page === id ? "page" : undefined} onClick={() => go(id)}>{label}</button>)}
            </div>
          ))}
        </nav>
      )}
      <main>{body}</main>
      <footer>Aurenyx Vælor · Intelligence. Integrity. Infinity. TrustGrid scores are provisional and rules-based. It documents AI use and does not certify compliance with any law or standard.</footer>
    </div>
  );
}
