export function missingSupabaseEnv(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return 'NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.';
  if (/your-project-ref|your-anon-key|placeholder/i.test(url + key)) return 'The Supabase settings still contain the placeholder values from .env.example.';
  try {
    new URL(url);
  } catch {
    return 'NEXT_PUBLIC_SUPABASE_URL is not a valid URL (it should look like https://abcdxyz.supabase.co).';
  }
  return null;
}
