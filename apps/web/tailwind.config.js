/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        axioma: {
          primary: '#6366f1',
          secondary: '#8b5cf6',
          success: '#22c55e',
          danger: '#ef4444',
          warning: '#f59e0b',
          yes: '#22c55e',
          no: '#ef4444',
        },
      },
    },
  },
  plugins: [],
};
