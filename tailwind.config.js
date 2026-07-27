/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: '#0f2a3d',
        'mobility-green': '#1f8a5b',
        'light-green': '#e7f5ee',
        'light-blue': '#eaf3f8',
        'soft-gray': '#f5f7f8',
        'warning-yellow': '#fff7d6',
      },
    },
  },
  plugins: [],
}
