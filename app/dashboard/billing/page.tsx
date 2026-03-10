'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

type Plan = 'free' | 'starter' | 'growth' | 'enterprise'

const PLAN_LABELS: Record<Plan, string> = {
    free: 'Free',
    starter: 'Starter',
    growth: 'Growth',
    enterprise: 'Enterprise',
}

const PLAN_PRICES: Record<Plan, string> = {
    free: '$0',
    starter: '$49',
    growth: '$79',
    enterprise: '$149',
}

export default function BillingPage() {
    const [plan, setPlan] = useState<Plan>('free')
    const [userId, setUserId] = useState<string | null>(null)
    const [email, setEmail] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [upgrading, setUpgrading] = useState<string | null>(null)
    const [managing, setManaging] = useState(false)

    useEffect(() => {
        const supabase = createClient()
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (!user) { setLoading(false); return }
            setUserId(user.id)
            setEmail(user.email ?? null)
            const { data: profile } = await supabase
                .from('profiles')
                .select('plan')
                .eq('id', user.id)
                .single()
            setPlan((profile?.plan as Plan) || 'free')
            setLoading(false)
        })
    }, [])

    const handleUpgrade = async (targetPlan: string) => {
        if (!userId || upgrading) return
        setUpgrading(targetPlan)
        try {
            const res = await fetch('/api/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: targetPlan, userId, email }),
            })
            const { url, error } = await res.json()
            if (error) { alert(`Error: ${error}`); return }
            window.location.href = url
        } catch {
            alert('Something went wrong. Please try again.')
        } finally {
            setUpgrading(null)
        }
    }

    const handleManageBilling = async () => {
        if (managing) return
        setManaging(true)
        try {
            const res = await fetch('/api/billing-portal', { method: 'POST' })
            const { url, error } = await res.json()
            if (error) { alert(`Error: ${error}`); return }
            window.location.href = url
        } catch {
            alert('Something went wrong. Please try again.')
        } finally {
            setManaging(false)
        }
    }

    if (loading) {
        return (
            <>
                <div className="dashboard__header">
                    <h1 className="dashboard__title">Billing</h1>
                </div>
                <div style={{ height: 120, background: 'var(--border)', borderRadius: 12 }} />
            </>
        )
    }

    const isPaid = plan !== 'free'

    return (
        <>
            <div className="dashboard__header">
                <h1 className="dashboard__title">Billing</h1>
                <p className="dashboard__subtitle">Manage your subscription and payment details.</p>
            </div>

            {/* Current plan */}
            <div className="billing-plan">
                <span className="badge badge--accent billing-plan__badge">{PLAN_LABELS[plan]}</span>
                <h3 className="billing-plan__name">{PLAN_LABELS[plan]} Plan</h3>
                <div className="billing-plan__price">
                    {PLAN_PRICES[plan]}<span>/month</span>
                </div>
                {isPaid && (
                    <button
                        className="btn btn--outline btn--sm"
                        onClick={handleManageBilling}
                        disabled={managing}
                        style={{ marginTop: 16 }}
                    >
                        {managing ? 'Loading...' : 'Manage Subscription →'}
                    </button>
                )}
            </div>

            {/* Upgrade options */}
            {!isPaid && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '640px' }}>
                    <div className="billing-plan" style={{ borderColor: 'var(--primary)' }}>
                        <h3 className="billing-plan__name">Growth</h3>
                        <div className="billing-plan__price">$79<span>/month</span></div>
                        <div className="billing-plan__features">
                            <div className="billing-plan__feature">
                                <CheckIcon /> Unlimited grant matches
                            </div>
                            <div className="billing-plan__feature">
                                <CheckIcon /> Instant email alerts
                            </div>
                            <div className="billing-plan__feature">
                                <CheckIcon /> Email support
                            </div>
                        </div>
                        <button
                            className="btn btn--primary btn--full"
                            onClick={() => handleUpgrade('growth')}
                            disabled={!!upgrading}
                        >
                            {upgrading === 'growth' ? 'Loading...' : 'Upgrade to Growth'}
                        </button>
                    </div>

                    <div className="billing-plan" style={{ borderColor: 'var(--accent)' }}>
                        <span className="badge badge--accent billing-plan__badge">RECOMMENDED</span>
                        <h3 className="billing-plan__name">Enterprise</h3>
                        <div className="billing-plan__price">$149<span>/month</span></div>
                        <div className="billing-plan__features">
                            <div className="billing-plan__feature">
                                <CheckIcon /> Everything in Growth
                            </div>
                            <div className="billing-plan__feature">
                                <CheckIcon /> AI-drafted applications
                            </div>
                            <div className="billing-plan__feature">
                                <CheckIcon /> Track & download grants
                            </div>
                        </div>
                        <button
                            className="btn btn--primary btn--full"
                            onClick={() => handleUpgrade('enterprise')}
                            disabled={!!upgrading}
                        >
                            {upgrading === 'enterprise' ? 'Loading...' : 'Upgrade to Enterprise'}
                        </button>
                    </div>
                </div>
            )}

            {plan === 'growth' && (
                <div className="billing-plan" style={{ borderColor: 'var(--accent)', maxWidth: 320 }}>
                    <span className="badge badge--accent billing-plan__badge">UPGRADE</span>
                    <h3 className="billing-plan__name">Enterprise</h3>
                    <div className="billing-plan__price">$149<span>/month</span></div>
                    <div className="billing-plan__features">
                        <div className="billing-plan__feature"><CheckIcon /> AI-drafted applications</div>
                        <div className="billing-plan__feature"><CheckIcon /> Track & download grants</div>
                    </div>
                    <button
                        className="btn btn--primary btn--full"
                        onClick={() => handleUpgrade('enterprise')}
                        disabled={!!upgrading}
                    >
                        {upgrading === 'enterprise' ? 'Loading...' : 'Upgrade to Enterprise'}
                    </button>
                </div>
            )}

            <p style={{ marginTop: '24px', fontSize: '14px', color: 'var(--text-muted)', maxWidth: '640px' }}>
                No lock-in contracts. Cancel anytime. Payments processed securely by Stripe.
            </p>
        </>
    )
}

function CheckIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="8" stroke="var(--primary)" strokeWidth="1.5" />
            <path d="M5.5 9L8 11.5L12.5 6.5" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}
