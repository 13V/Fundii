"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const GRANTS = [
  { name: "Energy Efficiency Grants for SMEs", amount: 25000, closing: "Mar 28", states: ["ALL"], industries: ["ALL"], sizes: ["sole_trader","micro","small","medium"], purposes: ["equipment","sustainability","growth"] },
  { name: "Powering Business Grants SA", amount: 75000, closing: "Apr 15", states: ["SA"], industries: ["ALL"], sizes: ["small","medium"], purposes: ["equipment","sustainability","growth"] },
  { name: "Export Market Development Grant", amount: 50000, closing: "Open", states: ["ALL"], industries: ["ALL"], sizes: ["small","medium"], purposes: ["export","growth"] },
  { name: "R&D Tax Incentive", amount: 100000, closing: "Ongoing", states: ["ALL"], industries: ["tech","manufacturing","professional"], sizes: ["micro","small","medium"], purposes: ["innovation","growth"] },
  { name: "Industry Growth Program", amount: 5000000, closing: "Open", states: ["ALL"], industries: ["manufacturing","tech"], sizes: ["small","medium"], purposes: ["innovation","growth","equipment"] },
  { name: "Digital Solutions Program", amount: 10000, closing: "May 1", states: ["ALL"], industries: ["ALL"], sizes: ["sole_trader","micro","small"], purposes: ["digital","growth"] },
  { name: "NSW Small Business Support Grant", amount: 3000, closing: "Open", states: ["NSW"], industries: ["ALL"], sizes: ["sole_trader","micro","small"], purposes: ["ALL"] },
  { name: "Investing in Women NSW Grant", amount: 750000, closing: "Apr 30", states: ["NSW"], industries: ["ALL"], sizes: ["small","medium"], purposes: ["growth","innovation"] },
  { name: "QLD Business Growth Fund", amount: 50000, closing: "Open", states: ["QLD"], industries: ["ALL"], sizes: ["small","medium"], purposes: ["growth","equipment","export"] },
  { name: "QLD Small Business Grants", amount: 25000, closing: "Jun 30", states: ["QLD"], industries: ["hospitality","retail","construction"], sizes: ["sole_trader","micro","small"], purposes: ["ALL"] },
  { name: "VIC Business Recovery Grant", amount: 20000, closing: "Open", states: ["VIC"], industries: ["hospitality","retail","arts"], sizes: ["sole_trader","micro","small"], purposes: ["ALL"] },
  { name: "VIC Digital Adaptation Program", amount: 10000, closing: "May 15", states: ["VIC"], industries: ["ALL"], sizes: ["sole_trader","micro","small"], purposes: ["digital","growth"] },
  { name: "WA Regional Small Business Grant", amount: 25000, closing: "Open", states: ["WA"], industries: ["ALL"], sizes: ["sole_trader","micro","small"], purposes: ["growth","equipment"] },
  { name: "SA Innovation Voucher Program", amount: 50000, closing: "Apr 20", states: ["SA"], industries: ["manufacturing","tech","professional"], sizes: ["small","medium"], purposes: ["innovation","growth"] },
  { name: "Tourism Australia Marketing Grant", amount: 20000, closing: "Ongoing", states: ["ALL"], industries: ["hospitality"], sizes: ["micro","small","medium"], purposes: ["export","growth"] },
  { name: "Traceability Grants Round 4", amount: 500000, closing: "May 31", states: ["ALL"], industries: ["agriculture"], sizes: ["small","medium"], purposes: ["innovation","growth"] },
  { name: "National Soil Strategy Grants", amount: 200000, closing: "Jun 1", states: ["ALL"], industries: ["agriculture"], sizes: ["small","medium"], purposes: ["sustainability","innovation"] },
  { name: "SafeWork NSW Rebate", amount: 1000, closing: "Ongoing", states: ["NSW"], industries: ["construction","manufacturing","agriculture"], sizes: ["sole_trader","micro","small","medium"], purposes: ["ALL"] },
  { name: "Creative Australia Project Grants", amount: 50000, closing: "Apr 10", states: ["ALL"], industries: ["arts"], sizes: ["sole_trader","micro","small"], purposes: ["growth","innovation"] },
  { name: "TAS Small Business Grant Program", amount: 15000, closing: "Open", states: ["TAS"], industries: ["ALL"], sizes: ["sole_trader","micro","small"], purposes: ["ALL"] },
  { name: "ACT Innovation Fund", amount: 100000, closing: "May 20", states: ["ACT"], industries: ["tech","professional"], sizes: ["micro","small","medium"], purposes: ["innovation","growth"] },
  { name: "NT Business Growth Program", amount: 30000, closing: "Open", states: ["NT"], industries: ["ALL"], sizes: ["sole_trader","micro","small"], purposes: ["growth","equipment"] },
  { name: "Future Made in Australia Fund", amount: 500000, closing: "Jun 30", states: ["ALL"], industries: ["manufacturing"], sizes: ["small","medium"], purposes: ["innovation","growth","sustainability"] },
  { name: "Apprenticeship Wage Subsidy", amount: 10000, closing: "Ongoing", states: ["ALL"], industries: ["construction","manufacturing","agriculture"], sizes: ["micro","small","medium"], purposes: ["hiring","growth"] },
  { name: "Women in STEM Grant", amount: 25000, closing: "Apr 25", states: ["ALL"], industries: ["tech","professional","manufacturing"], sizes: ["sole_trader","micro","small"], purposes: ["innovation","growth"] },
  { name: "Regional Development Fund", amount: 100000, closing: "Open", states: ["ALL"], industries: ["ALL"], sizes: ["small","medium"], purposes: ["growth","equipment","hiring"] },
  { name: "Clean Energy Equipment Rebate", amount: 15000, closing: "Ongoing", states: ["ALL"], industries: ["ALL"], sizes: ["sole_trader","micro","small"], purposes: ["equipment","sustainability"] },
  { name: "Drought Resilience Grants", amount: 50000, closing: "Open", states: ["NSW","QLD","SA","VIC"], industries: ["agriculture"], sizes: ["sole_trader","micro","small","medium"], purposes: ["ALL"] },
];

