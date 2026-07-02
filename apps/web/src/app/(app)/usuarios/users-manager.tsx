'use client';

import type { FirmUser, UserRole } from '@hub/db';
import { DataList, DataListRow, DetailDrawer, EmptyState } from '@hub/ui';
import { UserPlus, Users } from 'lucide-react';
import { useActionState, useState, useTransition } from 'react';

import {
  createUserAction,
  removeUserAction,
  setUserDepartmentsAction,
  updateUserRoleAction,
  type UserActionState,
} from './actions';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from './copy';

type Dept = { key: string; label: string };

export function UsersManager({
  users,
  departments,
  currentUserId,
  currentUserRole,
}: {
  users: FirmUser[];
  departments: Dept[];
  currentUserId: string;
  currentUserRole: 'owner' | 'manager';
}) {
  // A manager cannot create or promote an owner.
  const roleOptions: UserRole[] =
    currentUserRole === 'owner' ? ['owner', 'manager', 'staff'] : ['manager', 'staff'];

  const [createState, createAction, creating] = useActionState<UserActionState, FormData>(
    createUserAction,
    null,
  );
  const [createRole, setCreateRole] = useState<UserRole>('staff');

  const [selected, setSelected] = useState<FirmUser | null>(null);

  return (
    <div className="space-y-8">
      {/* Create */}
      <section className="bg-card space-y-4 rounded-xl border p-5">
        <div className="flex items-center gap-2">
          <UserPlus className="text-muted-foreground size-4" aria-hidden />
          <h2 className="text-sm font-semibold">{copy.create.title}</h2>
        </div>
        <form action={createAction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium">{copy.create.fullName}</span>
              <input name="fullName" required className={inputClass} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium">{copy.create.email}</span>
              <input name="email" type="email" required className={inputClass} />
            </label>
          </div>
          <label className="space-y-1.5">
            <span className="text-xs font-medium">{copy.create.role}</span>
            <select
              name="role"
              value={createRole}
              onChange={(e) => setCreateRole(e.target.value as UserRole)}
              className={inputClass}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {copy.roles[r]}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground block text-xs">{copy.roleHint[createRole]}</span>
          </label>
          {createRole === 'staff' ? (
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium">{copy.create.departments}</legend>
              <div className="flex flex-wrap gap-3">
                {departments.map((d) => (
                  <label key={d.key} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="departments" value={d.key} />
                    {d.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          {createState && !createState.ok ? (
            <p className="text-danger-text text-sm">{createState.message}</p>
          ) : null}
          <button type="submit" disabled={creating} className={primaryButtonClass}>
            {creating ? copy.create.submitting : copy.create.submit}
          </button>
        </form>

        {createState?.ok && createState.tempPassword ? (
          <div className="bg-card space-y-1 rounded-lg border p-3 text-sm">
            <p className="text-success-text font-medium">{copy.create.passwordTitle}</p>
            <p>{copy.create.passwordLabel}</p>
            <code className="bg-background inline-block rounded px-2 py-1 font-mono text-sm">
              {createState.tempPassword}
            </code>
            <p className="text-muted-foreground text-xs">{copy.create.passwordNote}</p>
          </div>
        ) : null}
      </section>

      {/* List */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{copy.list.title}</h2>
        {users.length === 0 ? (
          <EmptyState icon={Users} title={copy.list.empty} />
        ) : (
          <DataList>
            {users.map((u) => (
              <DataListRow
                key={u.id}
                onClick={() => setSelected(u)}
                title={`${u.fullName || u.email}${u.id === currentUserId ? ` (${copy.list.you})` : ''}`}
                facts={[
                  u.email,
                  copy.roles[u.role],
                  u.role === 'staff'
                    ? u.departments.map((k) => deptLabel(departments, k)).join(', ') ||
                      copy.list.noDepartments
                    : copy.list.noDepartments,
                ]}
              />
            ))}
          </DataList>
        )}
      </section>

      {selected ? (
        <EditDrawer
          key={selected.id}
          user={selected}
          departments={departments}
          roleOptions={roleOptions}
          isSelf={selected.id === currentUserId}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function deptLabel(departments: Dept[], key: string): string {
  return departments.find((d) => d.key === key)?.label ?? key;
}

function EditDrawer({
  user,
  departments,
  roleOptions,
  isSelf,
  onClose,
}: {
  user: FirmUser;
  departments: Dept[];
  roleOptions: UserRole[];
  isSelf: boolean;
  onClose: () => void;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [depts, setDepts] = useState<string[]>(user.departments);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<UserActionState>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res && !res.ok) setError(res.message);
      else onClose();
    });
  }

  function toggleDept(key: string) {
    setDepts((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <DetailDrawer
      open
      onOpenChange={(o) => !o && onClose()}
      title={user.fullName || user.email}
      description={user.email}
      closeLabel={copy.drawer.close}
    >
      <div className="space-y-6">
        {error ? <p className="text-danger-text text-sm">{error}</p> : null}

        <div className="space-y-2">
          <label className="text-xs font-medium">{copy.drawer.roleLabel}</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className={inputClass}
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {copy.roles[r]}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">{copy.roleHint[role]}</p>
          <button
            type="button"
            disabled={pending || role === user.role}
            onClick={() => run(() => updateUserRoleAction(user.id, role))}
            className={secondaryButtonClass}
          >
            {pending ? copy.drawer.saving : copy.drawer.roleSave}
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium">{copy.drawer.departmentsLabel}</label>
          {role === 'staff' ? (
            <>
              <div className="flex flex-wrap gap-3">
                {departments.map((d) => (
                  <label key={d.key} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={depts.includes(d.key)}
                      onChange={() => toggleDept(d.key)}
                    />
                    {d.label}
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setUserDepartmentsAction(user.id, depts))}
                className={secondaryButtonClass}
              >
                {pending ? copy.drawer.saving : copy.drawer.departmentsSave}
              </button>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">{copy.drawer.departmentsOnlyStaff}</p>
          )}
        </div>

        {!isSelf ? (
          <div className="border-t pt-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm(copy.drawer.removeConfirm)) run(() => removeUserAction(user.id));
              }}
              className="text-danger-text hover:bg-accent rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
            >
              {copy.drawer.remove}
            </button>
          </div>
        ) : null}
      </div>
    </DetailDrawer>
  );
}
