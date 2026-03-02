import Link from "next/link";
import Nav from "@/components/Nav";

const STATS = [
  { num: "$90B+", label: "Available in AU grants annually" },
  { num: "7,000+", label: "Active grant programs" },
  { num: "40+", label: "Government sources scraped" },
  { num: "60 sec", label: "To find your matches" },
];

const HOW_IT_WORKS = [
  {
    icon: "📋",
    title: "Answer 5 quick questions",
    desc: "Tell us your state, industry, size, and what you need funding for.",
  },
  {
    icon: "🎯",
    title: "Get matched instantly",
    desc: "Our AI scans 40+ government databases and scores each grant by eligibility.",
  },
  {
    icon: "✨",
    title: "Draft your application",
    desc: "AI generates a first draft tailored to each grant's specific criteria.",
  },
  {
    icon: "🔔",
    title: "Never miss a grant",
    desc: "Weekly alerts when new grants match your profile. Set and forget.",
  },
];

const SOCIAL_PROOF = [
  {
    quote: "Found $25K in grants I had no idea existed. The AI draft saved me 3 days of writing.",
    author: "Sarah K.",
    role: "SA Manufacturing, 12 staff",
  },
  {
    quote: "Applied for 4 grants in a week. Old way would've taken me a month with a consultant.",
    author: "Mike T.",
    role: "QLD Construction, Sole trader",
  },
  {
    quote: "Our accountant uses it for all our clients now. It's become part of our workflow.",
    author: "Priya M.",
    role: "Brisbane Accounting Firm",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Nav />

      {/* Hero */}
      <section
        className="py-20 px-6 text-center"
        style={{
          background: "linear-gradient(160deg, #1B2A4A 0%, #2D4A7A 50%, #00897B 100%)",
        }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-8">
            <span className="text-sm font-semibold" style={{ color: "#F5A623" }}>
              🇦🇺 Built for Australian businesses
            </span>
          </div>

          <h1
            className="text-5xl md:text-6xl font-extrabold text-white mb-6 leading-tight tracking-tight"
          >
            Stop missing out on{" "}
            <span style={{ color: "#F5A623" }}>free money</span>{" "}
            for your business
          </h1>

          <p className="text-xl text-white/80 max-w-xl mx-auto mb-10 leading-relaxed">
            Fundii finds grants you&apos;re eligible for, tells you how much you could get, and
            helps you apply — in minutes, not months.
          </p>

          <Link
            href="/quiz"
            className="inline-block px-10 py-5 rounded-2xl text-lg font-extrabold no-underline transition-transform hover:scale-105"
            style={{
              background: "#F5A623",
              color: "#1B2A4A",
              boxShadow: "0 4px 20px rgba(245,166,35,0.45)",
            }}
          >
            Find My Grants →
          </Link>

          <p className="text-white/50 text-sm mt-4">Takes 60 seconds. No signup required.</p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-14" style={{ color: "#1B2A4A" }}>
            How Fundii Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {HOW_IT_WORKS.map((item, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-7 text-center border border-gray-100 shadow-sm"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="font-bold text-lg mb-2" style={{ color: "#1B2A4A" }}>
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-14 px-6" style={{ background: "#1B2A4A" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {STATS.map((s, i) => (
            <div key={i}>
              <div className="text-3xl font-extrabold" style={{ color: "#F5A623" }}>
                {s.num}
              </div>
              <div className="text-sm text-white/65 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-14" style={{ color: "#1B2A4A" }}>
            Businesses love Fundii
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SOCIAL_PROOF.map((t, i) => (
              <div key={i} className="bg-[#F8FAFB] rounded-2xl p-6 border border-gray-100">
                <p className="text-gray-700 leading-relaxed mb-4 italic">&ldquo;{t.quote}&rdquo;</p>
                <div>
                  <p className="font-bold text-sm" style={{ color: "#1B2A4A" }}>
                    {t.author}
                  </p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold mb-4" style={{ color: "#1B2A4A" }}>
            Simple, honest pricing
          </h2>
          <p className="text-gray-500 mb-14">
            Find one grant and you&apos;ve paid for a year. No hidden fees.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "Starter",
                price: "$49",
                desc: "Full grant matches + weekly alerts",
                features: ["All grant matches", "Weekly email alerts", "Save & track grants"],
                cta: "Start free trial",
                highlighted: false,
              },
              {
                name: "Pro",
                price: "$79",
                desc: "Everything + AI application drafter",
                features: [
                  "Everything in Starter",
                  "AI application drafts (5/mo)",
                  "Priority grant alerts",
                ],
                cta: "Start free trial",
                highlighted: true,
              },
              {
                name: "Business",
                price: "$199",
                desc: "Unlimited + accountant dashboard",
                features: [
                  "Everything in Pro",
                  "Unlimited AI drafts",
                  "Accountant multi-client dashboard",
                ],
                cta: "Contact us",
                highlighted: false,
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`rounded-2xl p-7 border text-left ${
                  plan.highlighted
                    ? "border-teal-500 shadow-lg ring-2 ring-teal-500/20"
                    : "border-gray-200 bg-white"
                }`}
                style={plan.highlighted ? { background: "#E0F2F1" } : {}}
              >
                {plan.highlighted && (
                  <div className="text-xs font-bold text-teal-600 uppercase tracking-wide mb-3">
                    Most popular
                  </div>
                )}
                <h3 className="text-xl font-extrabold mb-1" style={{ color: "#1B2A4A" }}>
                  {plan.name}
                </h3>
                <div className="text-3xl font-extrabold mb-1" style={{ color: "#1B2A4A" }}>
                  {plan.price}
                  <span className="text-base font-semibold text-gray-500">/mo</span>
                </div>
                <p className="text-sm text-gray-500 mb-5">{plan.desc}</p>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-green-500 font-bold mt-0.5">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/quiz"
                  className={`block text-center py-3 rounded-xl font-bold text-sm no-underline transition-colors ${
                    plan.highlighted
                      ? "bg-teal-500 text-white hover:bg-teal-600"
                      : "border border-teal-500 text-teal-600 hover:bg-teal-50"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-gray-400 text-sm mt-8">
            Free tier: Quiz + top 3 matches. No credit card needed.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-extrabold mb-4" style={{ color: "#1B2A4A" }}>
            Ready to find your grants?
          </h2>
          <p className="text-gray-500 mb-8 text-lg">
            Most Australian businesses are eligible for at least 3–5 grants. Find yours now.
          </p>
          <Link
            href="/quiz"
            className="inline-block px-10 py-5 rounded-2xl text-lg font-extrabold no-underline transition-transform hover:scale-105"
            style={{ background: "#00897B", color: "#fff" }}
          >
            Start Free Match →
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-200 py-8 px-6 text-center text-sm text-gray-400">
        © 2026 Fundii · Made in Australia 🇦🇺 ·{" "}
        <a href="mailto:hello@fundii.com.au" className="hover:text-gray-600">
          hello@fundii.com.au
        </a>
      </footer>
    </div>
  );
}
