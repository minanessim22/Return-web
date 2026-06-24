import { cn } from "@/lib/utils";

type MobileShellProps = {
  children: React.ReactNode;
  className?: string;
};

export function MobileShell({ children, className }: MobileShellProps) {
  return (
    <main className="return-gradient flex min-h-screen items-center justify-center p-3 sm:p-4 md:p-8">
      <div
        className={cn(
          "w-full max-w-[390px] overflow-hidden rounded-[20px] border border-brand-blue/15 bg-white shadow-[0_30px_70px_-35px_rgba(1,76,179,0.5)] sm:rounded-[26px]",
          className
        )}
      >
        {children}
      </div>
    </main>
  );
}
