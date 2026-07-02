// Shared design system: StatusBadge, TrafficLight, StatCard, EmptyState,
// DataList, DetailDrawer, PageHeader, app shell, tokens. Built and approved in
// T2 — no feature screen may re-implement status visuals.

export { cn } from './lib/cn';
export {
  aggregateTrafficLight,
  type DeadlineState,
  type TrafficLightState,
} from './lib/traffic-light';

export { StatusBadge, type StatusBadgeProps, type StatusTone } from './components/status-badge';
export { TrafficLight, type TrafficLightProps } from './components/traffic-light';
export { StatCard, type StatCardProps } from './components/stat-card';
export { EmptyState, type EmptyStateProps } from './components/empty-state';
export { Skeleton, SkeletonList } from './components/skeleton';
export { DataList, DataListRow, type DataListRowProps } from './components/data-list';
export { DetailDrawer, type DetailDrawerProps } from './components/detail-drawer';
export { PageHeader, type PageHeaderProps } from './components/page-header';
export {
  AppShell,
  type AppShellProps,
  type NavItem,
  type NavSection,
} from './components/app-shell';
