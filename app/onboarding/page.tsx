'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import './onboarding.css'

const INDUSTRIES = [
    'Agriculture & Farming', 'Arts & Culture', 'Construction & Trades',
    'Education & Training', 'Finance & Accounting', 'Food & Beverage',
    'Healthcare & Allied Health', 'Hospitality & Tourism', 'IT & Technology',
    'Manufacturing', 'Mining & Resources', 'Professional Services',
    'Property & Real Estate', 'Retail & E-commerce', 'Social Enterprise & Nonprofit',
    'Transport & Logistics', 'Other',
]

const ENTITY_TYPES = [
    'Sole Trader', 'Partnership', 'Pty Ltd (Proprietary Limited)',
    'Company (Ltd)', 'Trust', 'Nonprofit / Charity', 'Cooperative', 'Other',
]

const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']

const EMPLOYEE_RANGES = ['Just me', '2–5', '6–19', '20–49', '50–199', '200+']

const REVENUE_RANGES = [
    'Pre-revenue', 'Under $100K', '$100K – $500K', '$500K – $2M',
    '$2M – $10M', '$10M – $20M', '$20M+',
]

const FUNDING_INTERESTS = [
    'Research & Development', 'Hiring & Training', 'Equipment & Machinery',
    'Export & Trade', 'Sustainability & Environment', 'Digital Transformation',
    'Facilities & Fit–out', 'Marketing & Branding', 'Community Impact',
    'Innovation & Commercialisation',
]

const DEMOGRAPHICS = [
    'Indigenous-owned (Aboriginal or Torres Strait Islander)',
    'Women-owned or led', 'Veteran-owned', 'Disability-owned',
    'Culturally diverse-owned', 'Regional / Rural business',
]

const TOTAL_STEPS = 4

