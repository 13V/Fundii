"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

const sf = "'IBM Plex Sans',-apple-system,BlinkMacSystemFont,sans-serif";
const se = "'Source Serif 4',Georgia,serif";
const green = "#40916C";
const greenLight = "#EDF5F0";
const greenDark = "#2D6A4F";
const border = "#E8E5DE";
const muted = "#8C8C8C";
const bg = "#FAFAF7";
const amber = "#C8842E";
const amberBg = "#FEF3E2";

const QUESTIONS = [
  { key: "businessName", label: "Business name", placeholder: "e.g. Smith Electrical Pty Ltd", type: "text" },
  { key: "businessDesc", label: "Describe your business in 2-3 sentences", placeholder: "What you do, how long you've operated, where you're based...", type: "textarea" },
  { key: "project", label: "What's the project you need funding for?", placeholder: "e.g. Replacing old workshop lighting with LED panels and installing rooftop solar", type: "textarea" },
  { key: "spending", label: "What will you spend the money on?", placeholder: "e.g. 40 LED panel lights ($8,000), 6.6kW solar system ($9,000), electrician labour ($4,000), energy audit ($2,000)", type: "textarea" },
  { key: "budget", label: "Estimated total project cost", placeholder: "e.g. $46,000", type: "text" },
  { key: "grantAmount", label: "How much grant funding are you requesting?", placeholder: "e.g. $23,000 (up to 50% of project cost)", type: "text" },
  { key: "outcomes", label: "What's the expected outcome or benefit?", placeholder: "e.g. 60% reduction in energy costs, lower carbon footprint, safer working conditions", type: "textarea" },
  { key: "employees", label: "How many people work in your business?", placeholder: "e.g. 8 full-time, 3 casual", type: "text" },
  { key: "timeline", label: "How long will the project take?", placeholder: "e.g. 3 months from approval", type: "text" },
  { key: "priorFunding", label: "Have you received government funding before?", placeholder: "e.g. No / Yes — received $5,000 Digital Solutions grant in 2024", type: "text" },
];

type IntakeForm = Record<string, string>;
type Grant = Record<string, unknown>;

function LoadingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: green,
          animation: `dot-pulse 1.2s ease ${i * 0.2}s infinite`,
          display: "inline-block",
        }} />
      ))}
    </span>
  );
}

