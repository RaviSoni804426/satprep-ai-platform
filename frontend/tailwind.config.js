/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1D4ED8",
          dark: "#1e40af",
          light: "#3b82f6"
        },
        success: "#16A34A",
        warning: "#D97706",
        danger: "#DC2626",
        bgGray: "#F9FAFB",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        passage: ["Georgia", "serif"]
      }
    },
  },
  plugins: [],
}
