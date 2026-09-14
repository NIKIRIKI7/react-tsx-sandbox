/** @type {import('tailwindcss').Config} */
export default {
  content: {
    relative: true,
    files: ['./index.html', './studio.html', './**/*.{ts,tsx}'],
  },
  theme: {
    extend: {
      colors: {
        ink: '#06080f',
      },
    },
  },
  plugins: [],
};