export default function ApplyPage() {
  const { grantId } = useParams<{ grantId: string }>();
  const searchParams = useSearchParams();
  const paid = searchParams.get("success") === "true";

  const [grant, setGrant] = useState<Grant | null>(null);
  const [loadingGrant, setLoadingGrant] = useState(true);
  const [phase, setPhase] = useState<"gate" | "intake" | "generating" | "result">(paid ? "intake" : "gate");
  const [form, setForm] = useState<IntakeForm>({});
  const [application, setApplication] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!grantId) return;
    fetch(`/api/grants/${grantId}`)
      .then(r => r.json())
      .then(d => { setGrant(d.grant); setLoadingGrant(false); })
      .catch(() => setLoadingGrant(false));
  }, [grantId]);

  const allFilled = QUESTIONS.every(q => (form[q.key] || "").trim().length > 0);
  const completedCount = QUESTIONS.filter(q => (form[q.key] || "").trim().length > 0).length;

  const startCheckout = async (tier: "apply" | "apply_pro") => {
    const res = await fetch("/api/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grantId,
        tier,
        grantTitle: grant?.title as string || "",
      }),
    });
    const { url, error: err } = await res.json();
    if (url) window.location.href = url;
    else setError(err || "Could not start checkout");
  };

  const generate = async () => {
    setPhase("generating");
    setError("");
    setApplication("");

    try {
      const res = await fetch("/api/generate-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId, intake: form }),
      });
      const data = await res.json();
      if (data.application) {
        setApplication(data.application);
        setPhase("result");
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
        setPhase("intake");
      }
    } catch {
      setError("Connection error. Please check your internet and try again.");
      setPhase("intake");
    }
  };

  const copyAll = () => {
    navigator.clipboard.writeText(application);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const grantTitle = (grant?.title || grant?.name || "this grant") as string;
  const grantAmount = (grant?.amount_text || grant?.amount || "") as string;
  const grantSource = (grant?.source || "Australian Government") as string;
  const grantCloseDate = (grant?.close_date || "") as string;
  const criteria = (grant?.assessment_criteria as string[] | undefined) || [];

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: sf, color: "#1A1A1A" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        .gb{transition:all .2s}.gb:hover{background:${greenDark}!important;transform:translateY(-1px);box-shadow:0 4px 12px rgba(45,106,79,.15)}
        .gi{transition:border .15s}.gi:focus{border-color:${greenDark}!important;outline:none}
        @keyframes dot-pulse{0%,100%{opacity:.3}50%{opacity:1}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fi{animation:fadeIn .4s ease forwards}
        textarea{resize:vertical;min-height:80px;font-family:${sf}}
        input{font-family:${sf}}
      `}</style>

      {/* Nav */}
      <div style={{ borderBottom: `1px solid ${border}`, background: bg, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 660, margin: "0 auto", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <a href="/" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-.3px", textDecoration: "none", color: "#1A1A1A" }}>GrantBase</a>
          <span style={{ fontSize: 12, color: muted, fontWeight: 500 }}>Application Drafter</span>
        </div>
      </div>

      <div style={{ maxWidth: 660, margin: "0 auto", padding: "0 24px 48px" }}>

        {/* Grant info card */}
        <div style={{ marginTop: 32, background: "#fff", border: `1px solid ${border}`, borderRadius: 10, padding: "20px 22px" }}>
          {loadingGrant ? (
            <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LoadingDots />
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: green, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>Applying for</p>
                  <h2 style={{ fontFamily: se, fontSize: 20, fontWeight: 800, letterSpacing: "-.5px", marginBottom: 4 }}>{grantTitle}</h2>
                  <p style={{ fontSize: 13, color: "#5C5C5C" }}>{grantSource}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  {grantAmount && <div style={{ fontSize: 18, fontWeight: 800, color: greenDark, fontFamily: se }}>Up to {grantAmount}</div>}
                  {grantCloseDate && <div style={{ fontSize: 12, color: amber, fontWeight: 600, marginTop: 2 }}>Closes {grantCloseDate}</div>}
                </div>
              </div>

              {criteria.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${border}` }}>
                  <button onClick={() => setActiveSection(activeSection === "criteria" ? null : "criteria")} style={{
                    width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer",
                    display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: sf, padding: 0,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Assessment criteria the AI will address</span>
                    <span style={{ fontSize: 16, color: muted, transform: activeSection === "criteria" ? "rotate(45deg)" : "none", transition: "transform .2s" }}>+</span>
                  </button>
                  <div style={{ overflow: "hidden", maxHeight: activeSection === "criteria" ? 400 : 0, opacity: activeSection === "criteria" ? 1 : 0, transition: "all .3s ease" }}>
                    <div style={{ paddingTop: 10 }}>
                      {criteria.map((c, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}><circle cx="7" cy="7" r="6" stroke={green} strokeWidth="1.3" /><path d="M4 7L6.5 9L10 4.5" stroke={green} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          <span style={{ fontSize: 13, color: "#5C5C5C", lineHeight: 1.4 }}>{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* GATE: Stripe payment */}
        {phase === "gate" && (
          <div style={{ marginTop: 28, textAlign: "center" }}>
            <h3 style={{ fontFamily: se, fontSize: 22, fontWeight: 800, letterSpacing: "-.5px", marginBottom: 10 }}>
              Generate your application
            </h3>
            <p style={{ fontSize: 15, color: "#5C5C5C", marginBottom: 28, lineHeight: 1.6, maxWidth: 480, margin: "0 auto 28px" }}>
              Answer 10 questions about your business and project. Our AI will write a complete, professional grant application addressing every assessment criterion.
            </p>

            {error && (
              <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#991B1B" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <div style={{ background: "#fff", border: `1px solid ${border}`, borderRadius: 10, padding: "24px 28px", maxWidth: 260, textAlign: "left" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Standard</div>
                <div style={{ fontFamily: se, fontSize: 28, fontWeight: 900, letterSpacing: "-1px", marginBottom: 4, color: "#1A1A1A" }}>$199</div>
                <div style={{ fontSize: 12, color: muted, marginBottom: 16 }}>One-time · AUD</div>
                <ul style={{ listStyle: "none", padding: 0, marginBottom: 20 }}>
                  {["Complete AI application draft","All criteria addressed","Copy & edit ready","Instant delivery"].map(f => (
                    <li key={f} style={{ fontSize: 13, color: "#3D3D3D", display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="7" cy="7" r="6" stroke={green} strokeWidth="1.3" /><path d="M4 7L6.5 9L10 4.5" stroke={green} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button className="gb" onClick={() => startCheckout("apply")} style={{
                  width: "100%", padding: "12px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: green, color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: sf,
                }}>
                  Get started — $199
                </button>
              </div>

              <div style={{ background: amberBg, border: "1px solid #F5DEB3", borderRadius: 10, padding: "24px 28px", maxWidth: 260, textAlign: "left" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: amber, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Apply Pro</div>
                <div style={{ fontFamily: se, fontSize: 28, fontWeight: 900, letterSpacing: "-1px", marginBottom: 4, color: "#1A1A1A" }}>$499</div>
                <div style={{ fontSize: 12, color: muted, marginBottom: 16 }}>One-time · AUD</div>
                <ul style={{ listStyle: "none", padding: 0, marginBottom: 20 }}>
                  {["Everything in Standard","Multiple AI revision passes","Competitive positioning analysis","30-min review call with specialist"].map(f => (
                    <li key={f} style={{ fontSize: 13, color: "#3D3D3D", display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="7" cy="7" r="6" stroke={amber} strokeWidth="1.3" /><path d="M4 7L6.5 9L10 4.5" stroke={amber} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => startCheckout("apply_pro")} style={{
                  width: "100%", padding: "12px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: amber, color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: sf,
                }}>
                  Upgrade — $499
                </button>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "#C4C4BA", marginTop: 16 }}>Secure payment via Stripe · Instant access after payment</p>
          </div>
        )}

        {/* INTAKE FORM */}
        {(phase === "intake" || phase === "generating") && (
          <div style={{ marginTop: 28, paddingBottom: 64 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: se, fontSize: 20, fontWeight: 700, letterSpacing: "-.4px" }}>Your business details</h3>
              <span style={{ fontSize: 12, color: muted, fontWeight: 500 }}>{completedCount}/{QUESTIONS.length} complete</span>
            </div>

            <div style={{ height: 3, background: border, borderRadius: 2, marginBottom: 28, overflow: "hidden" }}>
              <div style={{ height: "100%", background: green, borderRadius: 2, transition: "width .3s", width: `${(completedCount / QUESTIONS.length) * 100}%` }} />
            </div>

            {error && (
              <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#991B1B" }}>
                {error}
              </div>
            )}

            {QUESTIONS.map(q => (
              <div key={q.key} style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#1A1A1A" }}>
                  {q.label}
                </label>
                {q.type === "textarea" ? (
                  <textarea
                    className="gi"
                    value={form[q.key] || ""}
                    onChange={e => setForm({ ...form, [q.key]: e.target.value })}
                    placeholder={q.placeholder}
                    disabled={phase === "generating"}
                    style={{
                      width: "100%", padding: "11px 13px", borderRadius: 8, border: `2px solid ${border}`,
                      fontSize: 14, color: "#1A1A1A", background: "#fff", lineHeight: 1.5,
                    }}
                  />
                ) : (
                  <input
                    className="gi"
                    type="text"
                    value={form[q.key] || ""}
                    onChange={e => setForm({ ...form, [q.key]: e.target.value })}
                    placeholder={q.placeholder}
                    disabled={phase === "generating"}
                    style={{
                      width: "100%", padding: "11px 13px", borderRadius: 8, border: `2px solid ${border}`,
                      fontSize: 14, color: "#1A1A1A", background: "#fff",
                    }}
                  />
                )}
              </div>
            ))}

            <div style={{ marginTop: 8, padding: "20px 0", borderTop: `1px solid ${border}` }}>
              {phase === "generating" ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ marginBottom: 12 }}><LoadingDots /></div>
                  <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Drafting your application...</p>
                  <p style={{ fontSize: 13, color: muted }}>AI is addressing each assessment criterion. This takes 20-40 seconds.</p>
                </div>
              ) : (
                <>
                  <button
                    className={allFilled ? "gb" : ""}
                    onClick={allFilled ? generate : undefined}
                    disabled={!allFilled}
                    style={{
                      width: "100%", padding: "14px 24px", borderRadius: 8, border: "none", cursor: allFilled ? "pointer" : "default",
                      background: allFilled ? green : "#E8E5DE", color: allFilled ? "#fff" : muted,
                      fontSize: 15, fontWeight: 600, fontFamily: sf, transition: "all .2s",
                    }}
                  >
                    Generate my application draft
                  </button>
                  <p style={{ fontSize: 12, color: "#C4C4BA", textAlign: "center", marginTop: 10 }}>
                    Fill in all {QUESTIONS.length} fields to generate
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* RESULT */}
        {phase === "result" && (
          <div ref={resultRef} className="fi" style={{ marginTop: 28, paddingBottom: 64 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: se, fontSize: 20, fontWeight: 700, letterSpacing: "-.4px" }}>Your application draft</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={copyAll} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 6, border: `1px solid ${border}`, background: "#fff",
                  fontSize: 13, fontWeight: 600, color: copied ? greenDark : "#3D3D3D", cursor: "pointer", fontFamily: sf,
                }}>
                  {copied ? "✓ Copied" : "Copy all"}
                </button>
                <button onClick={() => { setPhase("intake"); setApplication(""); }} style={{
                  padding: "8px 14px", borderRadius: 6, border: `1px solid ${border}`, background: "#fff",
                  fontSize: 13, fontWeight: 600, color: "#3D3D3D", cursor: "pointer", fontFamily: sf,
                }}>
                  Edit answers
                </button>
              </div>
            </div>

            <div style={{ background: greenLight, border: "1px solid #D3E8DC", borderRadius: 8, padding: "10px 14px", marginBottom: 20, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="8" cy="8" r="7" stroke={green} strokeWidth="1.5" /><path d="M8 5V8.5M8 11H8.01" stroke={green} strokeWidth="1.5" strokeLinecap="round" /></svg>
              <span style={{ fontSize: 12, color: greenDark, lineHeight: 1.5 }}>
                AI-generated first draft. Review carefully, adjust details, and add supporting documents before submitting through the grant portal.
              </span>
            </div>

            <div style={{
              background: "#fff", border: `1px solid ${border}`, borderRadius: 10, padding: "28px 26px",
              fontSize: 14, lineHeight: 1.75, color: "#2D2D2D", whiteSpace: "pre-wrap", fontFamily: sf,
            }}>
              {application}
            </div>

            <div style={{ marginTop: 28, background: "#fff", border: `1px solid ${border}`, borderRadius: 10, padding: "22px 24px" }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Before you submit</h4>
              {[
                "Review every section and adjust any details that aren't accurate",
                "Prepare supporting documents: ABN certificate, recent financial statements, quotes for equipment",
                grantCloseDate ? `Submit through the grant portal before ${grantCloseDate}` : "Check the grant portal for submission deadlines",
                "Keep a copy of your submission for your records",
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", border: `1.5px solid ${border}`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
                    fontSize: 11, fontWeight: 700, color: muted,
                  }}>{i + 1}</div>
                  <span style={{ fontSize: 13, color: "#5C5C5C", lineHeight: 1.5 }}>{s}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, textAlign: "center" }}>
              <button onClick={generate} style={{ fontSize: 13, color: muted, background: "none", border: `1px solid ${border}`, borderRadius: 6, padding: "8px 14px", cursor: "pointer", fontFamily: sf }}>
                Regenerate draft
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
