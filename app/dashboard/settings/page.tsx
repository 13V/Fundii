'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

const INDUSTRIES = [
    'Agriculture & Farming', 'Arts & Culture', 'Construction & Trades',
    'Education & Training', 'Finance & Accounting', 'Food & Beverage',
    'Healthcare & Allied Health', 'Hospitality & Tourism', 'IT & Technology',
    'Manufacturing', 'Mining & Resources', 'Professional Services',
    'Property & Real Estate', 'Retail & E-commerce', 'Social Enterprise & Nonprofit',
    'Transport & Logistics', 'Other',
]

const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']
const EMPLOYEE_RANGES = ['Just me', '2–5', '6–19', '20–49', '50–199', '200+']
const REVENUE_RANGES = ['Pre-revenue', 'Under $100K', '$100K – $500K', '$500K – $2M', '$2M – $10M', '$10M – $20M', '$20M+']

export default function SettingsPage() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [plan, setPlan] = useState('free')

    const [businessName, setBusinessName] = useState('')
    const [abn, setAbn] = useState('')
    const [industry, setIndustry] = useState('')
    const [state, setState] = useState('')
    const [city, setCity] = useState('')
    const [employees, setEmployees] = useState('')
    const [revenue, setRevenue] = useState('')
    const [reminderDays, setReminderDays] = useState<number | null>(null)

    useEffect(() => {
        const loadProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
            if (data) {
                setBusinessName(data.business_name || '')
                setAbn(data.abn || '')
                setIndustry(data.industry || '')
                setState(data.state || '')
                setCity(data.city || '')
                setEmployees(data.employees_range || '')
                setRevenue(data.revenue_range || '')
                setPlan(data.plan || 'free')
                setReminderDays(data.reminder_days ?? null)
            }
            setLoading(false)
        }
        loadProfile()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        setSaved(false)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from('profiles').upsert({
            id: user.id,
            business_name: businessName,
            abn, industry, state, city,
            employees_range: employees,
            revenue_range: revenue,
            reminder_days: reminderDays,
            updated_at: new Date().toISOString(),
        })

        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
    }

    if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading profile...</p>

    const isEnterprise = plan === 'enterprise'

    return (
        <>
            <div className="dashboard__header">
                <h1 className="dashboard__title">Settings</h1>
                <p className="dashboard__subtitle">Update your business profile to improve grant matching.</p>
            </div>

            {/* Business Profile */}
            <div className="settings-section">
                <h3 className="settings-section__title">Business Profile</h3>
                <div className="form-group">
                    <label>Business name</label>
                    <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} />
                </div>
                <div className="form-group">
                    <label>ABN</label>
                    <input type="text" value={abn} onChange={e => setAbn(e.target.value)} placeholder="12 345 678 901" />
                </div>
                <div className="form-group">
                    <label>Industry</label>
                    <select value={industry} onChange={e => setIndustry(e.target.value)}>
                        <option value="">Select</option>
                        {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                        <label>State</label>
                        <select value={state} onChange={e => setState(e.target.value)}>
                            <option value="">Select</option>
                            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>City / Town</label>
                        <input type="text" value={city} onChange={e => setCity(e.target.value)} />
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                        <label>Employees</label>
                        <select value={employees} onChange={e => setEmployees(e.target.value)}>
                            <option value="">Select</option>
                            {EMPLOYEE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Annual revenue</label>
                        <select value={revenue} onChange={e => setRevenue(e.target.value)}>
                            <option value="">Select</option>
                            {REVENUE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                </div>

                {saved && <div className="auth-card__success">Profile saved successfully!</div>}

                <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {/* Deadline Reminders — Enterprise only */}
            <div className="settings-section">
                <h3 className="settings-section__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    🔔 Deadline Reminders
                    {!isEnterprise && <span className="settings-badge">Enterprise</span>}
                </h3>
                {!isEnterprise ? (
                    <div>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
                            Get emailed when a matched grant is about to close. Available on the Enterprise plan.
                        </p>
                        <Link href="/dashboard/billing" className="btn btn--outline btn--sm">
                            Upgrade to Enterprise →
                        </Link>
                    </div>
                ) : (
                    <div>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
                            We&apos;ll email you when a matched grant is closing soon. Choose how many days before the deadline you want to be notified.
                        </p>
                        <div className="form-group">
                            <label>Remind me before deadline</label>
                            <select
                                value={reminderDays ?? ''}
                                onChange={e => setReminderDays(e.target.value ? Number(e.target.value) : null)}
                            >
                                <option value="">Don&apos;t remind me</option>
                                <option value="7">7 days before</option>
                                <option value="14">14 days before</option>
                                <option value="30">30 days before</option>
                            </select>
                        </div>
                        <button className="btn btn--primary btn--sm" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Reminder'}
                        </button>
                    </div>
                )}
            </div>

            {/* Account */}
            <div className="settings-section">
                <h3 className="settings-section__title">Account</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Need to change your email or password? Use the links below.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn--outline btn--sm">Change Password</button>
                    <button className="btn btn--danger btn--sm">Delete Account</button>
                </div>
            </div>
        </>
    )
}
