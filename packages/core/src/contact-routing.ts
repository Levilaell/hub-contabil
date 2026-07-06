// Contact-by-department suggestion (Fase 1.1 §1.3). Deterministic registry rule,
// NOT AI: given the sending department, suggest the company contact tagged for it.
// Priority: a contact tagged with the specific department beats one tagged "Todos"
// (empty departments list); within a tier the primary contact wins, then input
// order. The result is a SUGGESTION — the sender can always override it in the UI.

/** Structural view of a contact — @hub/core stays IO-free (no @hub/db import). */
export interface RoutableContact {
  /** Firm-config department keys this contact serves; empty = all ("Todos"). */
  departments: string[];
  isPrimary: boolean;
}

/**
 * Pick the best contact for a department. `department` null/unknown falls back
 * to the "Todos" tier (then primary-first over everyone as a last resort).
 */
export function suggestContactForDepartment<T extends RoutableContact>(
  contacts: T[],
  department: string | null,
): T | null {
  if (contacts.length === 0) return null;

  const byPrimary = (list: T[]): T | null =>
    list.find((c) => c.isPrimary) ?? list[0] ?? null;

  if (department) {
    const specific = contacts.filter((c) => c.departments.includes(department));
    const fromSpecific = byPrimary(specific);
    if (fromSpecific) return fromSpecific;
  }

  const serveAll = contacts.filter((c) => c.departments.length === 0);
  return byPrimary(serveAll) ?? byPrimary(contacts);
}
