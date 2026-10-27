import React, { useState } from "react";

type Opt = [string, number];
type Question = { id: string; n: string; w: number; t: string; o: Opt[]; s: string };
type Rec = { id: string; name: string; owner: string; date: string; a: Record<string, number> };
type View = "assess" | "passport" | "history";
type Example = { id: string; name: string; blurb: string; facts: string; a: number[] };

const Q: Question[] = [
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
const EXAMPLES: Example[] = [
  { id: "meeting", name: "Internal meeting summaries", blurb: "Staff use a business AI plan to summarise their own meetings.", facts: "Drafts text · internal data · always reviewed · team only", a: [0, 1, 0, 1, 1, 1, 0, 0] },
  { id: "public-data", name: "Analysing public datasets", blurb: "An analyst runs AI over open data on a local model.", facts: "Analyses data · public data · always reviewed · only me", a: [1, 0, 0, 1, 0, 0, 2, 0] },
  { id: "marketing", name: "Marketing copy", blurb: "Public posts drafted on a free consumer account, sampled for review.", facts: "Drafts text · public audience · consumer tool · sampled review", a: [0, 0, 1, 2, 3, 2, 1, 1] },
  { id: "support", name: "Customer support replies", blurb: "AI drafts replies using customer details, with light review.", facts: "Talks to customers · personal data · sampled review · not disclosed", a: [2, 2, 1, 2, 2, 1, 1, 2] },
  { id: "cv-bad", name: "CV screening, no review", blurb: "A free AI tool ranks job applicants and nobody checks it.", facts: "Decisions about people · personal data · no review · no logs", a: [3, 2, 3, 3, 1, 2, 2, 2] },
  { id: "cv-good", name: "CV screening, with safeguards", blurb: "Same task with masked data, a business tool, human sign-off, logs and disclosure.", facts: "Decisions about people · internal data · always reviewed · logged", a: [3, 1, 0, 3, 1, 1, 0, 0] },
  { id: "medical", name: "Medical note summaries", blurb: "Clinic staff paste patient notes into a consumer chatbot.", facts: "Drafts text · health data · reviewed only when odd · consumer tool", a: [0, 3, 2, 3, 1, 2, 2, 1] },
  { id: "loan", name: "Loan pre-checks", blurb: "A private model recommends decisions on financial data, sampled for review.", facts: "Decisions about money · financial data · sampled review · private tool", a: [3, 3, 1, 2, 2, 0, 0, 1] },
];

const BANDS: [string, string][] = [["Low", "#22c55e"], ["Moderate", "#eab308"], ["High", "#f97316"], ["Critical", "#ef4444"]];
const W = Q.reduce((s, q) => s + q.w, 0);
const KEY = "tg_hist";
const bandOf = (p: number) => (p < 25 ? 0 : p < 50 ? 1 : p < 75 ? 2 : 3);
const pts = (a: Record<string, number>, id: string) => Q.find((q) => q.id === id)!.o[a[id]][1];
const toRecord = (arr: number[]) => Object.fromEntries(Q.map((q, i) => [q.id, arr[i]]));

function score(a: Record<string, number>) {
  const rows = Q.map((q) => {
    const p = q.o[a[q.id]][1];
    return { q, ans: q.o[a[q.id]][0], p, c: (((p / 5) * q.w) / W) * 100, hit: p >= 3 };
  });
  let pct = rows.reduce((s, r) => s + r.c, 0);
  let floor = false;
  if ((pts(a, "data") >= 5 || pts(a, "impact") >= 5) && pts(a, "oversight") >= 4 && pct < 50) {
    pct = 50;
    floor = true;
  }
  pct = Math.round(pct);
  return { rows, pct, b: bandOf(pct), floor };
}

function loadHist(): Rec[] {
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

const CSS = `
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

export default function TrustGrid({ ask }: Props) {
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
            <p className="mu sm">Bands: Low under 25, Moderate 25 to 49, High 50 to 74, Critical 75 and over.</p>
          </div>
          <h2>Rules applied</h2>
          <div className="tw"><table><thead><tr><th>Factor</th><th>Answer</th><th>Points</th></tr></thead><tbody>
            {s.rows.map((x) => <tr key={x.q.id} className={x.hit ? "hit" : ""}><td>{x.q.n}</td><td>{x.ans}</td><td>+{x.c.toFixed(1)}</td></tr>)}
          </tbody></table></div>
          <p className="mu sm">Each answer scores 0 to 5, multiplied by the factor’s weight and scaled to 100. Highlighted rows scored 3 or more and trigger a safeguard.</p>
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
      <style>{CSS}</style>
      {nav}
      {body}
      <p className="mu sm" style={{ marginTop: 30 }}>Intelligence. Integrity. Infinity. Scores are provisional and rules-based. TrustGrid documents AI use; it does not certify compliance with any law or standard.</p>
    </div>
  );
}
