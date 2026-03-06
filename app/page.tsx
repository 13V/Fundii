import Link from "next/link";
import Nav from "@/components/Nav";

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="9" stroke="#00897B" strokeWidth="1.8"/>
        <path d="M7 11L9.5 13.5L15 8" stroke="#00897B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Smart Grant Matching",
    desc: "Answer 4 questions and we scan 3,900+ federal, state, and local grant programs to find what you actually qualify for.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="3" width="16" height="16" rx="4" stroke="#00897B" strokeWidth="1.8"/>
        <path d="M7 8h8M7 11h5M7 14h6" stroke="#00897B" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    title: "AI Application Drafter",
    desc: "Claude AI generates a tailored first draft for any grant using your business profile — ready to personalise and submit.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 3v2M11 17v2M3 11h2M17 11h2" stroke="#00897B" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="11" cy="11" r="5" stroke="#00897B" strokeWidth="1.8"/>
      </svg>
    ),
    title: "Weekly Grant Alerts",
    desc: "New matching grants delivered to your inbox every Monday. Never miss a round again.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M4 16l4-4 3 3 4-5 3 2" stroke="#00897B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Track Applications",
    desc: "Save grants, track your application status, and keep notes — all in one dashboard.",
  },
];

const PRICING = [
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    desc: "Perfect for businesses exploring what's available.",
    features: ["Full grant matches", "Weekly email alerts", "Save & track grants", "Up to 3 states"],
    cta: "Get started",
    href: "/login",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$79",
    period: "/mo",
    desc: "Everything you need to actually apply and win.",
    features: ["Everything in Starter", "AI application drafter (5/mo)", "Eligibility deep-dives", "Priority support"],
    cta: "Start free trial",
    href: "/login",
    highlight: true,
  },
  {
    name: "Business",
    price: "$199",
    period: "/mo",
    desc: "For accountants and advisors managing multiple clients.",
    features: ["Unlimited AI drafts", "Multi-client dashboard", "White-label reports", "Dedicated support"],
    cta: "Contact us",
    href: "mailto:hello@grantmate.com.au",
    highlight: false,
  },
];

const STATS = [
  { value: "3,900+", label: "Grant programs tracked" },
  { value: "$90B+", label: "Available annually in Australia" },
  { value: "7,000+", label: "Programs across 40+ gov sites" },
  { value: "2,400+", label: "Businesses matched this month" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <Nav />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-100 rounded-full px-4 py-1.5 mb-6">
          <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
          <span className="text-sm font-semibold text-teal-700">3,900+ Australian grant programs tracked</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#1B2A4A] leading-tight tracking-tight mb-6">
          Free money for your business.
          <br />
          <span className="text-teal-500">Let&apos;s find it fast.</span>
        </h1>

        <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Most Australian small businesses miss out on grants they qualify for — because finding them is a full-time job.
          GrantMate does it in 60 seconds.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/find"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold text-base transition-colors no-underline"
          >
            Check what you qualify for
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M10 5l3 3-3 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
          <Link
            href="/quiz"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[#1B2A4A] font-semibold text-base transition-colors no-underline"
          >
            Full grant search
          </Link>
        </div>

        <p className="text-sm text-gray-400 mt-4">Free · No signup required · Takes 60 seconds</p>
      </section>

      {/* Stats bar */}
      <section className="border-y border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-extrabold text-[#1B2A4A] mb-1">{s.value}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1B2A4A] mb-3 tracking-tight">
            Everything you need to win grants
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            From finding them to applying — GrantMate handles the hard parts.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white border border-gray-100 rounded-2xl p-6 flex gap-4"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                {f.icon}
              </div>
              <div>
                <h3 className="font-bold text-[#1B2A4A] mb-1">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonial */}
      <section className="bg-white border-y border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <p className="text-xl sm:text-2xl font-medium text-[#1B2A4A] leading-relaxed mb-8 italic">
            &ldquo;I had no idea we qualified for 8 different programs. Applied for the Energy Efficiency Grant and got{" "}
            <span className="text-teal-500 font-bold not-italic">$22,000</span> towards new equipment. Took me an afternoon.&rdquo;
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#D4A574] flex items-center justify-center text-white font-bold">
              R
            </div>
            <div className="text-left">
              <div className="font-semibold text-[#1B2A4A] text-sm">Rachel M.</div>
              <div className="text-gray-400 text-sm">Electrical contractor, Adelaide</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1B2A4A] mb-3 tracking-tight">
            Simple, honest pricing
          </h2>
          <p className="text-gray-500 text-lg">
            Cancel anytime. No lock-in contracts.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {PRICING.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl p-6 flex flex-col ${
                p.highlight
                  ? "bg-[#1B2A4A] text-white"
                  : "bg-white border border-gray-100"
              }`}
            >
              {p.highlight && (
                <div className="text-xs font-bold tracking-widest text-[#F5A623] uppercase mb-3">
                  Most popular
                </div>
              )}
              <div className={`text-sm font-semibold mb-1 ${p.highlight ? "text-teal-300" : "text-teal-600"}`}>
                {p.name}
              </div>
              <div className="flex items-end gap-1 mb-2">
                <span className={`text-4xl font-extrabold ${p.highlight ? "text-white" : "text-[#1B2A4A]"}`}>
                  {p.price}
                </span>
                <span className={`text-sm mb-1 ${p.highlight ? "text-white/60" : "text-gray-400"}`}>
                  {p.period}
                </span>
              </div>
              <p className={`text-sm mb-6 ${p.highlight ? "text-white/70" : "text-gray-500"}`}>{p.desc}</p>
              <ul className="flex flex-col gap-2 mb-8 flex-1">
                {p.features.map((f) => (
                  <li key={f} className={`flex items-start gap-2 text-sm ${p.highlight ? "text-white/90" : "text-gray-600"}`}>
                    <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="6" fill={p.highlight ? "#00897B" : "#E6F4F2"}/>
                      <path d="M4.5 7L6.5 9L9.5 5" stroke={p.highlight ? "#fff" : "#00897B"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={p.href}
                className={`text-center py-3 rounded-xl font-bold text-sm no-underline transition-colors ${
                  p.highlight
                    ? "bg-teal-500 hover:bg-teal-400 text-white"
                    : "bg-[#1B2A4A] hover:bg-[#243555] text-white"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div
          className="rounded-2xl p-10 sm:p-14 text-center"
          style={{ background: "linear-gradient(135deg, #1B2A4A, #00897B)" }}
        >
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
            Ready to find your grants?
          </h2>
          <p className="text-white/70 mb-8 text-base">
            Free check. No signup. Results in 60 seconds.
          </p>
          <Link
            href="/find"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-[#1B2A4A] no-underline transition-colors"
            style={{ background: "#F5A623" }}
          >
            Check what you qualify for
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M10 5l3 3-3 3" stroke="#1B2A4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-400">
          <span>© 2026 GrantMate · Built in Australia for Australian businesses</span>
          <div className="flex gap-6">
            <Link href="/find" className="hover:text-gray-600 no-underline">Find Grants</Link>
            <Link href="/quiz" className="hover:text-gray-600 no-underline">Full Search</Link>
            <Link href="/login" className="hover:text-gray-600 no-underline">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
