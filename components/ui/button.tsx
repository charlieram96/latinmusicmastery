import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Timing is set with arbitrary properties: Tailwind emits nothing for duration or
// ease utilities given a var() value (ambiguous with tailwindcss-animate), and
// arbitrary properties are emitted last, so they beat the base `duration-200`.
const CHUNKY_BASE =
  "rounded-[14px] font-heading font-extrabold uppercase tracking-[0.02em] transition-[transform,box-shadow,filter] [transition-duration:var(--dur-tap)] [transition-timing-function:var(--ease-out)] " +
  "active:scale-100 active:translate-y-[4px] active:shadow-none " +
  "disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-[0_4px_0_hsl(var(--border))]"

const CHUNKY_VARIANTS = ["chunky", "chunky-success", "chunky-danger", "chunky-ghost"] as const

const baseButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_6px_18px_-8px_hsl(var(--primary)/0.55)] hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        terracotta: "bg-terracotta text-white hover:bg-terracotta/90",
        success: "bg-success text-white hover:bg-success/90",
        outline:
          "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        /** Translucent control for use on imagery (covers, the backdrop card). */
        ondark:
          "border border-white/20 bg-white/[0.12] text-white backdrop-blur-md hover:bg-white/20",
        /** The playful primary action: 3D bottom edge that sinks on press. One per screen. */
        chunky: CHUNKY_BASE + " bg-primary text-primary-foreground shadow-[0_4px_0_hsl(var(--primary-deep))] hover:brightness-105",
        "chunky-success": CHUNKY_BASE + " bg-success text-white shadow-[0_4px_0_hsl(var(--success-deep))] hover:brightness-105",
        "chunky-danger": CHUNKY_BASE + " bg-danger text-white shadow-[0_4px_0_hsl(var(--danger-deep))] hover:brightness-105",
        "chunky-ghost": CHUNKY_BASE + " bg-card text-foreground shadow-[0_4px_0_hsl(var(--border)),inset_0_0_0_2px_hsl(var(--border))] hover:bg-accent",
      },
      size: {
        default: "h-10 px-5 py-2 has-[>svg]:px-4",
        sm: "h-9 gap-1.5 px-4 text-xs has-[>svg]:px-3",
        lg: "h-11 px-6 text-[15px] has-[>svg]:px-5",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    // Chunky buttons size by padding (the spec's 8px 14px / 12px 22px), not the
    // shared fixed heights; tailwind-merge drops the shared h-/px- they replace.
    compoundVariants: [
      { variant: [...CHUNKY_VARIANTS], size: "sm", class: "h-auto gap-1.5 px-[14px] py-2 text-xs has-[>svg]:px-[14px]" },
      { variant: [...CHUNKY_VARIANTS], size: "default", class: "h-auto px-[22px] py-3 text-sm has-[>svg]:px-[22px]" },
      { variant: [...CHUNKY_VARIANTS], size: "lg", class: "h-auto px-7 py-3.5 text-base has-[>svg]:px-7" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/** cva output run through tailwind-merge, so a variant can override base classes
    (the chunky press-down replaces the base press-shrink). */
function buttonVariants(...args: Parameters<typeof baseButtonVariants>) {
  return cn(baseButtonVariants(...args))
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof baseButtonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
