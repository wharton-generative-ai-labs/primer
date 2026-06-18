"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

/**
 * Theme switcher with Sun/Moon both always painted and toggled by `dark` on
 * <html> — avoids the pre-hydration “empty” state from hiding the active icon
 * (opacity-0) until the client has measured `resolvedTheme`.
 */
export function ModeToggle() {
  const { setTheme } = useTheme()

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="relative [&_svg]:size-5"
      aria-label="Toggle color theme"
      title="Toggle color theme"
      onClick={() => {
        const isDark = document.documentElement.classList.contains("dark")
        setTheme(isDark ? "light" : "dark")
      }}
    >
      <Sun
        className="h-5 w-5 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90"
        aria-hidden
      />
      <Moon
        className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0"
        aria-hidden
      />
      <span className="sr-only">Toggle color theme</span>
    </Button>
  )
}
