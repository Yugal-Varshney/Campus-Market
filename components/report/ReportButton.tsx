'use client';

import { useState, useTransition } from 'react';
import { REPORT_REASONS } from '@/lib/constants';
import { submitReport } from '@/lib/reports/actions';
import { validateReport } from '@/lib/validation/report';

/** "Report" control for a listing (pass listingId) or a person (pass userId). The database enforces every rule. */
export default function ReportButton({ listingId, userId, label = 'Report' }: { listingId?: number; userId?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [pending, start] = useTransition();

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const checked = validateReport(reason, description);
    if (!checked.value) { setError(checked.error ?? 'Please check your report.'); return; }
    const value = checked.value;
    setError('');
    start(async () => {
      const res = await submitReport({ listingId, userId, reason: value.reason, description: value.description });
      if (res.error) setError(res.error);
      else { setDone(res.success ?? 'Thanks. A moderator will review your report.'); setOpen(false); }
    });
  };

  if (done) return <p className="report-done" role="status">{done}</p>;

  return (
    <div className="report-box">
      <button type="button" className="report-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{label}</button>
      {open && (
        <form className="report-form" onSubmit={send} noValidate>
          <label className="field-label" htmlFor={`report-reason-${listingId ?? userId}`}>What is wrong?</label>
          <select id={`report-reason-${listingId ?? userId}`} className="field-input" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Choose a reason…</option>
            {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <label className="field-label" htmlFor={`report-details-${listingId ?? userId}`}>Details (optional, up to 500 characters)</label>
          <textarea id={`report-details-${listingId ?? userId}`} className="field-input" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
          {error && <p className="error-box" role="alert">{error}</p>}
          <div className="contact-bar-actions">
            <button type="submit" className="btn btn-dark btn-sm" disabled={pending}>{pending ? 'SENDING…' : 'SEND REPORT'}</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>CANCEL</button>
          </div>
        </form>
      )}
    </div>
  );
}
