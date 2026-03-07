'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            setError(error.message)
            setLoading(false)
            return
        }

        router.push('/dashboard')
        router.refresh()
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <Link href="/">
                    <Image src="/assets/fundii-logo.png" alt="GrantBase" width={140} height={48} className="auth-card__logo" />
                </Link>
                <h1 className="auth-card__title">Welcome back</h1>
                <p className="auth-card__subtitle">Log in to see your latest grant matches.</p>

                {error && <div className="auth-card__error">{error}</div>}

                <form onSubmit={handleLogin}>
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
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <div style={{ textAlign: 'right', marginBottom: '24px' }}>
                        <Link href="/forgot-password" style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: 500 }}>
                            Forgot password?
                        </Link>
                    </div>
                    <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
                        {loading ? 'Logging in...' : 'Log In'}
                    </button>
                </form>

                <p className="auth-card__footer">
                    Don&apos;t have an account? <Link href="/signup">Sign up free</Link>
                </p>
            </div>
        </div>
    )
}
