'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { banUser, claimReport, closeReport, hideListing, restoreListing, setUserRole, suspendUser, unbanUser, unsuspendUser, warnUser } from '@/lib/staff/actions';
import { SUSPENSION_CHOICES, ROLES } from '@/lib/validation/staff';

type Result = { error?: string; success?: string };

export interface PanelProps {
  actingRole: 'moderator' | 'admin';
  selfId: string;
  report?: { id: number; status: string };
  listing?: { id: number; moderationStatus: string } | null;
  user?: { id: string; displayName: string; role: string; effectiveStatus: string } | null;
  /** Admin user page only: show the role selector. */
  showRoleChange?: boolean;
}

/** One reason box, then the buttons that make sense for this report / listing / person. The database makes the final call. */
export default function ModerationPanel({ actingRole, selfId, report, listing, user, showRoleChange = false }: PanelProps) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('1');
  const [role, setRole] = useState(user?.role ?? 'student');
  const [msg, setMsg] = useState<Result>({});
  const [pending, start] = useTransition();

  const reportId = report && (report.status === 'pending' || report.status === 'reviewing') ? report.id : undefined;
  const isAdmin = actingRole === 'admin';
  const userLocked = !!user && (user.id === selfId || (!isAdmin && user.role !== 'student'));

  const run = (fn: () => Promise<Result>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setMsg({});
    start(async () => {
      const res = await fn();
      setMsg(res);
      if (res.success) { setReason(''); router.refresh(); }
    });
  };

  const choices = SUSPENSION_CHOICES.filter((c) => !c.adminOnly || isAdmin);
  const needsReason = !!(listing || user || reportId);

  return (
    <div className="mod-panel">
      {needsReason && (
        <>
          <label className="field-label" htmlFor={`mod-reason-${report?.id ?? user?.id ?? listing?.id}`}>Reason (3 to 1000 characters, saved in the audit log)</label>
          <textarea id={`mod-reason-${report?.id ?? user?.id ?? listing?.id}`} className="field-input" rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
          <p className="mod-hint">Warnings and suspension reasons are shown to the person, so write them accordingly.</p>
        </>
      )}

      {report?.status === 'pending' && (
        <div className="mod-row"><button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => run(() => claimReport(report.id))}>CLAIM REPORT</button></div>
      )}

      {listing && (
        <div className="mod-row">
          <span className="mod-label">Listing is {listing.moderationStatus}</span>
          {listing.moderationStatus === 'approved'
            ? <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => run(() => hideListing(listing.id, reason, reportId), 'Hide this listing from students?')}>HIDE LISTING</button>
            : <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => run(() => restoreListing(listing.id, reason, reportId))}>RESTORE LISTING</button>}
        </div>
      )}

      {user && userLocked && (
        <p className="mod-hint">
          {user.id === selfId ? 'You cannot act on your own account.' : 'This person is staff; only an admin can act on them.'}
        </p>
      )}

      {user && !userLocked && (
        <div className="mod-row">
          <span className="mod-label">{user.displayName} is {user.effectiveStatus}</span>
          {user.effectiveStatus === 'active' && (
            <>
              <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => run(() => warnUser(user.id, reason, reportId))}>WARN</button>
              <select className="field-input mod-select" aria-label="Suspension length" value={duration} onChange={(e) => setDuration(e.target.value)}>
                {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => run(() => suspendUser(user.id, duration, reason, reportId), `Suspend ${user.displayName}?`)}>SUSPEND</button>
              {isAdmin && <button type="button" className="btn btn-dark btn-sm" disabled={pending} onClick={() => run(() => banUser(user.id, reason, reportId), `Ban ${user.displayName}? They will be unable to use the marketplace.`)}>BAN</button>}
            </>
          )}
          {user.effectiveStatus === 'suspended' && (
            <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => run(() => unsuspendUser(user.id, reason))}>LIFT SUSPENSION</button>
          )}
          {user.effectiveStatus === 'banned' && isAdmin && (
            <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => run(() => unbanUser(user.id, reason))}>UNBAN</button>
          )}
          {user.effectiveStatus === 'banned' && !isAdmin && <span className="mod-hint">Only an admin can unban.</span>}
        </div>
      )}

      {user && !userLocked && showRoleChange && isAdmin && (
        <div className="mod-row">
          <span className="mod-label">Role</span>
          <select className="field-input mod-select" aria-label="New role" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="button" className="btn btn-outline btn-sm" disabled={pending || role === user.role} onClick={() => run(() => setUserRole(user.id, role, reason), `Change ${user.displayName}'s role to ${role}?`)}>CHANGE ROLE</button>
        </div>
      )}

      {reportId !== undefined && (
        <div className="mod-row">
          <span className="mod-label">Close report</span>
          <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => closeReport(reportId, 'resolve', reason))}>RESOLVE</button>
          <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => run(() => closeReport(reportId, 'dismiss', reason))}>DISMISS</button>
        </div>
      )}

      {msg.error && <p className="error-box" role="alert">{msg.error}</p>}
      {msg.success && <p className="mod-ok" role="status">{msg.success}</p>}
    </div>
  );
}