export default function OnboardingPage() {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const router = useRouter()
    const supabase = createClient()

    // Step 1
    const [businessName, setBusinessName] = useState('')
    const [abn, setAbn] = useState('')
    const [industry, setIndustry] = useState('')
    const [entityType, setEntityType] = useState('')

    // Step 2
    const [state, setState] = useState('')
    const [city, setCity] = useState('')
    const [employees, setEmployees] = useState('')
    const [revenue, setRevenue] = useState('')
    const [yearsOperating, setYearsOperating] = useState('')

    // Step 3
    const [fundingInterests, setFundingInterests] = useState<string[]>([])

    // Step 4
    const [demographics, setDemographics] = useState<string[]>([])

    const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
        setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item])
    }

    const handleComplete = async () => {
        setLoading(true)
        setError('')

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setError('Not logged in.'); setLoading(false); return }

        const { error } = await supabase.from('profiles').upsert({
            id: user.id,
            business_name: businessName,
            abn,
            industry,
            entity_type: entityType,
            state,
            city,
            employees_range: employees,
            revenue_range: revenue,
            years_operating: yearsOperating,
            funding_interests: fundingInterests,
            demographics,
            onboarding_complete: true,
            updated_at: new Date().toISOString(),
        })

        if (error) {
            setError('Something went wrong saving your profile. Please try again.')
            setLoading(false)
            return
        }

        router.push('/dashboard')
        router.refresh()
    }

    return (
        <div className="onboarding">
            <Link href="/">
                <Image src="/assets/fundii-logo.png" alt="GrantBase" width={120} height={44} className="onboarding__logo" />
            </Link>

            <div className="onboarding__progress">
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                    <div key={i} className={`onboarding__progress-bar ${i + 1 < step ? 'onboarding__progress-bar--done' :
                        i + 1 === step ? 'onboarding__progress-bar--active' : ''
                        }`} />
                ))}
            </div>

            <div className="onboarding__card">
                {error && <div className="auth-card__error">{error}</div>}

                {/* ─── STEP 1: Business Basics ─── */}
                {step === 1 && (
                    <>
                        <div className="onboarding__step-label">Step 1 of {TOTAL_STEPS}</div>
                        <h2 className="onboarding__title">Tell us about your business</h2>
                        <p className="onboarding__subtitle">This helps us find grants you actually qualify for.</p>

                        <div className="form-group">
                            <label htmlFor="businessName">Business name</label>
                            <input id="businessName" type="text" value={businessName}
                                onChange={e => setBusinessName(e.target.value)} placeholder="Acme Solutions Pty Ltd" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="abn">ABN (optional)</label>
                            <input id="abn" type="text" value={abn}
                                onChange={e => setAbn(e.target.value)} placeholder="12 345 678 901" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="industry">Industry</label>
                            <select id="industry" value={industry} onChange={e => setIndustry(e.target.value)}>
                                <option value="">Select your industry</option>
                                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="entityType">Business type</label>
                            <select id="entityType" value={entityType} onChange={e => setEntityType(e.target.value)}>
                                <option value="">Select entity type</option>
                                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        <div className="onboarding__actions">
                            <div />
                            <button className="btn btn--primary" onClick={() => setStep(2)}
                                disabled={!businessName || !industry}>
                                Next →
                            </button>
                        </div>
                    </>
                )}

                {/* ─── STEP 2: Location & Size ─── */}
                {step === 2 && (
                    <>
                        <div className="onboarding__step-label">Step 2 of {TOTAL_STEPS}</div>
                        <h2 className="onboarding__title">Where and how big?</h2>
                        <p className="onboarding__subtitle">Grants are often location-specific and size-dependent.</p>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="state">State</label>
                                <select id="state" value={state} onChange={e => setState(e.target.value)}>
                                    <option value="">Select state</option>
                                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="city">City / Town</label>
                                <input id="city" type="text" value={city}
                                    onChange={e => setCity(e.target.value)} placeholder="Adelaide" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="employees">Number of employees</label>
                            <select id="employees" value={employees} onChange={e => setEmployees(e.target.value)}>
                                <option value="">Select range</option>
                                {EMPLOYEE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="revenue">Annual revenue</label>
                            <select id="revenue" value={revenue} onChange={e => setRevenue(e.target.value)}>
                                <option value="">Select range</option>
                                {REVENUE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="yearsOperating">Years in operation</label>
                            <input id="yearsOperating" type="text" value={yearsOperating}
                                onChange={e => setYearsOperating(e.target.value)} placeholder="e.g. 3" />
                        </div>

                        <div className="onboarding__actions">
                            <button className="btn btn--outline" onClick={() => setStep(1)}>← Back</button>
                            <button className="btn btn--primary" onClick={() => setStep(3)}
                                disabled={!state}>
                                Next →
                            </button>
                        </div>
                    </>
                )}

                {/* ─── STEP 3: Funding Interests ─── */}
                {step === 3 && (
                    <>
                        <div className="onboarding__step-label">Step 3 of {TOTAL_STEPS}</div>
                        <h2 className="onboarding__title">What do you need funding for?</h2>
                        <p className="onboarding__subtitle">Select all that apply — the more you pick, the better your matches.</p>

                        <div className="checkbox-group">
                            {FUNDING_INTERESTS.map(interest => (
                                <div key={interest}
                                    className={`checkbox-item ${fundingInterests.includes(interest) ? 'checked' : ''}`}
                                    onClick={() => toggleItem(fundingInterests, setFundingInterests, interest)}>
                                    <input type="checkbox" checked={fundingInterests.includes(interest)} readOnly />
                                    {interest}
                                </div>
                            ))}
                        </div>

                        <div className="onboarding__actions">
                            <button className="btn btn--outline" onClick={() => setStep(2)}>← Back</button>
                            <button className="btn btn--primary" onClick={() => setStep(4)}
                                disabled={fundingInterests.length === 0}>
                                Next →
                            </button>
                        </div>
                    </>
                )}

                {/* ─── STEP 4: Demographics (optional) ─── */}
                {step === 4 && (
                    <>
                        <div className="onboarding__step-label">Step 4 of {TOTAL_STEPS}</div>
                        <h2 className="onboarding__title">Anything else? (Optional)</h2>
                        <p className="onboarding__subtitle">Some grants target specific groups. This is completely optional but helps us find more matches.</p>

                        <div className="checkbox-group">
                            {DEMOGRAPHICS.map(demo => (
                                <div key={demo}
                                    className={`checkbox-item ${demographics.includes(demo) ? 'checked' : ''}`}
                                    onClick={() => toggleItem(demographics, setDemographics, demo)}>
                                    <input type="checkbox" checked={demographics.includes(demo)} readOnly />
                                    {demo}
                                </div>
                            ))}
                        </div>

                        <div className="onboarding__actions">
                            <button className="btn btn--outline" onClick={() => setStep(3)}>← Back</button>
                            <button className="btn btn--primary" onClick={handleComplete} disabled={loading}>
                                {loading ? 'Saving...' : 'Finish & See My Grants →'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
