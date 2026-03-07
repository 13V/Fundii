'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import './tracker.css'

interface TrackedGrant {
    id: string
    user_id: string
    grant_id: string
    grant_title: string
    grant_source: string | null
    grant_category: string | null
    grant_close_date: string | null
    grant_url: string | null
    status: 'saved' | 'in_progress' | 'submitted' | 'won' | 'unsuccessful'
    notes: string | null
    deadline_reminder: string | null
    created_at: string
    updated_at: string
}

const COLUMNS: { key: TrackedGrant['status'], label: string, color: string }[] = [
    { key: 'saved', label: '🔖 Saved', color: '#b0b8c9' },
    { key: 'in_progress', label: '✏️ In Progress', color: 'var(--accent)' },
    { key: 'submitted', label: '📬 Submitted', color: 'var(--primary)' },
    { key: 'won', label: '🏆 Won', color: '#22c55e' },
    { key: 'unsuccessful', label: '❌ Unsuccessful', color: '#ef4444' },
]

export default function TrackerPage() {
    const [grants, setGrants] = useState<TrackedGrant[]>([])
    const [loading, setLoading] = useState(true)
    const [plan, setPlan] = useState<string>('free')
    const [movingId, setMovingId] = useState<string | null>(null)
    const [editingNotes, setEditingNotes] = useState<string | null>(null)
    const [notesValue, setNotesValue] = useState('')

    useEffect(() => {
        const load = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            // Check plan
            const { data: profile } = await supabase
                .from('profiles')
                .select('plan')
                .eq('id', user.id)
                .single()

            setPlan(profile?.plan || 'free')

            // Load tracked grants
            const { data } = await supabase
                .from('application_tracker')
                .select('*')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false })

            setGrants(data || [])
            setLoading(false)
        }
        load()
    }, [])

    const moveGrant = async (id: string, newStatus: TrackedGrant['status']) => {
        setMovingId(id)
        const supabase = createClient()
        await supabase
            .from('application_tracker')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', id)

        setGrants(prev => prev.map(g => g.id === id ? { ...g, status: newStatus } : g))
        setMovingId(null)
    }

    const saveNotes = async (id: string) => {
        const supabase = createClient()
        await supabase
            .from('application_tracker')
            .update({ notes: notesValue, updated_at: new Date().toISOString() })
            .eq('id', id)

        setGrants(prev => prev.map(g => g.id === id ? { ...g, notes: notesValue } : g))
        setEditingNotes(null)
    }

    const removeGrant = async (id: string) => {
        if (!confirm('Remove this grant from your tracker?')) return
        const supabase = createClient()
        await supabase.from('application_tracker').delete().eq('id', id)
        setGrants(prev => prev.filter(g => g.id !== id))
    }

    if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading tracker...</p>

    if (plan === 'free' || plan === 'pro') {
        return (
            <div className="tracker-upgrade">
                <div className="tracker-upgrade__icon">📋</div>
                <h2>Application Tracker</h2>
                <p>Keep track of every grant you&apos;re applying for — all in one place. Available on the Enterprise plan.</p>
                <Link href="/dashboard/billing" className="btn btn--primary">Upgrade to Enterprise →</Link>
            </div>
        )
    }

    const byStatus = (status: TrackedGrant['status']) =>
        grants.filter(g => g.status === status)

    return (
        <>
            <div className="dashboard__header">
                <h1 className="dashboard__title">Application Tracker</h1>
                <p className="dashboard__subtitle">Manage every grant application in one place.</p>
            </div>

            <div className="tracker-board">
                {COLUMNS.map(col => {
                    const cards = byStatus(col.key)
                    return (
                        <div key={col.key} className="tracker-col">
                            <div className="tracker-col__header" style={{ borderColor: col.color }}>
                                <span className="tracker-col__title">{col.label}</span>
                                <span className="tracker-col__count">{cards.length}</span>
                            </div>

                            <div className="tracker-col__cards">
                                {cards.length === 0 && (
                                    <div className="tracker-empty">No grants here yet</div>
                                )}
                                {cards.map(grant => (
                                    <div key={grant.id} className={`tracker-card ${movingId === grant.id ? 'tracker-card--moving' : ''}`}>
                                        <div className="tracker-card__title">
                                            <Link href={`/dashboard/grant/${grant.grant_id}`}>{grant.grant_title}</Link>
                                        </div>
                                        {grant.grant_source && (
                                            <div className="tracker-card__source">{grant.grant_source}</div>
                                        )}
                                        {grant.grant_close_date && (
                                            <div className="tracker-card__deadline">📅 {grant.grant_close_date}</div>
                                        )}

                                        {/* Notes */}
                                        {editingNotes === grant.id ? (
                                            <div className="tracker-card__notes-edit">
                                                <textarea
                                                    value={notesValue}
                                                    onChange={e => setNotesValue(e.target.value)}
                                                    placeholder="Add notes..."
                                                    rows={3}
                                                />
                                                <div className="tracker-card__notes-actions">
                                                    <button className="btn btn--primary btn--sm" onClick={() => saveNotes(grant.id)}>Save</button>
                                                    <button className="btn btn--outline btn--sm" onClick={() => setEditingNotes(null)}>Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                className="tracker-card__notes"
                                                onClick={() => { setEditingNotes(grant.id); setNotesValue(grant.notes || '') }}
                                            >
                                                {grant.notes || <span className="tracker-card__notes-placeholder">+ Add notes</span>}
                                            </div>
                                        )}

                                        {/* Move controls */}
                                        <div className="tracker-card__actions">
                                            <select
                                                value={grant.status}
                                                onChange={e => moveGrant(grant.id, e.target.value as TrackedGrant['status'])}
                                                className="tracker-card__move"
                                            >
                                                {COLUMNS.map(c => (
                                                    <option key={c.key} value={c.key}>{c.label}</option>
                                                ))}
                                            </select>
                                            <button className="tracker-card__remove" onClick={() => removeGrant(grant.id)} title="Remove">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>

            {grants.length === 0 && (
                <div className="empty-state" style={{ marginTop: 24 }}>
                    <div className="empty-state__icon">📋</div>
                    <h3 className="empty-state__title">No grants tracked yet</h3>
                    <p className="empty-state__text">Visit a grant in your feed and click &quot;Track this grant&quot; to add it here.</p>
                    <Link href="/dashboard" className="btn btn--outline btn--sm" style={{ marginTop: 16 }}>Go to Grant Feed →</Link>
                </div>
            )}
        </>
    )
}
