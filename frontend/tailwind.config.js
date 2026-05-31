/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        // Paleta Negrão Consultoria
        'negrao-verde-escuro': '#1F3A2E',
        'negrao-verde-medio': '#2D5440',
        'negrao-verde-claro': '#A8B5A0',
        'negrao-grafite': '#2B2B2B',
        'negrao-grafite-claro': '#5C5C5C',
        'negrao-off-white': '#F4F1EA',
        'negrao-off-white-claro': '#FAF8F3',
        'negrao-dourado': '#B8935A',
        'negrao-dourado-suave': '#E8DDC9',
        'negrao-borda': '#D4CFC0',
        // Paleta do Empório (uso eventual em destaques do cliente)
        'emporio-azul': '#A0C8F0',
        'emporio-coral': '#C84B3C',
        'emporio-amarelo': '#DCB428'
      },
      fontFamily: {
        'serif': ['Playfair Display', 'Georgia', 'serif'],
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif']
      }
    }
  },
  plugins: []
};
