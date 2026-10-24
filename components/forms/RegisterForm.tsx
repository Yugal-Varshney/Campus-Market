'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { register } from '@/lib/auth/actions';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import type { ActionState } from '@/types';

export default function RegisterForm() {
  const [state, action, pending] = useActionState(register, {} as ActionState);

  if (state.success) {
    return (
      <div className="register-success">
        <div className="info-box" role="status">
          <h2 className="font-display">CHECK YOUR INBOX</h2>
          <p>{state.success}</p>
          <Link href="/login" className="btn btn-primary" style={{ marginTop: '1rem' }}>GO TO SIGN IN</Link>
        </div>
        <aside className="verify-steps" aria-label="How email verification works">
          <h2>HOW VERIFYING WORKS</h2>
          <ol>
            <li>Open the email we just sent to your college inbox (check spam or promotions too).</li>
            <li>Click <strong>Verify</strong>. That click is the whole verification.</li>
            <li>Come back to the <Link href="/login" style={{ textDecoration: 'underline' }}>sign in page</Link> and log in with your email and password.</li>
          </ol>
          <p className="verify-note">The page that opens after you click Verify may show a Vercel address. That is normal: you do not need to do anything there or visit Vercel yourself. Just return here and sign in.</p>
        </aside>
      </div>
    );
  }
  return (
    <form action={action} className="auth-form">
      <div>
        <label className="field-label" htmlFor="register-name">Full Name</label>
        <input id="register-name" name="name" type="text" className="field-input" placeholder="Alex Sharma" maxLength={60} autoComplete="name" required />
      </div>
      <div>
        <label className="field-label" htmlFor="register-email">College Email</label>
        <input id="register-email" name="email" type="email" className="field-input" placeholder="alex@college.edu" maxLength={255} autoComplete="email" required aria-describedby="email-hint" />
        <p id="email-hint" className="field-hint">Must end in .edu or .ac.xx (e.g. .ac.in). We email you a confirmation link — it keeps the marketplace student-only.</p>
      </div>
      <div>
        <label className="field-label" htmlFor="register-password">Password</label>
        <input id="register-password" name="password" type="password" className="field-input" placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} minLength={MIN_PASSWORD_LENGTH} maxLength={72} autoComplete="new-password" required />
      </div>
      {state.error && <p className="error-box" role="alert">{state.error}</p>}
      <button type="submit" className="btn btn-primary btn-cta" style={{ width: '100%' }} disabled={pending}>{pending ? 'CREATING…' : 'CREATE ACCOUNT'}</button>
      <p className="field-hint">Already registered? <Link href="/login" style={{ textDecoration: 'underline' }}>Sign in</Link></p>
    </form>
  );
}
