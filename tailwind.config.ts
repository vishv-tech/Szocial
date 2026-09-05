import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        szocial: {
          orange: "#F97316",
          orangeSoft: "#FFF1E7",
          teal: "#0F766E",
          tealSoft: "#E6FFFA",
          ink: "#17202A",
          muted: "#667085",
          mist: "#F8FAFC"
        }
      },
      boxShadow: {
        soft: "0 16px 40px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
