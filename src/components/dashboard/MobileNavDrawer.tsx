'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type MobileNavDrawerProps = {
  open: boolean;
  onClose: () => void;
  isRTL?: boolean;
  title?: string;
  children: React.ReactNode;
  variant?: 'gradient' | 'light';
};

export function MobileNavDrawer({
  open,
  onClose,
  isRTL = false,
  title = 'Menu',
  children,
  variant = 'gradient'
}: MobileNavDrawerProps) {
  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[60] bg-black/50 transition-opacity duration-300 md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={cn(
          'fixed top-0 bottom-0 z-[70] flex w-[min(300px,88vw)] flex-col shadow-2xl transition-transform duration-300 ease-out md:hidden',
          variant === 'gradient'
            ? 'bg-gradient-to-b from-[#014CB3] to-[#60C10F]'
            : 'bg-white',
          isRTL ? 'right-0' : 'left-0',
          open
            ? 'translate-x-0'
            : isRTL
              ? 'translate-x-full'
              : '-translate-x-full'
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            'flex items-center justify-between border-b px-4 py-4',
            variant === 'gradient' ? 'border-white/20' : 'border-gray-100'
          )}
        >
          <span
            className={cn(
              'text-sm font-bold uppercase tracking-wider',
              variant === 'gradient' ? 'text-white' : 'text-gray-800'
            )}
          >
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors',
              variant === 'gradient'
                ? 'text-white hover:bg-white/15'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </>
  );
}
