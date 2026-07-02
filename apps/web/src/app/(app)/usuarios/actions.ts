'use server';

import { randomBytes } from 'node:crypto';

import { isUserRole, type UserRole } from '@hub/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// User management (T-extra). Creating an auth user / changing role needs the Admin API
// (service role), which BYPASSES RLS — so every action here re-verifies the caller from
// their own JWT (owner/manager only) and pins firm_id to the caller's firm. A manager
// may not mint or promote an owner, nobody may remove themselves, and the last owner is
// protected. Every change writes an audit_events row (golden rule #7).

export type UserActionState = { ok: boolean; message: string; tempPassword?: string } | null;

interface Caller {
  firmId: string;
  actorId: string;
  role: UserRole;
}

function fail(message: string): UserActionState {
  return { ok: false, message };
}

type Gate = { ok: true; caller: Caller } | { ok: false; message: string };

/** Owner/manager gate — returns the verified caller (firm pinned from the JWT). */
async function requireManager(): Promise<Gate> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Sessão expirada. Entre novamente.' };
  const role = (user.app_metadata?.role as string) ?? '';
  const firmId = (user.app_metadata?.firm_id as string) ?? '';
  if (!firmId || !isUserRole(role) || role === 'staff') {
    return { ok: false, message: 'Apenas titulares e gestores podem gerenciar usuários.' };
  }
  return { ok: true, caller: { firmId, actorId: user.id, role } };
}

/** Confirm the target user is in the caller's firm (RLS-scoped read) → its role. */
async function targetRole(userId: string): Promise<UserRole | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('users').select('role').eq('id', userId).maybeSingle();
  const r = (data as { role?: string } | null)?.role;
  return r && isUserRole(r) ? r : null;
}

async function ownerCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'owner');
  return count ?? 0;
}

async function audit(
  admin: SupabaseClient,
  caller: Caller,
  action: string,
  entityId: string,
  context: Record<string, unknown>,
): Promise<void> {
  await admin.from('audit_events').insert({
    firm_id: caller.firmId,
    actor_id: caller.actorId,
    action,
    entity: 'user',
    entity_id: entityId,
    context,
  });
}

export async function createUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const gate = await requireManager();
  if (!gate.ok) return gate;
  const { caller } = gate;

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const fullName = String(formData.get('fullName') ?? '').trim();
  const role = String(formData.get('role') ?? '');
  const departments = formData.getAll('departments').map((d) => String(d));

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Informe um e-mail válido.');
  if (!fullName) return fail('Informe o nome do usuário.');
  if (!isUserRole(role)) return fail('Papel inválido.');
  if (role === 'owner' && caller.role !== 'owner') {
    return fail('Apenas um titular pode criar outro titular.');
  }

  const admin = createAdminClient();
  const tempPassword = randomBytes(9).toString('base64url');

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: { firm_id: caller.firmId, role },
    user_metadata: { full_name: fullName },
  });
  if (createErr || !created?.user) {
    return fail(
      /already/i.test(createErr?.message ?? '')
        ? 'Já existe um usuário com este e-mail.'
        : 'Não foi possível criar o usuário.',
    );
  }
  const userId = created.user.id;

  const { error: profileErr } = await admin
    .from('users')
    .insert({ id: userId, firm_id: caller.firmId, email, full_name: fullName, role });
  if (profileErr) {
    await admin.auth.admin.deleteUser(userId); // roll back the orphan auth user
    return fail('Não foi possível gravar o perfil do usuário.');
  }

  if (role === 'staff' && departments.length > 0) {
    await admin.from('user_departments').insert(
      departments.map((department) => ({ firm_id: caller.firmId, user_id: userId, department })),
    );
  }

  await audit(admin, caller, 'user.created', userId, { email, role, departments });
  revalidatePath('/usuarios');
  return { ok: true, message: '', tempPassword };
}

export async function updateUserRoleAction(
  userId: string,
  role: string,
): Promise<UserActionState> {
  const gate = await requireManager();
  if (!gate.ok) return gate;
  const { caller } = gate;

  if (!isUserRole(role)) return fail('Papel inválido.');
  const current = await targetRole(userId);
  if (!current) return fail('Usuário não encontrado neste escritório.');
  if (role === 'owner' && caller.role !== 'owner') {
    return fail('Apenas um titular pode promover a titular.');
  }
  if (current === 'owner' && role !== 'owner' && (await ownerCount()) <= 1) {
    return fail('O escritório precisa de pelo menos um titular.');
  }

  const admin = createAdminClient();
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { firm_id: caller.firmId, role },
  });
  if (authErr) return fail('Não foi possível atualizar o papel.');
  await admin.from('users').update({ role }).eq('id', userId).eq('firm_id', caller.firmId);
  // owner/manager see every department — drop now-irrelevant department scoping.
  if (role !== 'staff') {
    await admin.from('user_departments').delete().eq('user_id', userId).eq('firm_id', caller.firmId);
  }

  await audit(admin, caller, 'user.role_changed', userId, { from: current, to: role });
  revalidatePath('/usuarios');
  return { ok: true, message: '' };
}

export async function setUserDepartmentsAction(
  userId: string,
  departments: string[],
): Promise<UserActionState> {
  const gate = await requireManager();
  if (!gate.ok) return gate;
  const { caller } = gate;

  const current = await targetRole(userId);
  if (!current) return fail('Usuário não encontrado neste escritório.');

  const admin = createAdminClient();
  await admin.from('user_departments').delete().eq('user_id', userId).eq('firm_id', caller.firmId);
  if (departments.length > 0) {
    await admin.from('user_departments').insert(
      departments.map((department) => ({ firm_id: caller.firmId, user_id: userId, department })),
    );
  }

  await audit(admin, caller, 'user.departments_set', userId, { departments });
  revalidatePath('/usuarios');
  return { ok: true, message: '' };
}

export async function removeUserAction(userId: string): Promise<UserActionState> {
  const gate = await requireManager();
  if (!gate.ok) return gate;
  const { caller } = gate;

  if (userId === caller.actorId) return fail('Você não pode remover a si mesmo.');
  const current = await targetRole(userId);
  if (!current) return fail('Usuário não encontrado neste escritório.');
  if (current === 'owner' && caller.role !== 'owner') {
    return fail('Apenas um titular pode remover outro titular.');
  }
  if (current === 'owner' && (await ownerCount()) <= 1) {
    return fail('O escritório precisa de pelo menos um titular.');
  }

  const admin = createAdminClient();
  await audit(admin, caller, 'user.removed', userId, { role: current }); // before the cascade
  const { error } = await admin.auth.admin.deleteUser(userId); // cascades profile + departments
  if (error) return fail('Não foi possível remover o usuário.');

  revalidatePath('/usuarios');
  return { ok: true, message: '' };
}
