/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Enable dark mode using a CSS class (you can toggle 'dark' class on <html> or <body>)
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Scan all JS/TS and JSX/TSX files in src for Tailwind classes
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        accent: '#6200ea', // Custom accent color (matches your CSS variable)
        sidebarBg: '#1e1e1e', // Dark sidebar background
      },
      fontFamily: {
        sans: ['Arial', 'sans-serif'], // Use your preferred fonts
      },
      // Add other customizations here if needed
    },
  },
  plugins: [
    // Add Tailwind plugins here if you use any (e.g., forms, typography)
  ],
}
