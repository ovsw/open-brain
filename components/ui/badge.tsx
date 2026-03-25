import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-[0.16em] uppercase transition-colors",
  {
    variants: {
      variant: {
        default: "border-border/70 bg-card/80 text-foreground",
        secondary: "border-border/70 bg-muted/70 text-muted-foreground",
        overdue: "border-status-overdue/25 bg-status-overdue/12 text-status-overdue",
        upcoming: "border-status-upcoming/30 bg-status-upcoming/14 text-status-upcoming",
        undated: "border-status-undated/20 bg-status-undated/12 text-status-undated",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
