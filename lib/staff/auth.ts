import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import type { Role } from '@/types';

export const getActingRole = cache(async (): Promise<Role> => {
  const user = await getCurrentUser();
  if (!user) return 'student';
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('acting_role');
  if (error || (data !== 'moderator' && data !== 'admin')) return 'student';
  return data;
});

export async function requireStaff(): Promise<'moderator' | 'admin'> {
  const role = await getActingRole();
  if (role !== 'moderator' && role !== 'admin') notFound();
  return role;
}

export async function requireAdmin(): Promise<'admin'> {
  const role = await requireStaff();
  if (role !== 'admin') notFound();
  return 'admin';
}
