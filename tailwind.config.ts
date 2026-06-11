import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#dbe4ff',
          300: '#bdccff',
          400: '#95a9ff',
          500: '#6f82ff',
          600: '#4d5df2',
          700: '#3d47d1',
          800: '#323aa9',
          900: '#2f3585'
        }
      },
      boxShadow: {
        soft: '0 20px 60px rgba(22, 30, 84, 0.14)'
      }
    }
  },
  plugins: []
};

export default config;
