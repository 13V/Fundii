'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function BillingPage() {
    // In production, fetch the user's plan from Supabase
    const [currentPlan] = useState<'free' | 'pro' | 'enterprise'>('free')

    return (
        <>
            <div className="dashboard__header">
                <h1 className="dashboard__title">Billing</h1>
                <p className="dashboard__subtitle">Manage your subscription and payment details.</p>
            </div>

            <div className="billing-plan">
                <span className="badge badge--accent billing-plan__badge">
                    {currentPlan === 'free' ? 'FREE' : currentPlan === 'pro' ? 'PRO' : 'ENTERPRISE'}
                </span>
                <h3 className="billing-plan__name">
                    {currentPlan === 'free' ? 'Free Trial' : currentPlan === 'pro' ? 'Pro Plan' : 'Enterprise Plan'}
                </h3>
                <div className="billing-plan__price">
                    {currentPlan === 'free' ? '$0' : currentPlan === 'pro' ? '$49' : '$149'}
                    <span>/month</span>
                </div>

                {currentPlan === 'free' && (
                    <div className="billing-plan__features">
                        <div className="billing-plan__feature">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M5.5 9L8 11.5L12.5 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Limited grant matches
                        </div>
                        <div className="billing-plan__feature">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M5.5 9L8 11.5L12.5 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Basic search & filters
                        </div>
                    </div>
                )}
            </div>

            {/* Upgrade Options */}
            {currentPlan !== 'enterprise' && (
                <div style={{ display: 'grid', gridTemplateColumns: currentPlan === 'free' ? '1fr 1fr' : '1fr', gap: '24px', maxWidth: '640px' }}>
                    {currentPlan === 'free' && (
                        <div className="billing-plan" style={{ borderColor: 'var(--primary)' }}>
                            <h3 className="billing-plan__name">Pro</h3>
                            <div className="billing-plan__price">$49<span>/month</span></div>
                            <div className="billing-plan__features">
                                <div className="billing-plan__feature">
                                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke="var(--primary)" strokeWidth="1.5" /><path d="M5.5 9L8 11.5L12.5 6.5" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    Unlimited grant matches
                                </div>
                                <div className="billing-plan__feature">
                                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke="var(--primary)" strokeWidth="1.5" /><path d="M5.5 9L8 11.5L12.5 6.5" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    Instant email alerts
                                </div>
                                <div className="billing-plan__feature">
                                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke="var(--primary)" strokeWidth="1.5" /><path d="M5.5 9L8 11.5L12.5 6.5" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    Email support
                                </div>
                            </div>
                            <button className="btn btn--primary btn--full">Upgrade to Pro</button>
                        </div>
                    )}

                    <div className="billing-plan" style={{ borderColor: 'var(--accent)' }}>
                        <span className="badge badge--accent billing-plan__badge">RECOMMENDED</span>
                        <h3 className="billing-plan__name">Enterprise</h3>
                        <div className="billing-plan__price">$149<span>/month</span></div>
                        <div className="billing-plan__features">
                            <div className="billing-plan__feature">
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke="var(--primary)" strokeWidth="1.5" /><path d="M5.5 9L8 11.5L12.5 6.5" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                Everything in Pro
                            </div>
                            <div className="billing-plan__feature">
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke="var(--primary)" strokeWidth="1.5" /><path d="M5.5 9L8 11.5L12.5 6.5" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                AI-drafted grant applications
                            </div>
                            <div className="billing-plan__feature">
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke="var(--primary)" strokeWidth="1.5" /><path d="M5.5 9L8 11.5L12.5 6.5" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                Priority support & account manager
                            </div>
                        </div>
                        <button className="btn btn--primary btn--full">Upgrade to Enterprise</button>
                    </div>
                </div>
            )}

            <p style={{ marginTop: '24px', fontSize: '14px', color: 'var(--text-muted)', maxWidth: '640px' }}>
                No lock-in contracts. Cancel anytime. Payments processed securely by Stripe.
            </p>
        </>
    )
}
