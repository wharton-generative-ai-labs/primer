import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

export default {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./packages/**/implementation/**/*.{js,ts,jsx,tsx}",
    "./packages/**/components/**/*.{js,ts,jsx,tsx}",
    "./plugins/**/implementation/**/*.{js,ts,jsx,tsx}",
    "./plugins/**/components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
  	extend: {
		fontFamily: {
			sans: ['var(--font-roboto)', 'system-ui', 'sans-serif'],
			serif: ['"Minion Pro"', 'Georgia', 'serif'],
			'fira-code': ['Fira Code Custom'],
			'penn-sans': ['Arial', 'sans-serif'],
			'penn-serif': ['Georgia', 'serif'],
		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			'penn-red': '#990000',
  			'penn-blue': '#011F5B',
  			'franklin-red': '#C8001E',
  			'sunset-red': '#962270',
  			'impact-purple': '#9B69FF',
  			'pacific-blue': '#004785',
  			'cobalt': '#0064F0',
  			'bay-blue': '#06AAFC',
  			'morning-yellow': '#D7BC6A',
  			'marine-gray': '#EEEDEA',
			'terminal-file': '#aaa',
			'terminal-directory': '#D7BC6A',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))'
  			},
  			tag: {
  				DEFAULT: 'hsl(var(--tag))',
  				foreground: 'hsl(var(--tag-foreground))'
  			},
  			'accent-purple': {
  				DEFAULT: 'hsl(var(--accent-purple))',
  				foreground: 'hsl(var(--accent-purple-foreground))'
  			},
  			brand: 'hsl(var(--brand))',
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
      typography: {
        DEFAULT: {
          css: {
            // Any other typography customizations can go here
          }
        }
      }
  	}
  },
  plugins: [animate, typography],
} satisfies Config;
