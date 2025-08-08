/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Extended Linde theme palette
        linde: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Named semantic aliases from user palette
        'linde-primary': '#015591',
        'linde-secondary': '#33ade9',
        'linde-red': '#e1000f',
        'linde-green': '#36b04b',
        'linde-validation-red': '#fa0000',
        'linde-validation-green': '#009b3c',
        'linde-light-gray': '#d2e1eb',
        'linde-blue-gray-1': '#bec8d7',
        'linde-blue-gray-2': '#96a5b4',
        'linde-blue-gray-3': '#467391',
        'linde-accent-cyan': '#00a0e1',
        'linde-accent-turquoise': '#009b9b',
        'linde-accent-green': '#20ba82',
        'linde-accent-orange': '#dc7800',
        'linde-accent-yellow': '#ffd200',
        'linde-accent-neon-green': '#becd00',
        'linde-dark-gray': '#303535',
        'linde-medium-gray': '#586060',
        'linde-light-brown': '#ebe1cd',
        'linde-brown': '#beb49b',
        'linde-moss-green': '#afb478',
        'linde-gray': '#6e7878',
        'linde-blue': '#005591',
        'linde-information': '#33ade9',
        'linde-warning': '#ffbf00',
        'linde-error': '#ff0000',
        'linde-success': '#44e15f',
      }
    },
  },
  plugins: [],
}

