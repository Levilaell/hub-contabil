'use client';

import type { NotificationItem } from '@hub/db';
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

import { Brand } from '@/components/brand';

import { copy } from './copy';
import { NotificationsBell } from './notifications-bell';
import { UserMenu } from './user-menu';

// Single sidebar, max 7 items (CLAUDE.md UX rule #11). The Exceções item carries a
// count badge of open exceptions (T9); the topbar shows the notifications bell (T10).
export function AppNav({
  exceptionCount,
  requestCount,
  notifications,
  unreadNotifications,
  children,
}: {
  exceptionCount: number;
  requestCount: number;
  notifications: NotificationItem[];
  unreadNotifications: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const nav: NavItem[] = [
    { label: copy.nav.inicio, href: '/inicio', icon: LayoutDashboard },
    { label: copy.nav.empresas, href: '/empresas', icon: Building2 },
    { label: copy.nav.tarefas, href: '/tarefas', icon: ListChecks },
    { label: copy.nav.documentos, href: '/documentos', icon: FileText },
    { label: copy.nav.excecoes, href: '/excecoes', icon: AlertTriangle, badge: exceptionCount },
    { label: copy.nav.solicitacoes, href: '/solicitacoes', icon: Send, badge: requestCount },
    { label: copy.nav.config, href: '/configuracoes', icon: Settings },
  ];

  return (
    <div className="h-dvh">
      <AppShell
        brand={<Brand />}
        nav={nav}
        activeHref={pathname}
        linkComponent={Link}
        openMenuLabel={copy.openMenu}
        closeMenuLabel={copy.closeMenu}
        topbarRight={
          <div className="flex items-center gap-1">
            <NotificationsBell notifications={notifications} unreadCount={unreadNotifications} />
            <UserMenu />
          </div>
        }
      >
        {children}
      </AppShell>
    </div>
  );
}
