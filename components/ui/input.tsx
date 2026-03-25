import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-12 w-full rounded-[1.2rem] border border-border/70 bg-white/80 px-4 py-3 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary/45 focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
