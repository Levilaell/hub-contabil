import { cn } from '@/lib/utils';

// Brand mark: an orange rounded square with a white dot — the "light" of the farol,
// the product's central metaphor (design/README.md). Reused in the sidebar and login.
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'bg-primary grid size-9 place-items-center rounded-xl shadow-[0_6px_18px_rgba(255,165,0,0.34)]',
        className,
      )}
      aria-hidden
    >
      <span className="size-2.5 rounded-full bg-white" />
    </span>
  );
}

/** Mark + wordmark, for the sidebar header. */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark />
      <span className="text-[15px] font-extrabold tracking-tight">Hub Contábil</span>
    </span>
  );
}
