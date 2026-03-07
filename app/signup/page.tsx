'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default function SignupPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (password !== confirmPassword) {
            setError('Passwords don\'t match.')
            return
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters.')
            return
        }

        setLoading(true)

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/onboarding`,
            },
        })

        if (error) {
            setError(error.message)
            setLoading(false)
            return
        }

        router.push('/onboarding')
        router.refresh()
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <Link href="/">
                    <Image src="/assets/fundii-logo.png" alt="GrantBase" width={140} height={48} className="auth-card__logo" />
                </Link>
                <h1 className="auth-card__title">Create your account</h1>
                <p className="auth-card__subtitle">Start getting matched with Australian grants in under 5 minutes.</p>

                {error && <div className="auth-card__error">{error}</div>}

                <form onSubmit={handleSignup}>
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
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            required
                            minLength={8}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm password</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="Type it again"
                            required
                            minLength={8}
                        />
                    </div>
                    <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>

                <p className="auth-card__footer">
                    Already have an account? <Link href="/login">Log in</Link>
                </p>
            </div>
        </div>
    )
}
