'use client';

import type { NotificationItem } from '@hub/db';
import { AppShell, type NavItem } from '@hub/ui';
import {
  AlertTriangle,
  Building2,
  FileText,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
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
  supportCount,
  notifications,
  unreadNotifications,
  children,
}: {
  exceptionCount: number;
  requestCount: number;
  supportCount: number;
  notifications: NotificationItem[];
  unreadNotifications: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // Single sidebar, max 7 items (UX rule #11). Atendimento joins the queues (badge
  // of tickets needing attention); Configurações moves to the topbar gear to stay
  // within the limit — settings is an account-level action, not a daily queue.
  const nav: NavItem[] = [
    { label: copy.nav.inicio, href: '/inicio', icon: LayoutDashboard },
    { label: copy.nav.empresas, href: '/empresas', icon: Building2 },
    { label: copy.nav.tarefas, href: '/tarefas', icon: ListChecks },
    { label: copy.nav.documentos, href: '/documentos', icon: FileText },
    { label: copy.nav.atendimento, href: '/atendimento', icon: MessageCircle, badge: supportCount },
    { label: copy.nav.excecoes, href: '/excecoes', icon: AlertTriangle, badge: exceptionCount },
    { label: copy.nav.solicitacoes, href: '/solicitacoes', icon: Send, badge: requestCount },
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
            <Link
              href="/configuracoes"
              aria-label={copy.nav.config}
              title={copy.nav.config}
              className="hover:bg-accent grid size-9 place-items-center rounded-md transition-colors"
            >
              <Settings className="size-5" aria-hidden />
            </Link>
            <Link
              href="/ajuda"
              aria-label={copy.nav.ajuda}
              title={copy.nav.ajuda}
              className="hover:bg-accent grid size-9 place-items-center rounded-md transition-colors"
            >
              <HelpCircle className="size-5" aria-hidden />
            </Link>
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
