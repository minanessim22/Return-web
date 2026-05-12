import { cn } from "@/lib/utils";

type ResponsiveLayoutProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "fullscreen" | "container" | "narrow";
  background?: "default" | "gradient" | "white";
};

export function ResponsiveLayout({
  children,
  className,
  variant = "container",
  background = "default"
}: ResponsiveLayoutProps) {
  const backgroundClasses = {
    default: "bg-white",
    gradient: "return-gradient",
    white: "bg-white"
  };

  const variantClasses = {
    fullscreen: "w-full h-screen",
    container: "w-full min-h-screen lg:container lg:mx-auto lg:px-4 xl:px-8",
    narrow: "w-full min-h-screen max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
  };

  return (
    <main className={cn(
      backgroundClasses[background],
      variantClasses[variant],
      className
    )}>
      {children}
    </main>
  );
}