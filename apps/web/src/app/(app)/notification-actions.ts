'use server';

import { markNotificationRead } from '@hub/db';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export async function markNotificationReadAction(id: string): Promise<void> {
  const supabase = await createClient();
  await markNotificationRead(supabase, id);
  // Root layout holds the bell — refresh its count/list everywhere.
  revalidatePath('/', 'layout');
}
