// frontend/src/app/layout.js
import '../styles/globals.css';

export const metadata = {
  title: 'Empório dos Animais',
  description: 'Cuidamos do melhor para o seu pet',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Empório',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1F3A2E',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans">{children}</body>
    </html>
  );
}
