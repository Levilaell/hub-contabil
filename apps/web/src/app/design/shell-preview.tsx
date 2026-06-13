'use client';

import { AppShell, type NavItem, PageHeader, StatCard } from '@hub/ui';
import {
  AlertTriangle,
  Building2,
  FileText,
  LayoutDashboard,
  ListChecks,
  Plus,
  Send,
  Settings,
} from 'lucide-react';

import { copy } from './copy';

// AppShell is a client component, and NavItem carries `icon` *functions* — which
// cannot cross the server→client boundary as props. So the preview's nav lives
// here, in client scope, and the server gallery just renders <ShellPreview />.
const previewNav: NavItem[] = [
  { label: copy.shell.nav.inicio, href: '#inicio', icon: LayoutDashboard },
  { label: copy.shell.nav.empresas, href: '#empresas', icon: Building2 },
  { label: copy.shell.nav.tarefas, href: '#tarefas', icon: ListChecks, badge: 4 },
  { label: copy.shell.nav.documentos, href: '#documentos', icon: FileText },
  { label: copy.shell.nav.excecoes, href: '#excecoes', icon: AlertTriangle, badge: 2 },
  { label: copy.shell.nav.solicitacoes, href: '#solicitacoes', icon: Send },
  { label: copy.shell.nav.config, href: '#config', icon: Settings },
];

const primaryBtn =
  'inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90';

export function ShellPreview() {
  return (
    <div className="relative h-[520px] overflow-hidden rounded-xl border">
      <AppShell
        brand={copy.shell.brand}
        nav={previewNav}
        activeHref="#empresas"
        openMenuLabel={copy.shell.openMenu}
        closeMenuLabel={copy.shell.closeMenu}
        topbarRight={<div className="bg-muted size-8 rounded-full" aria-hidden />}
      >
        <PageHeader
          title={copy.header.title}
          description={copy.header.subtitle}
          action={
            <button type="button" className={primaryBtn}>
              <Plus className="size-4" aria-hidden />
              {copy.header.action}
            </button>
          }
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <StatCard label={copy.stats.tarefasHoje} value={12} icon={ListChecks} tone="neutral" />
          <StatCard label={copy.stats.excecoes} value={2} icon={AlertTriangle} tone="warning" />
        </div>
        <p className="text-muted-foreground mt-6 text-sm">{copy.shell.content}</p>
      </AppShell>
    </div>
  );
}
