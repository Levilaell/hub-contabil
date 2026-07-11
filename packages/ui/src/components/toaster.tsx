'use client';

import { Toaster as SonnerToaster, toast } from 'sonner';

// App-wide toast feedback (T30). Mounted once in the app layout; features call
// `toast.success/error(...)` with pt-BR strings from their copy.ts. Wraps
// sonner so no feature imports the dependency directly and the styling stays
// on the design-system tokens.
export { toast };

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: '!bg-background !text-foreground !border-border !shadow-lg',
          success: '!text-success-text',
          error: '!text-danger-text',
        },
      }}
    />
  );
}
