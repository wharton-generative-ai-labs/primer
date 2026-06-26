import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-semibold leading-4 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        recommended: "border-primary bg-primary text-primary-foreground",
        installed: "border-transparent bg-success text-success-foreground",
        bundled: "border-warning bg-warning text-warning-foreground",
        meta: "border-tag bg-tag text-tag-foreground",
        template: "border-accent-purple bg-accent-purple text-accent-purple-foreground",
        debugger: "border-destructive/10 bg-destructive/10 text-destructive",
        user: "border-warning bg-warning text-warning-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
