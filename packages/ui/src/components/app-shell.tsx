'use client';

import { Menu, X, type LucideProps } from 'lucide-react';
import { type ComponentType, type ElementType, type ReactNode, useState } from 'react';

import { cn } from '../lib/cn';

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<LucideProps>;
  /** Count badge for queue items (exceptions, requests). Hidden when 0/undefined. */
  badge?: number;
}

/** A labelled group of nav items (e.g. "Administração", "Configurações"). */
export interface NavSection {
  label?: string;
  items: NavItem[];
}

export interface AppShellProps {
  /** Logo / product name, shown at the top of the sidebar. */
  brand: ReactNode;
  /** Flat navigation items (used when `sections` is not given). */
  nav?: NavItem[];
  /** Grouped navigation. Takes precedence over `nav` when present. */
  sections?: NavSection[];
  /** Current path, used to highlight the active item. */
  activeHref?: string;
  /** Right-aligned topbar slot (user menu, etc.). */
  topbarRight?: ReactNode;
  children: ReactNode;
  /** Link element used for nav items (e.g. Next's Link). Defaults to "a". */
  linkComponent?: ElementType;
  /** Accessible labels (pass pt-BR). */
  openMenuLabel?: string;
  closeMenuLabel?: string;
}

function matches(activeHref: string, href: string): boolean {
  if (activeHref === href) return true;
  return href !== '/' && activeHref.startsWith(`${href}/`);
}

// Longest-prefix wins: on /configuracoes/avancado, both "/configuracoes" and
// "/configuracoes/avancado" match — only the most specific item highlights.
function activeItemHref(activeHref: string | undefined, sections: NavSection[]): string | null {
  if (!activeHref) return null;
  let best: string | null = null;
  for (const section of sections) {
    for (const item of section.items) {
      if (matches(activeHref, item.href) && item.href.length > (best?.length ?? -1)) {
        best = item.href;
      }
    }
  }
  return best;
}

function NavLink({
  item,
  active,
  linkComponent: Link = 'a',
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  linkComponent?: ElementType;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={cn(
        'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        // Active item: orange tint + a 4px orange accent bar glued to the left.
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground before:bg-primary before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-1 before:rounded-full before:content-[""]'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
      )}
    >
      <item.icon className={cn('size-4 shrink-0', active && 'text-primary')} aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span className="bg-danger text-danger-foreground inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function NavList({
  sections,
  activeHref,
  linkComponent,
  onNavigate,
}: {
  sections: NavSection[];
  activeHref?: string;
  linkComponent?: ElementType;
  onNavigate?: () => void;
}) {
  const active = activeItemHref(activeHref, sections);
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {sections.map((section, i) => (
        <div
          key={section.label ?? `section-${i}`}
          className={cn('flex flex-col gap-1', i > 0 && 'mt-4')}
        >
          {section.label ? (
            <p className="text-sidebar-foreground/40 px-3 pb-1 text-[11px] font-semibold tracking-wide uppercase">
              {section.label}
            </p>
          ) : null}
          {section.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={item.href === active}
              linkComponent={linkComponent}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({
  brand,
  nav,
  sections,
  activeHref,
  topbarRight,
  children,
  linkComponent,
  openMenuLabel = 'Open menu',
  closeMenuLabel = 'Close menu',
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups: NavSection[] = sections?.length ? sections : [{ items: nav ?? [] }];

  return (
    <div className="bg-background relative flex h-full overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="bg-sidebar border-sidebar-border hidden w-64 shrink-0 flex-col border-r md:flex">
        <div className="flex h-14 items-center px-5 font-semibold">{brand}</div>
        <NavList sections={groups} activeHref={activeHref} linkComponent={linkComponent} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="absolute inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label={closeMenuLabel}
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="bg-sidebar border-sidebar-border absolute inset-y-0 left-0 flex w-64 flex-col border-r shadow-lg">
            <div className="flex h-14 items-center justify-between px-5 font-semibold">
              {brand}
              <button
                type="button"
                aria-label={closeMenuLabel}
                onClick={() => setMobileOpen(false)}
                className="hover:bg-sidebar-accent -mr-1 grid size-8 place-items-center rounded-md"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <NavList
              sections={groups}
              activeHref={activeHref}
              linkComponent={linkComponent}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/80 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur md:px-6">
          <button
            type="button"
            aria-label={openMenuLabel}
            onClick={() => setMobileOpen(true)}
            className="hover:bg-accent grid size-9 place-items-center rounded-md md:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="flex-1" />
          {topbarRight}
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
