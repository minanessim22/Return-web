import * as React from "react";

import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-brand-blue/20 bg-white px-2.5 py-1 text-xs font-semibold text-brand-blue",
        className
      )}
      {...props}
    />
  );
}
