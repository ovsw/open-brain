"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-[color,box-shadow,transform,background-color,border-color] outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-primary/20 bg-primary px-4 py-2.5 text-primary-foreground shadow-[0_14px_34px_rgba(148,74,44,0.22)] hover:-translate-y-0.5 hover:bg-primary/90",
        secondary:
          "border border-border/70 bg-card/85 px-4 py-2.5 text-foreground hover:-translate-y-0.5 hover:bg-card",
        ghost: "px-3 py-2 text-muted-foreground hover:bg-white/55 hover:text-foreground",
        outline:
          "border border-border/80 bg-background/60 px-4 py-2.5 text-foreground hover:border-primary/30 hover:bg-card/90",
        destructive:
          "border border-destructive/20 bg-destructive px-4 py-2.5 text-destructive-foreground shadow-[0_14px_34px_rgba(131,44,34,0.18)] hover:bg-destructive/90",
      },
      size: {
        default: "h-11",
        sm: "h-9 px-3 text-sm",
        lg: "h-12 px-5 text-base",
        icon: "size-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
