/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: '#004449',
        'mobility-green': '#004449',
        'light-green': '#d7ffc2',
        'light-blue': '#f0efff',
        'soft-gray': '#f4f1df',
        'warning-yellow': '#fff2b8',
        parchment: '#fffef0',
        iris: '#483cff',
        lagoon: '#004449',
        lime: '#0bff80',
      },
      boxShadow: {
        paper: 'rgba(0, 0, 0, 0.04) 0px 2px 8px 0px',
      },
    },
  },
  plugins: [],
}
