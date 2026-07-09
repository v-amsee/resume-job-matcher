export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Muted, deep teal-green accent (Greenhouse-adjacent) instead of the
        // previous saturated blue -- used sparingly against a neutral
        // gray/white base rather than as the dominant color everywhere.
        brand: {
          50: '#f0f7f4',
          100: '#dbeae2',
          200: '#b8d5c8',
          300: '#8bb9a8',
          400: '#5c9885',
          500: '#3d7d68',
          600: '#2f6553',
          700: '#275144',
          800: '#214237',
          900: '#1b362e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