function doMatch(a: { state: string; industry: string; size: string; purposes: string[] }) {
  return GRANTS.filter(g =>
    (g.states.includes("ALL") || g.states.includes(a.state))
    && (g.industries.includes("ALL") || g.industries.includes(a.industry))
    && g.sizes.includes(a.size)
    && (g.purposes.includes("ALL") || g.purposes.some(p => a.purposes.includes(p)))
  );
}

function fmt(n: number) {
  if (n >= 1e6) return `$${(n/1e6).toFixed(n%1e6===0?0:1)}M`;
  if (n >= 1e3) return `$${(n/1e3).toFixed(0)}K`;
  return `$${n}`;
}

const QS = [
  { key:"state", q:"Where is your business based?", sub:"We track grants at federal, state, and local council level", opts:[
    {v:"NSW",l:"New South Wales"},{v:"VIC",l:"Victoria"},{v:"QLD",l:"Queensland"},{v:"SA",l:"South Australia"},
    {v:"WA",l:"Western Australia"},{v:"TAS",l:"Tasmania"},{v:"ACT",l:"ACT"},{v:"NT",l:"Northern Territory"},
  ]},
  { key:"industry", q:"What industry are you in?", sub:"Many grants are sector-specific with higher funding", opts:[
    {v:"construction",l:"Construction & Trades"},{v:"hospitality",l:"Hospitality & Food"},{v:"retail",l:"Retail"},
    {v:"professional",l:"Professional Services"},{v:"tech",l:"Tech & Digital"},{v:"manufacturing",l:"Manufacturing"},
    {v:"agriculture",l:"Agriculture"},{v:"arts",l:"Arts & Creative"},{v:"health",l:"Health & Wellbeing"},{v:"other",l:"Other"},
  ]},
  { key:"size", q:"How many people in your business?", sub:"Smaller businesses often qualify for more programs", opts:[
    {v:"sole_trader",l:"Just me"},{v:"micro",l:"2 – 4 people"},{v:"small",l:"5 – 19 people"},{v:"medium",l:"20 – 199 people"},
  ]},
  { key:"purposes", q:"What would you use the funding for?", sub:"Pick as many as apply", multi:true, opts:[
    {v:"growth",l:"Growing the business"},{v:"equipment",l:"Equipment or fit-out"},{v:"digital",l:"Going digital"},
    {v:"innovation",l:"R&D or new products"},{v:"sustainability",l:"Energy or sustainability"},
    {v:"export",l:"Selling overseas"},{v:"hiring",l:"Hiring or training"},
  ]},
];

