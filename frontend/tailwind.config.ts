import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Example themes. These would be applied via a class on the body.
      // You would use a theme provider in React to switch between them.
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('daisyui'),
  ],
  // daisyUI config for themes
  daisyui: {
    themes: [
      {
        midnight: {
          "primary": "#3b82f6",
          "secondary": "#a855f7",
          "accent": "#10b981",
          "neutral": "#1f2937",
          "base-100": "#111827",
          "info": "#60a5fa",
          "success": "#22c55e",
          "warning": "#facc15",
          "error": "#ef4444",
        },
        sunrise: {
          "primary": "#f97316",
          "secondary": "#d946ef",
          "accent": "#14b8a6",
          "neutral": "#f3f4f6",
          "base-100": "#ffffff",
          "info": "#3b82f6",
          "success": "#22c55e",
          "warning": "#f59e0b",
          "error": "#ef4444",
        },
        glass: {
          "primary": "#67e8f9",
          "secondary": "#c084fc",
          "accent": "#4ade80",
          "neutral": "#d1d5db",
          "base-100": "rgba(255, 255, 255, 0.1)", // Semi-transparent
          "info": "#60a5fa",
          "success": "#34d399",
          "warning": "#fbbf24",
          "error": "#f87171",
        },
      },
    ],
  },
};

export default config;
