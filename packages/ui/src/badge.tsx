import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    tone: {
      brand: "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400",
      success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
      warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
      danger: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
      neutral: "bg-muted text-muted-foreground",
    },
  },
  defaultVariants: { tone: "brand" },
});

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
