'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [sent, setSent] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/login`,
        })

        if (error) {
            setError(error.message)
            setLoading(false)
            return
        }

        setSent(true)
        setLoading(false)
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <Link href="/">
                    <Image src="/assets/fundii-logo.png" alt="GrantBase" width={140} height={48} className="auth-card__logo" />
                </Link>
                <h1 className="auth-card__title">Reset your password</h1>
                <p className="auth-card__subtitle">We&apos;ll send you a link to reset it.</p>

                {error && <div className="auth-card__error">{error}</div>}
                {sent && <div className="auth-card__success">Check your inbox — we&apos;ve sent you a reset link.</div>}

                {!sent && (
                    <form onSubmit={handleReset}>
                        <div className="form-group">
                            <label htmlFor="email">Email address</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="jane@mybusiness.com.au"
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                    </form>
                )}

                <p className="auth-card__footer">
                    <Link href="/login">← Back to login</Link>
                </p>
            </div>
        </div>
    )
}
