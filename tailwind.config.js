/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Sarabun', 'sans-serif'] },
      colors: {
        navy: { 950: '#0a0e27', 900: '#0f1429', 800: '#1a1f3a', 700: '#0d1135' },
      },
    },
  },
  plugins: [],
};
