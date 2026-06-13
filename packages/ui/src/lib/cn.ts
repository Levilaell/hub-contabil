import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Single class-name merger for the whole design system. Features must reuse this
// (never re-implement) so Tailwind conflict resolution stays consistent.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
