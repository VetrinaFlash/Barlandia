import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RegisterSW } from './register-sw';

export const metadata: Metadata = {
  title: 'Barlandia',
  description: 'Il bar virtuale italiano: entra, chiacchiera, arreda.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Barlandia',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#2b1d12',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
