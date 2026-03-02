import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: "#00897B",
          light: "#E0F2F1",
          50: "#E0F2F1",
          500: "#00897B",
          600: "#00796B",
          700: "#00695C",
        },
        navy: {
          DEFAULT: "#1B2A4A",
          light: "#2D4A7A",
        },
        gold: {
          DEFAULT: "#F5A623",
          light: "#FFF8E1",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
