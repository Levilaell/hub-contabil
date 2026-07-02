'use client';

import type { NotificationItem } from '@hub/db';
import { AppShell, type NavSection } from '@hub/ui';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Download,
  FileText,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
  ScrollText,
  Send,
  Settings,
  Settings2,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { Brand } from '@/components/brand';

import { copy } from './copy';
import { NotificationsBell } from './notifications-bell';
import { UserMenu } from './user-menu';

// Grouped sidebar: everything is reachable from the left nav (better orientation than
// hiding settings in a topbar gear). Three sections: daily operation, administration
// (users + audit as their own tabs), and the settings set. Queues keep count badges.
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

  const sections: NavSection[] = [
    {
      items: [
        { label: copy.nav.inicio, href: '/inicio', icon: LayoutDashboard },
        { label: copy.nav.empresas, href: '/empresas', icon: Building2 },
        { label: copy.nav.tarefas, href: '/tarefas', icon: ListChecks },
        { label: copy.nav.documentos, href: '/documentos', icon: FileText },
        { label: copy.nav.prazos, href: '/prazos', icon: CalendarClock },
        {
          label: copy.nav.atendimento,
          href: '/atendimento',
          icon: MessageCircle,
          badge: supportCount,
        },
        { label: copy.nav.excecoes, href: '/excecoes', icon: AlertTriangle, badge: exceptionCount },
        { label: copy.nav.solicitacoes, href: '/solicitacoes', icon: Send, badge: requestCount },
        { label: copy.nav.exportacao, href: '/exportacao', icon: Download },
      ],
    },
    {
      label: copy.groups.admin,
      items: [
        { label: copy.nav.usuarios, href: '/usuarios', icon: Users },
        { label: copy.nav.auditoria, href: '/auditoria', icon: ScrollText },
      ],
    },
    {
      label: copy.groups.config,
      items: [
        { label: copy.nav.config, href: '/configuracoes', icon: Settings },
        { label: copy.nav.avancado, href: '/configuracoes/avancado', icon: Settings2 },
        { label: copy.nav.regras, href: '/regras', icon: SlidersHorizontal },
      ],
    },
  ];

  return (
    <div className="h-dvh">
      <AppShell
        brand={<Brand />}
        sections={sections}
        activeHref={pathname}
        linkComponent={Link}
        openMenuLabel={copy.openMenu}
        closeMenuLabel={copy.closeMenu}
        topbarRight={
          <div className="flex items-center gap-1">
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
