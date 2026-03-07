'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import './dashboard.css'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<{ email?: string; id?: string } | null>(null)
    const [businessName, setBusinessName] = useState('')
    const router = useRouter()
    const pathname = usePathname()
    const supabase = createClient()

    const [plan, setPlan] = useState('free')

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setUser(user)
                const { data } = await supabase
                    .from('profiles')
                    .select('business_name, plan')
                    .eq('id', user.id)
                    .single()
                if (data?.business_name) setBusinessName(data.business_name)
                if (data?.plan) setPlan(data.plan)
            }
        }
        getUser()
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const navItems = [
        {
            href: '/dashboard',
            label: 'Grant Feed',
            icon: (
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="3" width="16" height="14" rx="2" />
                    <path d="M2 7h16M6 11h4M6 14h8" />
                </svg>
            ),
        },
        {
            href: '/dashboard/tracker',
            label: 'Tracker',
            badge: plan === 'enterprise' ? null : '🔒',
            icon: (
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="6" y="1" width="8" height="4" rx="1" />
                    <rect x="2" y="4" width="16" height="15" rx="2" />
                    <path d="M6 10h8M6 14h4" />
                </svg>
            ),
        },
        {
            href: '/dashboard/settings',
            label: 'Settings',
            icon: (
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="10" cy="10" r="3" />
                    <path d="M10 1v2M10 17v2M1 10h2M17 10h2M3.5 3.5l1.4 1.4M15.1 15.1l1.4 1.4M3.5 16.5l1.4-1.4M15.1 4.9l1.4-1.4" />
                </svg>
            ),
        },
        {
            href: '/dashboard/billing',
            label: 'Billing',
            icon: (
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="1" y="4" width="18" height="12" rx="2" />
                    <path d="M1 8h18" />
                </svg>
            ),
        },
    ]

    const initials = businessName
        ? businessName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
        : (user?.email?.[0]?.toUpperCase() || '?')

    return (
        <div className="dashboard">
            <aside className="sidebar">
                <div className="sidebar__logo">
                    <Link href="/">
                        <Image src="/assets/fundii-logo.png" alt="Grant Base" width={100} height={36} style={{ height: 36, width: 'auto' }} />
                    </Link>
                </div>
                <nav className="sidebar__nav">
                    {navItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`sidebar__link ${pathname === item.href || pathname.startsWith(item.href + '/') ? 'sidebar__link--active' : ''}`}
                        >
                            {item.icon}
                            {item.label}
                            {'badge' in item && item.badge && <span style={{ marginLeft: 'auto', fontSize: 12 }}>{item.badge}</span>}
                        </Link>
                    ))}
                    <div className="sidebar__spacer" />
                </nav>
                <div className="sidebar__user">
                    <div className="sidebar__avatar">{initials}</div>
                    <div className="sidebar__user-info">
                        <div className="sidebar__user-name">{businessName || 'My Business'}</div>
                        <div className="sidebar__user-email">{user?.email || ''}</div>
                    </div>
                    <button className="sidebar__logout" onClick={handleLogout} title="Log out">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M6.5 16H3a1 1 0 01-1-1V3a1 1 0 011-1h3.5M12 12.5L16 9l-4-3.5M16 9H7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>
            </aside>
            <main className="dashboard__main">
                {children}
            </main>
        </div>
    )
}