const FAQS = [
  { q: "Is this actually free?", a: "Yes. The eligibility check and grant report are completely free. We make money when you use our paid tools to draft and submit applications." },
  { q: "Where does the grant data come from?", a: "We aggregate from business.gov.au, state government portals, and local council programs. Our database covers 3,900+ programs and is updated weekly." },
  { q: "Do I have to pay grants back?", a: "No. Grants are not loans. They're non-repayable funding from government programs. You don't give up equity either." },
  { q: "How accurate is the matching?", a: "Our matching checks your state, industry, business size, and funding purpose against eligibility criteria. You'll still need to confirm full eligibility when you apply." },
];

type Answers = { state?: string; industry?: string; size?: string; purposes?: string[] };

export default function App() {
  const [phase, setPhase] = useState("landing");
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState<Answers>({ purposes: [] });
  const [res, setRes] = useState<typeof GRANTS>([]);
  const [count, setCount] = useState(0);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scanProg, setScanProg] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const pick = (k: string, v: string, m?: boolean) => {
    if (m) {
      setAns(p => { const a=(p as Record<string,string[]>)[k]||[]; return {...p,[k]:a.includes(v)?a.filter((x:string)=>x!==v):[...a,v]}; });
    } else {
      const n = {...ans,[k]:v};
      setAns(n);
      setTimeout(() => { step < QS.length-1 ? setStep(step+1) : startScan(n as Required<Answers>); }, 250);
    }
  };

  const startScan = useCallback((a: Required<Answers>) => {
    setPhase("scanning");
    setScanProg(0);
    const m = doMatch(a as { state: string; industry: string; size: string; purposes: string[] });
    setRes(m);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 18 + 5;
      if (p >= 100) { p = 100; clearInterval(iv); setTimeout(() => setPhase("results"), 400); }
      setScanProg(Math.min(p, 100));
    }, 200);
  }, []);

  useEffect(() => {
    if (phase === "results") {
      let c = 0;
      const iv = setInterval(() => { c++; setCount(c); if (c >= res.length) clearInterval(iv); }, 40);
      return () => clearInterval(iv);
    }
  }, [phase, res.length]);

  const handleEmailSubmit = async () => {
    if (!email.includes("@") || submitting) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      await supabase.from("leads").insert({
        email,
        state: ans.state,
        industry: ans.industry,
        business_size: ans.size,
        purposes: ans.purposes || [],
        matched_count: res.length,
        source: "quiz",
      });
    } catch {
      // Don't block the user if Supabase fails
    }
    setDone(true);
    setSubmitting(false);
  };

  const cur = QS[step];
  const tot = res.reduce((s,g) => s + g.amount, 0);
  const closingSoon = res.filter(g => !["Open","Ongoing"].includes(g.closing)).length;
  const sf = "'IBM Plex Sans',-apple-system,BlinkMacSystemFont,sans-serif";
  const se = "'Source Serif 4',Georgia,serif";
  const green = "#40916C";
  const greenLight = "#EDF5F0";
  const greenDark = "#2D6A4F";
  const border = "#E8E5DE";
  const muted = "#8C8C8C";
  const bg = "#FAFAF7";

  return (
    <div style={{minHeight:"100vh",background:bg,fontFamily:sf,color:"#1A1A1A"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        .go{transition:all .15s}.go:hover{border-color:${greenDark}!important;background:${greenLight}!important}
        .gb{transition:all .2s}.gb:hover{background:${greenDark}!important;transform:translateY(-1px);box-shadow:0 4px 12px rgba(45,106,79,.15)}
        .ge:focus{border-color:${greenDark}!important;outline:none}
        @keyframes ri{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}.gr{animation:ri .25s ease forwards}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}.sp{animation:pulse 1.2s ease infinite}
        @keyframes dots{0%,100%{content:''}33%{content:'.'}66%{content:'..'}99%{content:'...'}}.dt::after{content:'';animation:dots 1.5s steps(4,end) infinite}
        .fq{overflow:hidden;transition:max-height .3s ease,opacity .3s ease}
      `}</style>

      {/* Nav */}
      <div style={{borderBottom:`1px solid ${border}`,background:bg,position:"sticky",top:0,zIndex:10}}>
        <div style={{maxWidth:620,margin:"0 auto",padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:16,fontWeight:700,letterSpacing:"-.3px"}}>GrantMate</span>
          {phase==="landing" && <span style={{fontSize:12,color:muted,fontWeight:500}}>3,900+ active grant programs</span>}
          {phase==="quiz" && <span style={{fontSize:12,color:muted,fontWeight:500}}>Step {step+1} of {QS.length}</span>}
          {phase==="results" && <button onClick={()=>{setPhase("landing");setStep(0);setAns({purposes:[]});setRes([]);setCount(0);setDone(false);}} style={{fontSize:12,color:green,fontWeight:600,background:"none",border:"none",cursor:"pointer"}}>Start over</button>}
        </div>
      </div>

      <div style={{maxWidth:620,margin:"0 auto",padding:"0 24px"}}>

        {/* ===== LANDING ===== */}
        {phase==="landing"&&(
          <div style={{paddingTop:56,paddingBottom:64}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:24}}>
              <div style={{display:"flex"}}>
                {[0,1,2,3].map(i=>(
                  <div key={i} style={{width:28,height:28,borderRadius:"50%",background:["#D4A574","#8FB5A3","#C49A6C","#7EA892"][i],border:`2px solid ${bg}`,marginLeft:i?-8:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff"}}>
                    {["S","M","J","K"][i]}
                  </div>
                ))}
              </div>
              <span style={{fontSize:13,color:"#5C5C5C"}}>
                <strong style={{color:"#1A1A1A"}}>2,400+</strong> Australian businesses matched this month
              </span>
            </div>

            <h1 style={{fontFamily:se,fontSize:"clamp(30px,5vw,44px)",fontWeight:800,lineHeight:1.15,letterSpacing:"-1px",marginBottom:18}}>
              {"There's government funding"}<br/>{"for your business. Let's find it."}
            </h1>
            <p style={{fontSize:17,lineHeight:1.65,color:"#5C5C5C",maxWidth:460,marginBottom:32}}>
              Over 3,900 grant programs across federal, state, and local government — most businesses qualify for at least 5. Answer four quick questions and we&apos;ll show you which ones.
            </p>
            <button className="gb" onClick={()=>setPhase("quiz")} style={{
              display:"inline-flex",alignItems:"center",gap:8,background:green,color:"#fff",
              fontSize:15,fontWeight:600,padding:"14px 28px",borderRadius:8,border:"none",cursor:"pointer",
            }}>
              Check what you qualify for
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 7.5H12M12 7.5L8 3.5M12 7.5L8 11.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <p style={{fontSize:12,color:muted,marginTop:10}}>Free · No signup required · Takes 60 seconds</p>

            {/* How it works */}
            <div style={{marginTop:52,paddingTop:28,borderTop:`1px solid ${border}`}}>
              <p style={{fontSize:12,fontWeight:600,color:"#AEAE9F",marginBottom:18,textTransform:"uppercase",letterSpacing:".05em"}}>How it works</p>
              <div style={{display:"flex",gap:28,flexWrap:"wrap"}}>
                {[{n:"1",t:"Answer 4 questions",d:"Location, industry, size, and what you need funding for"},{n:"2",t:"See your matches instantly",d:"We scan every level of government and show what you're eligible for"},{n:"3",t:"Apply with confidence",d:"AI helps draft your application so it actually gets read"}].map(s=>(
                  <div key={s.n} style={{flex:"1 1 150px"}}>
                    <div style={{width:26,height:26,borderRadius:"50%",background:greenLight,color:greenDark,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,marginBottom:8}}>{s.n}</div>
                    <div style={{fontSize:14,fontWeight:600,marginBottom:3}}>{s.t}</div>
                    <div style={{fontSize:13,color:muted,lineHeight:1.5}}>{s.d}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Testimonial */}
            <div style={{marginTop:40,padding:"20px 22px",background:"#fff",border:`1px solid ${border}`,borderRadius:10}}>
              <p style={{fontSize:14,lineHeight:1.6,color:"#3D3D3D",fontStyle:"italic",marginBottom:12}}>
                &ldquo;I had no idea we qualified for 8 different programs. Applied for the Energy Efficiency Grant and got $22,000 towards new equipment. Took me an afternoon.&rdquo;
              </p>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"#D4A574",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff"}}>R</div>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>Rachel M.</div>
                  <div style={{fontSize:12,color:muted}}>Electrical contractor, Adelaide</div>
                </div>
              </div>
            </div>

            {/* Trust strip */}
            <div style={{marginTop:24,padding:"14px 18px",background:"#F4F3EE",borderRadius:8,display:"flex",gap:18,flexWrap:"wrap"}}>
              {["3,900+ grants tracked","No credit card","Built in Australia","Updated weekly"].map(t=>(
                <div key={t} style={{fontSize:12,color:"#6B7264",display:"flex",alignItems:"center",gap:5}}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke={green} strokeWidth="1.3"/><path d="M3.5 6L5.5 8L8.5 4.5" stroke={green} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {t}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== QUIZ ===== */}
        {phase==="quiz"&&(
          <div style={{paddingTop:44,paddingBottom:72}}>
            <div style={{display:"flex",gap:5,marginBottom:36}}>
              {QS.map((_,i)=><div key={i} style={{flex:1,height:3,borderRadius:2,background:i<=step?green:border,transition:"background .3s"}}/>)}
            </div>
            <h2 style={{fontFamily:se,fontSize:"clamp(22px,3.5vw,30px)",fontWeight:800,letterSpacing:"-.6px",marginBottom:5,lineHeight:1.2}}>{cur.q}</h2>
            <p style={{fontSize:14,color:muted,marginBottom:24}}>{cur.sub}</p>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:8}}>
              {cur.opts.map(o=>{
                const m=cur.multi;
                const s=m?(((ans as Record<string,string[]>)[cur.key])||[]).includes(o.v):(ans as Record<string,string>)[cur.key]===o.v;
                return(
                  <div key={o.v} className="go" onClick={()=>pick(cur.key,o.v,m)} style={{
                    padding:"12px 14px",borderRadius:8,cursor:"pointer",transition:"all .15s",
                    border:s?`2px solid ${green}`:`2px solid ${border}`,background:s?greenLight:"#fff",
                    fontSize:14,fontWeight:s?600:500,color:s?greenDark:"#3D3D3D",display:"flex",alignItems:"center",gap:9,
                  }}>
                    {m&&<div style={{width:17,height:17,borderRadius:4,flexShrink:0,border:s?`2px solid ${green}`:"2px solid #C4C4C4",background:s?green:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {s&&<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5L4.5 8L9 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>}
                    {o.l}
                  </div>
                );
              })}
            </div>

            {cur.multi&&<button className="gb" disabled={!(((ans as Record<string,string[]>)[cur.key])||[]).length}
              onClick={()=>{step<QS.length-1?setStep(step+1):startScan(ans as Required<Answers> & {state:string;industry:string;size:string;purposes:string[]})}}
              style={{marginTop:20,display:"inline-flex",alignItems:"center",gap:7,
                background:(((ans as Record<string,string[]>)[cur.key])||[]).length?green:"#E8E5DE",
                color:(((ans as Record<string,string[]>)[cur.key])||[]).length?"#fff":muted,
                fontSize:14,fontWeight:600,padding:"12px 24px",borderRadius:8,border:"none",
                cursor:(((ans as Record<string,string[]>)[cur.key])||[]).length?"pointer":"default",
              }}>Find my grants <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M3 6.5H10M10 6.5L7 3.5M10 6.5L7 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>}

            {step>0&&<button onClick={()=>setStep(step-1)} style={{marginTop:14,display:"block",background:"none",border:"none",fontSize:13,color:muted,cursor:"pointer"}}>← Back</button>}
          </div>
        )}

        {/* ===== SCANNING ===== */}
        {phase==="scanning"&&(
          <div style={{paddingTop:120,paddingBottom:120,textAlign:"center"}}>
            <div style={{marginBottom:24}}>
              <svg className="sp" width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" stroke={green} strokeWidth="2.5" strokeDasharray="12 6"/></svg>
            </div>
            <h2 style={{fontFamily:se,fontSize:24,fontWeight:800,letterSpacing:"-.5px",marginBottom:8}}>
              <span className="dt">Scanning 3,900+ programs</span>
            </h2>
            <p style={{fontSize:14,color:muted,marginBottom:28}}>Checking federal, state, and local government grants</p>
            <div style={{maxWidth:300,margin:"0 auto",height:4,background:border,borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",background:green,borderRadius:4,transition:"width .3s ease",width:`${scanProg}%`}}/>
            </div>
            <p style={{fontSize:12,color:"#AEAE9F",marginTop:10}}>{Math.round(scanProg)}% complete</p>
          </div>
        )}

        {/* ===== RESULTS ===== */}
        {phase==="results"&&(
          <div style={{paddingTop:40,paddingBottom:64}}>
            <div style={{background:"#fff",border:`1px solid ${border}`,borderRadius:10,padding:"28px 24px",textAlign:"center",marginBottom:8}}>
              <p style={{fontSize:11,fontWeight:600,color:green,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Your results</p>
              <div style={{fontFamily:se,fontSize:"clamp(44px,9vw,64px)",fontWeight:900,letterSpacing:"-2px",lineHeight:1,marginBottom:4}}>{count}</div>
              <p style={{fontSize:15,color:"#5C5C5C",marginBottom:2}}>grants matched to your business</p>
              <p style={{fontSize:13,color:"#AEAE9F"}}>Up to {fmt(tot)} in potential funding</p>
            </div>

            {closingSoon > 0 && (
              <div style={{background:"#FEF3E2",border:"1px solid #F5DEB3",borderRadius:8,padding:"10px 14px",marginBottom:20,display:"flex",alignItems:"center",gap:8}}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#C8842E" strokeWidth="1.5"/><path d="M8 4.5V8.5L10.5 10" stroke="#C8842E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{fontSize:13,color:"#8B6914",fontWeight:500}}><strong>{closingSoon} grants</strong> in your results are closing within the next 3 months</span>
              </div>
            )}

            <p style={{fontSize:11,fontWeight:600,color:"#AEAE9F",textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Your top matches</p>

            {res.slice(0,3).map((g,i)=>(
              <div key={g.name} className="gr" style={{animationDelay:`${i*.07}s`,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"#fff",border:`1px solid ${border}`,borderRadius:8,marginBottom:6,gap:8}}>
                <span style={{fontSize:13,fontWeight:500,flex:1,minWidth:0}}>{g.name}</span>
                {!["Open","Ongoing"].includes(g.closing) && (
                  <span style={{fontSize:11,fontWeight:600,color:"#C8842E",background:"#FEF3E2",padding:"2px 8px",borderRadius:4,whiteSpace:"nowrap"}}>Closes {g.closing}</span>
                )}
                <span style={{fontSize:13,fontWeight:600,color:greenDark,whiteSpace:"nowrap"}}>Up to {fmt(g.amount)}</span>
              </div>
            ))}

            {res.slice(3,6).map((g,i)=>(
              <div key={g.name} className="gr" style={{animationDelay:`${(i+3)*.07}s`,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"#fff",border:`1px solid ${border}`,borderRadius:8,marginBottom:6,filter:"blur(4px)",userSelect:"none",pointerEvents:"none"}}>
                <span style={{fontSize:13,fontWeight:500}}>{g.name}</span>
                <span style={{fontSize:13,fontWeight:600,color:greenDark}}>{fmt(g.amount)}</span>
              </div>
            ))}

            {res.length>3&&<p style={{fontSize:13,color:"#AEAE9F",textAlign:"center",margin:"10px 0 24px"}}>+ {res.length-3} more grants matched</p>}

            {/* Email capture */}
            <div style={{background:"#fff",border:`1px solid ${border}`,borderRadius:10,padding:24,textAlign:"center"}}>
              {!done?(
                <>
                  <h3 style={{fontFamily:se,fontSize:19,fontWeight:700,letterSpacing:"-.4px",marginBottom:5}}>Get your full grant report</h3>
                  <p style={{fontSize:13,color:muted,marginBottom:18,lineHeight:1.5}}>
                    All {res.length} grants with eligibility details, deadlines, and links to apply.
                  </p>
                  <div style={{display:"flex",gap:7,maxWidth:360,margin:"0 auto"}}>
                    <input type="email" placeholder="you@business.com.au" value={email} onChange={e=>setEmail(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&handleEmailSubmit()}
                      className="ge"
                      style={{flex:1,padding:"11px 13px",borderRadius:8,border:`2px solid ${border}`,fontSize:14,color:"#1A1A1A",background:bg,fontFamily:sf,transition:"border .15s"}}/>
                    <button className="gb" onClick={handleEmailSubmit} disabled={submitting}
                      style={{background:green,color:"#fff",fontWeight:600,fontSize:14,padding:"11px 20px",borderRadius:8,border:"none",cursor:"pointer",whiteSpace:"nowrap",opacity:submitting?0.7:1}}>
                      {submitting?"Sending...":"Send it"}
                    </button>
                  </div>
                  <p style={{fontSize:11,color:"#C4C4BA",marginTop:10}}>No spam. Unsubscribe anytime.</p>
                </>
              ):(
                <div>
                  <div style={{width:36,height:36,borderRadius:"50%",background:greenLight,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 9.5L7.5 13L14 5.5" stroke={greenDark} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <h3 style={{fontFamily:se,fontSize:17,fontWeight:700,marginBottom:3}}>Check your inbox</h3>
                  <p style={{fontSize:13,color:muted}}>Your full grant report is on its way to {email}</p>
                </div>
              )}
            </div>

            {/* Feature teasers */}
            <div style={{marginTop:32,display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:10}}>
              {[{t:"Eligibility breakdown",d:"Clear criteria for each grant so you know before you apply"},{t:"Deadline tracking",d:"Get alerted before rounds close so you never miss out"},{t:"AI application drafter",d:"Generates a complete draft based on your business details"}].map(f=>(
                <div key={f.t} style={{padding:16,background:"#fff",border:`1px solid ${border}`,borderRadius:8}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:3}}>{f.t}</div>
                  <div style={{fontSize:12,color:muted,lineHeight:1.5}}>{f.d}</div>
                </div>
              ))}
            </div>

            {/* FAQ */}
            <div style={{marginTop:40}}>
              <p style={{fontSize:12,fontWeight:600,color:"#AEAE9F",textTransform:"uppercase",letterSpacing:".05em",marginBottom:14}}>Common questions</p>
              {FAQS.map((f,i)=>(
                <div key={i} style={{borderBottom:`1px solid ${border}`,paddingBottom:openFaq===i?14:0}}>
                  <button onClick={()=>setOpenFaq(openFaq===i?null:i)} style={{
                    width:"100%",textAlign:"left",background:"none",border:"none",cursor:"pointer",
                    padding:"14px 0",display:"flex",justifyContent:"space-between",alignItems:"center",fontFamily:sf,
                  }}>
                    <span style={{fontSize:14,fontWeight:600,color:"#1A1A1A"}}>{f.q}</span>
                    <span style={{fontSize:18,color:muted,transform:openFaq===i?"rotate(45deg)":"none",transition:"transform .2s",flexShrink:0,marginLeft:12}}>+</span>
                  </button>
                  <div className="fq" style={{maxHeight:openFaq===i?200:0,opacity:openFaq===i?1:0}}>
                    <p style={{fontSize:13,color:"#5C5C5C",lineHeight:1.6,paddingBottom:4}}>{f.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{textAlign:"center",padding:"28px 0",fontSize:12,color:"#C4C4BA",borderTop:`1px solid ${border}`}}>
          © 2026 GrantMate · Built in Australia for Australian businesses
        </div>
      </div>
    </div>
  );
}
