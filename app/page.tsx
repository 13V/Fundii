'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import './landing.css'

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="8" stroke="#0F7B6C" strokeWidth="1.5" />
    <path d="M5.5 9L8 11.5L12.5 6.5" stroke="#0F7B6C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function LandingPage() {
  useEffect(() => {
    // Scroll reveal
    const els = document.querySelectorAll('.reveal')
    const obs = new IntersectionObserver(
      (entries) => { entries.forEach((e, i) => { if (e.isIntersecting) { setTimeout(() => e.target.classList.add('visible'), i * 80); obs.unobserve(e.target) } }) },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    )
    els.forEach(el => obs.observe(el))

    // Nav scroll shadow
    const nav = document.getElementById('nav')
    const onScroll = () => { nav?.classList.toggle('nav--scrolled', window.scrollY > 40) }
    window.addEventListener('scroll', onScroll)

    // Hamburger
    const hamburger = document.getElementById('hamburger')
    const navLinks = document.getElementById('navLinks')
    hamburger?.addEventListener('click', () => navLinks?.classList.toggle('open'))
    navLinks?.querySelectorAll('.nav__link').forEach(l => l.addEventListener('click', () => navLinks?.classList.remove('open')))

    // Contact form
    const form = document.getElementById('contactForm') as HTMLFormElement
    form?.addEventListener('submit', (e) => {
      e.preventDefault()
      const btn = form.querySelector('.btn') as HTMLButtonElement
      const orig = btn.textContent
      btn.textContent = 'Message Sent! ✓'
      btn.style.background = '#0F7B6C'
      btn.style.color = '#fff'
      setTimeout(() => { btn.textContent = orig; btn.style.background = ''; btn.style.color = ''; form.reset() }, 3000)
    })

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      {/* NAV */}
      <nav className="nav" id="nav">
        <div className="nav__inner container">
          <a href="#" className="nav__logo"><img src="/assets/fundii-logo.png" alt="GrantBase" className="nav__logo-img" /></a>
          <ul className="nav__links" id="navLinks">
            <li><a href="#how-it-works" className="nav__link">How It Works</a></li>
            <li><a href="#features" className="nav__link">Features</a></li>
            <li><a href="#pricing" className="nav__link">Pricing</a></li>
            <li><a href="#about" className="nav__link">About</a></li>
            <li><a href="#contact" className="nav__link">Contact</a></li>
          </ul>
          <Link href="/signup" className="nav__cta btn btn--primary">Get Started</Link>
          <button className="nav__hamburger" id="hamburger" aria-label="Toggle menu"><span></span><span></span><span></span></button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero" id="hero">
        <div className="container hero__inner">
          <div className="hero__content">
            <h1 className="hero__title">Your business qualifies for grants<br /><span className="hero__title--accent">you&apos;ve never heard of.</span></h1>
            <p className="hero__subtitle">Right now, there are government and private grants with your company&apos;s name on them. The only problem? You don&apos;t know they exist. GrantBase fixes that.</p>
            <div className="hero__actions">
              <a href="#pricing" className="btn btn--primary btn--lg">See Plans &amp; Pricing</a>
              <a href="#how-it-works" className="btn btn--outline btn--lg">Learn More ↓</a>
            </div>
          </div>
          <div className="hero__preview">
            <div className="hero__alert-card">
              <div className="hero__alert-header"><span className="hero__alert-badge">New Match</span><span className="hero__alert-time">2 hours ago</span></div>
              <h4 className="hero__alert-title">R&amp;D Tax Incentive — AusIndustry</h4>
              <p className="hero__alert-meta">Up to 43.5% tax offset · Ongoing program</p>
              <div className="hero__alert-tags"><span className="hero__alert-tag">Technology</span><span className="hero__alert-tag">R&amp;D</span><span className="hero__alert-tag">&lt; $20M turnover</span></div>
            </div>
            <div className="hero__alert-card hero__alert-card--faded">
              <div className="hero__alert-header"><span className="hero__alert-badge">New Match</span><span className="hero__alert-time">Yesterday</span></div>
              <h4 className="hero__alert-title">Export Market Development Grant (EMDG)</h4>
              <p className="hero__alert-meta">Up to $770,000 · Opens annually</p>
            </div>
            <div className="hero__alert-card hero__alert-card--faded2">
              <div className="hero__alert-header"><span className="hero__alert-badge">New Match</span></div>
              <h4 className="hero__alert-title">Boosting Female Founders Initiative</h4>
            </div>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <section className="ticker">
        <div className="ticker__track">
          <div className="ticker__content">
            {[1, 2].map(loop => (
              <span key={loop} style={{ display: 'contents' }}>
                <span className="ticker__item"><strong>🏥 Healthcare:</strong> 342 grants available</span><span className="ticker__divider">·</span>
                <span className="ticker__item"><strong>💻 Technology:</strong> 518 grants available</span><span className="ticker__divider">·</span>
                <span className="ticker__item"><strong>🌾 Agriculture:</strong> 189 grants available</span><span className="ticker__divider">·</span>
                <span className="ticker__item"><strong>🎓 Education:</strong> 274 grants available</span><span className="ticker__divider">·</span>
                <span className="ticker__item"><strong>🎨 Creative Arts:</strong> 156 grants available</span><span className="ticker__divider">·</span>
                <span className="ticker__item"><strong>🔧 Trades:</strong> 203 grants available</span><span className="ticker__divider">·</span>
                <span className="ticker__item"><strong>🏠 Nonprofits:</strong> 431 grants available</span><span className="ticker__divider">·</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="problem" id="how-it-works">
        <div className="container">
          <div className="problem__inner">
            <div className="problem__text reveal">
              <h2 className="problem__title">You&apos;re losing money<br />every month.</h2>
              <p className="problem__lead">Not because your business isn&apos;t profitable. Because there are grants sitting in government databases right now — with your eligibility criteria — and nobody told you about them.</p>
              <div className="problem__stats">
                <div className="problem__stat"><div className="problem__stat-number">$5B+</div><div className="problem__stat-label">in government grants and incentives available to Australian small businesses annually</div></div>
                <div className="problem__stat"><div className="problem__stat-number">87%</div><div className="problem__stat-label">of eligible businesses never apply — they didn&apos;t know the grants existed</div></div>
              </div>
            </div>
            <div className="problem__solution reveal">
              <h3 className="problem__solution-heading">GrantBase is your fix.</h3>
              <div className="problem__steps">
                <div className="problem__step-item"><div className="problem__step-num">1</div><div><strong>You fill in a 5-minute profile.</strong><span>Industry, location, size, what you need funding for.</span></div></div>
                <div className="problem__step-item"><div className="problem__step-num">2</div><div><strong>We scan thousands of grants daily.</strong><span>Government programs, private foundations, industry bodies — all of them.</span></div></div>
                <div className="problem__step-item"><div className="problem__step-num">3</div><div><strong>You get an email when something matches.</strong><span>Grant name, amount, deadline, eligibility — everything you need to apply.</span></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* GRANT EXAMPLES */}
      <section className="examples" id="features">
        <div className="container">
          <h2 className="section-title section-title--left">Here&apos;s what a typical week<br />looks like for GrantBase users.</h2>
          <p className="examples__subtitle">These are the kinds of grants our users get matched with. Real programs. Real money. Delivered to your inbox.</p>
          <div className="examples__grid">
            {[
              { cat: '💻 Technology & Innovation', amt: 'Up to 43.5% offset', title: 'R&D Tax Incentive', desc: "AusIndustry's flagship program offering a tax offset for businesses conducting eligible R&D activities.", deadline: '🔄 Ongoing — register annually', elig: 'Australian companies · < $20M turnover · Conducting R&D', featured: false },
              { cat: '🌏 Export & Trade', amt: 'Up to $770,000', title: 'Export Market Development Grant (EMDG)', desc: "Austrade's grant for small businesses looking to grow their exports. Reimburses up to 50% of eligible export promotion expenses.", deadline: '📅 Opens annually — Nov–Jan', elig: 'Australian business · < $20M turnover · Exporting', featured: true },
              { cat: '🎨 Arts & Culture', amt: '$10,000 – $100,000+', title: 'Creative Australia — Arts Projects', desc: 'Funding for Australian arts organisations to deliver creative projects in visual arts, music, theatre, and dance.', deadline: '📅 Opens annually — multiple rounds', elig: 'Incorporated orgs · Arts focus · ABN required', featured: false },
              { cat: '🚀 Women in Business', amt: 'Up to $480,000', title: 'Boosting Female Founders Initiative', desc: 'Federal grants for women-founded startups and small businesses to scale.', deadline: '🔄 Recurring — rounds announced periodically', elig: 'Female-founded · Australian business · Scaling stage', featured: false },
            ].map(g => (
              <div key={g.title} className={`examples__card ${g.featured ? 'examples__card--featured' : ''} reveal`}>
                <div className="examples__card-top"><span className="examples__card-category">{g.cat}</span><span className="examples__card-amount">{g.amt}</span></div>
                <h3 className="examples__card-title">{g.title}</h3>
                <p className="examples__card-desc">{g.desc}</p>
                <div className="examples__card-footer"><span className="examples__card-deadline">{g.deadline}</span><span className="examples__card-eligibility">{g.elig}</span></div>
              </div>
            ))}
          </div>
          <div className="mid-cta">
            <p className="mid-cta__text"><strong>Grants like these</strong> get matched to your business. Every week.</p>
            <a href="#pricing" className="btn btn--primary">See Plans &amp; Pricing</a>
          </div>
        </div>
      </section>

      {/* PROFILE INFO */}
      <section className="profile-info">
        <div className="container">
          <div className="profile-info__inner">
            <div className="profile-info__text">
              <h2 className="section-title section-title--left">We need about 5 minutes<br />of your time. That&apos;s it.</h2>
              <p className="profile-info__desc">When you sign up, we ask a few questions so we can filter thousands of opportunities down to the ones you actually qualify for.</p>
            </div>
            <div className="profile-info__list reveal">
              {[
                { icon: '📋', title: 'Business basics', desc: 'Name, industry, entity type (Pty Ltd, nonprofit, etc.)' },
                { icon: '📍', title: 'Location', desc: 'State, city — many grants are location-specific' },
                { icon: '📊', title: 'Size & stage', desc: 'Employees, revenue range, years in operation' },
                { icon: '🎯', title: 'Funding interests', desc: 'R&D, hiring, equipment, training, export, etc.' },
                { icon: '🏷️', title: 'Optional demographics', desc: 'Indigenous-owned, women-owned, veteran-owned (unlocks diversity grants)' },
              ].map(item => (
                <div key={item.title} className="profile-info__item"><div className="profile-info__item-icon">{item.icon}</div><div><strong>{item.title}</strong><span>{item.desc}</span></div></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ENTERPRISE */}
      <section className="enterprise-highlight">
        <div className="container">
          <div className="enterprise-highlight__inner reveal">
            <div className="enterprise-highlight__text">
              <span className="enterprise-highlight__label">ENTERPRISE PLAN</span>
              <h2 className="enterprise-highlight__title">We don&apos;t just find the grants.<br />We write the applications for you.</h2>
              <p>Enterprise users get AI-generated draft applications tailored to each grant — pre-filled with your business details, formatted to the grant&apos;s requirements, and ready for you to review and submit.</p>
              <p>Most grant applications take 8–12 hours. Ours take about 20 minutes of your time.</p>
              <a href="#pricing" className="btn btn--primary">See Enterprise Pricing →</a>
            </div>
            <div className="enterprise-highlight__visual">
              <div className="enterprise-highlight__doc">
                <div className="enterprise-highlight__doc-bar"><span></span><span></span><span></span></div>
                <div className="enterprise-highlight__doc-content">
                  <div className="enterprise-highlight__doc-line enterprise-highlight__doc-line--title"></div>
                  <div className="enterprise-highlight__doc-line enterprise-highlight__doc-line--subtitle"></div>
                  <div className="enterprise-highlight__doc-spacer"></div>
                  <div className="enterprise-highlight__doc-line"></div>
                  <div className="enterprise-highlight__doc-line"></div>
                  <div className="enterprise-highlight__doc-line enterprise-highlight__doc-line--short"></div>
                  <div className="enterprise-highlight__doc-spacer"></div>
                  <div className="enterprise-highlight__doc-line"></div>
                  <div className="enterprise-highlight__doc-line enterprise-highlight__doc-line--medium"></div>
                  <div className="enterprise-highlight__doc-badge">✓ Auto-filled from your profile</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing" id="pricing">
        <div className="container">
          <h2 className="section-title">Two plans. One goal:<br />get you funded.</h2>
          <div className="pricing__grid">
            <div className="pricing__card reveal">
              <div className="pricing__card-header"><h3 className="pricing__card-name">Pro</h3><p className="pricing__card-desc">Grant alerts, delivered. You find the grants, you write the applications.</p></div>
              <div className="pricing__card-price"><span className="pricing__card-currency">$</span><span className="pricing__card-amount">49</span><span className="pricing__card-period">/month</span></div>
              <ul className="pricing__card-features">
                {['Smart grant matching', 'Instant email alerts', 'Unlimited grant matches', 'Email support'].map(f => (
                  <li key={f} className="pricing__card-feature pricing__card-feature--included"><CheckIcon />{f}</li>
                ))}
              </ul>
              <Link href="/signup" className="btn btn--outline btn--full">Start with Pro</Link>
            </div>
            <div className="pricing__card pricing__card--featured reveal">
              <div className="pricing__card-popular">RECOMMENDED</div>
              <div className="pricing__card-header"><h3 className="pricing__card-name">Enterprise</h3><p className="pricing__card-desc">Everything in Pro, plus AI writes your grant applications for you.</p></div>
              <div className="pricing__card-price"><span className="pricing__card-currency">$</span><span className="pricing__card-amount">149</span><span className="pricing__card-period">/month</span></div>
              <ul className="pricing__card-features">
                {['Everything in Pro', 'AI-drafted grant applications', 'Priority support', 'Dedicated account manager'].map(f => (
                  <li key={f} className="pricing__card-feature pricing__card-feature--included"><CheckIcon />{f}</li>
                ))}
              </ul>
              <Link href="/signup" className="btn btn--primary btn--full">Start with Enterprise</Link>
            </div>
          </div>
          <p className="pricing__note">No lock-in contracts. No success fees. No commission on grants won. Cancel anytime.</p>
        </div>
      </section>

      {/* ABOUT */}
      <section className="about" id="about">
        <div className="container"><div className="about__inner"><div className="about__text reveal">
          <span className="section-label">WHY WE BUILT THIS</span>
          <h2 className="section-title section-title--left">We watched good businesses miss out on free money. So we did something about it.</h2>
          <p>Australian federal and state governments offer billions in grants every year. The problem? They&apos;re scattered across business.gov.au, state portals, and industry bodies. Most business owners never see them.</p>
          <p>It&apos;s a system built for grant writers and consultants who charge $5,000+ to navigate it. Small businesses — the ones who need funding the most — get left behind.</p>
          <p><strong>GrantBase exists because that&apos;s not okay.</strong> We built a system that does the searching for you. It monitors every major grant program, cross-references your business profile, and sends you an email when something matches. That&apos;s it. No complexity. No consultants. Just grants, matched and delivered.</p>
        </div></div></div>
      </section>

      {/* FAQ */}
      <section className="faq" id="faq">
        <div className="container">
          <h2 className="section-title">Questions we get asked a lot</h2>
          <div className="faq__list">
            {[
              { q: 'Do I have to pay the grant money back?', a: "No. Grants are free money — they're not loans. You never repay them." },
              { q: 'How is this different from Googling "business grants"?', a: 'GrantBase matches grants to your specific business — your industry, location, size, and goals. We check daily and email you the moment something relevant appears.' },
              { q: "I'm not a tech person. Is this complicated?", a: "Not at all. You fill out a short profile (about 5 minutes), then check your email. When a grant matches, we send you the name, amount, deadline, and how to apply. That's it." },
              { q: 'What does "AI draft applications" mean on Enterprise?', a: 'For each grant match, we generate a pre-written application using your profile details. Most Enterprise users spend 20 minutes instead of 8+ hours.' },
              { q: 'Can I cancel anytime?', a: "Yes. No lock-in contracts, no cancellation fees. Cancel from your account at any time." },
              { q: 'What if no grants match my business?', a: "If after 30 days we haven't found a single match, we'll give you a full refund — no questions asked." },
            ].map(item => (
              <details key={item.q} className="faq__item reveal">
                <summary className="faq__question">{item.q}</summary>
                <p className="faq__answer">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section className="contact" id="contact">
        <div className="container"><div className="contact__inner">
          <div className="contact__text">
            <h2 className="section-title section-title--left">Let&apos;s get you started.</h2>
            <p className="contact__desc">Questions? Just want to chat before committing? Drop us a line. We reply to every message within a business day.</p>
            <div className="contact__info"><div className="contact__info-item">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M2 6L10 11L18 6" stroke="currentColor" strokeWidth="1.5" /></svg>
              hello@grantbase.com.au
            </div></div>
          </div>
          <form className="contact__form" id="contactForm">
            <div className="contact__form-row">
              <div className="contact__form-group"><label htmlFor="cname">Your name</label><input type="text" id="cname" placeholder="Jane Smith" required /></div>
              <div className="contact__form-group"><label htmlFor="cemail">Email</label><input type="email" id="cemail" placeholder="jane@mybusiness.com.au" required /></div>
            </div>
            <div className="contact__form-group"><label htmlFor="cbusiness">Business name</label><input type="text" id="cbusiness" placeholder="Acme Pty Ltd" /></div>
            <div className="contact__form-group"><label htmlFor="cmessage">Tell us about your business</label><textarea id="cmessage" rows={4} placeholder="What does your business do? What kind of funding are you looking for?"></textarea></div>
            <button type="submit" className="btn btn--primary btn--full">Send Message</button>
          </form>
        </div></div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container">
          <div className="footer__inner">
            <div className="footer__brand"><img src="/assets/fundii-logo.png" alt="GrantBase" className="footer__logo" /><p className="footer__tagline">Grant alerts for small businesses, startups, and nonprofits.</p></div>
            <div className="footer__nav"><h4>Navigate</h4><ul><li><a href="#how-it-works">How It Works</a></li><li><a href="#features">Features</a></li><li><a href="#pricing">Pricing</a></li><li><a href="#about">About</a></li><li><a href="#contact">Contact</a></li></ul></div>
            <div className="footer__nav"><h4>Account</h4><ul><li><Link href="/login">Log In</Link></li><li><Link href="/signup">Sign Up</Link></li></ul></div>
            <div className="footer__nav"><h4>Legal</h4><ul><li><a href="#">Privacy Policy</a></li><li><a href="#">Terms of Service</a></li></ul></div>
          </div>
          <div className="footer__bottom"><p>© 2025 GrantBase. All rights reserved.</p></div>
        </div>
      </footer>
    </>
  )
}
