import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { missingSupabaseEnv } from '@/lib/supabase/env';

export async function middleware(request: NextRequest) {
  const problem = missingSupabaseEnv();
  if (problem) {
    const html = `<!doctype html><meta charset="utf-8"><title>Campus Market - setup needed</title>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:10vh auto;padding:0 1rem;line-height:1.5">
<h1>Campus Market needs its settings</h1><p>${problem}</p>
<p><strong>Local:</strong> copy <code>.env.example</code> to <code>.env.local</code>, fill in the Supabase URL and anon key, then restart <code>npm run dev</code>.</p>
<p><strong>Vercel:</strong> add the same variables under Project Settings &rarr; Environment Variables, then redeploy.</p>
<p>See <code>testuserloginReadme.md</code> for the full steps.</p></body>`;
    return new NextResponse(html, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads/|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
