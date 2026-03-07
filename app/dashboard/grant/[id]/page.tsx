'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Grant {
    id: string
    title: string
    source: string
    source_url: string | null
    amount_text: string | null
    amount_min: number | null
    amount_max: number | null
    states: string[]
    industries: string[]
    business_sizes: string[]
    status: string
    close_date: string | null
    description: string | null
    eligibility: string | null
    grant_type: string
    category: string | null
    url: string | null
}

export default function GrantDetailPage() {
    const params = useParams()
    const id = params.id as string
    const [grant, setGrant] = useState<Grant | null>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)
    const [plan, setPlan] = useState('free')
    const [tracked, setTracked] = useState(false)
    const [tracking, setTracking] = useState(false)
    const [downloading, setDownloading] = useState(false)

    useEffect(() => {
        const fetchGrant = async () => {
            const grantsDb = createClient()
            const { data, error } = await grantsDb
                .from('grants')
                .select('*')
                .eq('id', id)
                .single()

            if (error || !data) {
                setNotFound(true)
            } else {
                setGrant(data)
            }

            // Check user plan and if already tracked
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('plan')
                    .eq('id', user.id)
                    .single()
                setPlan(profile?.plan || 'free')

                const { data: existing } = await supabase
                    .from('application_tracker')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('grant_id', id)
                    .single()
                setTracked(!!existing)
            }

            setLoading(false)
        }
        fetchGrant()
    }, [id])

    const handleTrack = useCallback(async () => {
        if (!grant || tracking) return
        setTracking(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setTracking(false); return }

        if (tracked) {
            // Remove from tracker
            await supabase.from('application_tracker').delete().eq('user_id', user.id).eq('grant_id', id)
            setTracked(false)
        } else {
            // Add to tracker
            await supabase.from('application_tracker').insert({
                user_id: user.id,
                grant_id: grant.id,
                grant_title: grant.title,
                grant_source: grant.source,
                grant_category: grant.category,
                grant_close_date: grant.close_date,
                grant_url: grant.url || grant.source_url,
                status: 'saved',
            })
            setTracked(true)
        }
        setTracking(false)
    }, [grant, id, tracked, tracking])

    const handleDownloadPack = useCallback(async () => {
        if (!grant) return
        setDownloading(true)

        // Build a printable HTML page and trigger browser print-to-PDF
        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${grant.title} — Grant Pack</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1A1A2E; line-height: 1.6; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    .meta { color: #555; font-size: 14px; margin-bottom: 24px; }
    h2 { font-size: 18px; border-bottom: 2px solid #0F7B6C; padding-bottom: 6px; margin: 28px 0 12px; color: #0F7B6C; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
    .tag { background: #E6F5F2; color: #0F7B6C; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
    .checklist { list-style: none; padding: 0; }
    .checklist li { padding: 10px 0; border-bottom: 1px solid #E8E5E0; display: flex; align-items: flex-start; gap: 12px; }
    .checklist li::before { content: '☐'; font-size: 18px; color: #0F7B6C; flex-shrink: 0; }
    .footer { margin-top: 40px; font-size: 13px; color: #999; text-align: center; }
    @media print { body { margin: 20px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>${grant.title}</h1>
  <div class="meta">
    Source: ${grant.source} · Status: ${grant.status} · Close Date: ${grant.close_date || 'See program'} · Category: ${grant.category || 'N/A'}
  </div>

  <h2>About This Grant</h2>
  <p>${grant.description || 'See official program page for details.'}</p>

  ${grant.eligibility ? `<h2>Eligibility Criteria</h2><p>${grant.eligibility}</p>` : ''}

  ${grant.states?.length > 0 ? `<h2>Location</h2><div class="tags">${[...new Set(grant.states)].map(s => `<span class="tag">${s}</span>`).join('')}</div>` : ''}

  ${grant.industries?.length > 0 ? `<h2>Eligible Industries</h2><div class="tags">${[...new Set(grant.industries)].map(i => `<span class="tag">${i}</span>`).join('')}</div>` : ''}

  ${grant.business_sizes?.length > 0 ? `<h2>Business Size</h2><div class="tags">${[...new Set(grant.business_sizes)].map(s => `<span class="tag">${s}</span>`).join('')}</div>` : ''}

  <h2>Application Checklist</h2>
  <ul class="checklist">
    <li>Confirm your business meets all eligibility criteria above</li>
    <li>Prepare your ABN and business registration documents</li>
    <li>Gather 2–3 years of financial statements if required</li>
    <li>Prepare a project description / business case</li>
    <li>Check the official grant page for required attachments</li>
    <li>Note key milestone dates and submission deadlines</li>
    <li>Have your accountant or advisor review before submitting</li>
    ${grant.close_date ? `<li>Submit before close date: <strong>${grant.close_date}</strong></li>` : ''}
  </ul>

  <h2>Apply</h2>
  <p>Official application page: <a href="${grant.url || grant.source_url || '#'}">${grant.url || grant.source_url || 'See grant program page'}</a></p>

  <div class="footer">Generated by GrantBase · grantbase.com.au · ${new Date().toLocaleDateString('en-AU')}</div>
</body>
</html>`

        const win = window.open('', '_blank')
        if (win) {
            win.document.write(html)
            win.document.close()
            win.print()
        }
        setDownloading(false)
    }, [grant])

    if (loading) {
        return (
            <div className="grant-detail">
                <Link href="/dashboard" className="grant-detail__back">← Back to grants</Link>
                <div style={{ padding: '40px 0' }}>
                    <div style={{ height: 24, width: 120, background: 'var(--border)', borderRadius: 4, marginBottom: 16 }} />
                    <div style={{ height: 32, width: '60%', background: 'var(--border)', borderRadius: 4, marginBottom: 12 }} />
                    <div style={{ height: 20, width: '40%', background: 'var(--border)', borderRadius: 4 }} />
                </div>
            </div>
        )
    }

    if (notFound || !grant) {
        return (
            <div className="grant-detail">
                <Link href="/dashboard" className="grant-detail__back">← Back to grants</Link>
                <div className="empty-state">
                    <div className="empty-state__icon">❓</div>
                    <h3 className="empty-state__title">Grant not found</h3>
                    <p className="empty-state__text">This grant may have been removed or the link is incorrect.</p>
                </div>
            </div>
        )
    }

    const isEnterprise = plan === 'enterprise'

    return (
        <div className="grant-detail">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <Link href="/dashboard" className="grant-detail__back">← Back to grants</Link>
                <div style={{ display: 'flex', gap: 10 }}>
                    {/* Track Grant Button — Enterprise only */}
                    {isEnterprise && (
                        <button
                            className={`btn btn--sm ${tracked ? 'btn--primary' : 'btn--outline'}`}
                            onClick={handleTrack}
                            disabled={tracking}
                        >
                            {tracked ? '✓ Tracking' : '+ Track Grant'}
                        </button>
                    )}
                    {/* Download Grant Pack — Enterprise only */}
                    {isEnterprise && (
                        <button
                            className="btn btn--outline btn--sm"
                            onClick={handleDownloadPack}
                            disabled={downloading}
                        >
                            📄 Download Pack
                        </button>
                    )}
                </div>
            </div>

            <div className="grant-detail__header">
                <div className="grant-detail__category">
                    {grant.category && <span style={{ textTransform: 'capitalize' }}>{grant.category}</span>}
                    {' · '}
                    <span style={{ textTransform: 'capitalize' }}>{grant.grant_type?.replace('_', ' ')}</span>
                </div>
                <h1 className="grant-detail__title">{grant.title}</h1>
                <div className="grant-detail__meta">
                    <div className="grant-detail__meta-item">
                        📅 {grant.close_date || 'See program details'}
                    </div>
                    <div className="grant-detail__meta-item">
                        <span className={`badge ${grant.status === 'open' ? 'badge--primary' : 'badge--danger'}`}>
                            {grant.status === 'open' ? '✅ Open' : grant.status}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grant-detail__section">
                <h3>About this grant</h3>
                <p>{grant.description}</p>
                <p style={{ marginTop: 8, fontSize: 14, color: 'var(--text-muted)' }}>
                    Source: {grant.source}
                </p>
            </div>

            {grant.eligibility && (
                <div className="grant-detail__section">
                    <h3>Eligibility</h3>
                    <p>{grant.eligibility}</p>
                </div>
            )}

            {(grant.states?.length > 0 || grant.industries?.length > 0 || grant.business_sizes?.length > 0) && (
                <div className="grant-detail__section">
                    <h3>Who is this for?</h3>
                    {grant.states?.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                            <strong style={{ fontSize: 14 }}>Location:</strong>
                            <div className="grant-card__tags" style={{ marginTop: 6 }}>
                                {[...new Set(grant.states)].map((s, i) => <span key={`s-${i}`} className="grant-card__tag grant-card__tag--state">{s}</span>)}
                            </div>
                        </div>
                    )}
                    {grant.industries?.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                            <strong style={{ fontSize: 14 }}>Industries:</strong>
                            <div className="grant-card__tags" style={{ marginTop: 6 }}>
                                {[...new Set(grant.industries)].map((ind, i) => <span key={`i-${i}`} className="grant-card__tag">{ind}</span>)}
                            </div>
                        </div>
                    )}
                    {grant.business_sizes?.length > 0 && (
                        <div>
                            <strong style={{ fontSize: 14 }}>Business size:</strong>
                            <div className="grant-card__tags" style={{ marginTop: 6 }}>
                                {[...new Set(grant.business_sizes)].map((s, i) => <span key={`b-${i}`} className="grant-card__tag">{s}</span>)}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="grant-detail__apply">
                <h3>Ready to apply?</h3>
                <p>Visit the official grant page to check eligibility and start your application.</p>
                <a href={grant.url || grant.source_url || '#'} target="_blank" rel="noopener noreferrer" className="btn btn--primary">
                    Go to Application →
                </a>
            </div>

            {/* Enterprise AI Draft Preview */}
            <div className="grant-detail__draft">
                <h3>🔒 AI-Drafted Application (Enterprise)</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
                    Enterprise users get a pre-written application draft tailored to their business profile and this grant&apos;s requirements.
                </p>
                {!isEnterprise && (
                    <Link href="/dashboard/billing" className="btn btn--outline btn--sm" style={{ marginTop: '12px' }}>
                        Upgrade to Enterprise →
                    </Link>
                )}
            </div>
        </div>
    )
}
