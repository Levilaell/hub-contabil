'use client';

import { AppShell, type NavItem } from '@hub/ui';
import {
  AlertTriangle,
  Building2,
  FileText,
  LayoutDashboard,
  ListChecks,
  Send,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { copy } from './copy';

// Single sidebar, max 7 items (CLAUDE.md UX rule #11). Count badges are wired in
// later tasks (exceptions/requests) — the slot already exists on NavItem.
const nav: NavItem[] = [
  { label: copy.nav.inicio, href: '/inicio', icon: LayoutDashboard },
  { label: copy.nav.empresas, href: '/empresas', icon: Building2 },
  { label: copy.nav.tarefas, href: '/tarefas', icon: ListChecks },
  { label: copy.nav.documentos, href: '/documentos', icon: FileText },
  { label: copy.nav.excecoes, href: '/excecoes', icon: AlertTriangle },
  { label: copy.nav.solicitacoes, href: '/solicitacoes', icon: Send },
  { label: copy.nav.config, href: '/configuracoes', icon: Settings },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="h-dvh">
      <AppShell
        brand={copy.brand}
        nav={nav}
        activeHref={pathname}
        linkComponent={Link}
        openMenuLabel={copy.openMenu}
        closeMenuLabel={copy.closeMenu}
      >
        {children}
      </AppShell>
    </div>
  );
}
