import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        custom: "bg-bay-blue/80 text-white hover:bg-bay-blue",
        customDestructive: "hover:bg-franklin-red hover:text-white",
        customIcon: "hover:bg-bay-blue hover:text-white",
        customIconActive: "bg-bay-blue/50 hover:bg-bay-blue hover:text-white",
        customIconAudioActive: "bg-bay-blue/50 hover:bg-bay-blue hover:text-white animate-[pulse_2s_ease-in-out_infinite]",
        customOutline: "border border-white/20 bg-black/30 hover:bg-white/10 hover:text-white",
        customOutlineActive: "border border-bay-blue bg-bay-blue/30 text-white hover:bg-bay-blue/40",
        customPurple: "bg-[#7f5af0]/90 text-white hover:bg-[#7f5af0]",
        customGreen: "bg-[#2cb67d]/90 text-white hover:bg-[#2cb67d]",
        customAmber: "bg-amber-500/90 text-white hover:bg-amber-500",
        customGray: "bg-gray-100 text-gray-800 hover:bg-white",
      },
      size: {
        default: "h-9 px-4 py-2",
        xs: "h-6 rounded-sm px-2 text-xs", 
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
