import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Xianxia Tu Tiên RPG',
  description: 'Text-based Xianxia cultivation RPG game powered by AI. Embark on your immortal cultivation journey.',
  applicationName: 'Tu Tiên RPG',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tu Tiên RPG',
  },
  formatDetection: {
    telephone: false,
  },
  keywords: ['xianxia', 'rpg', 'cultivation', 'game', 'tu tiên', 'ai game', 'text rpg'],
};

export const viewport: Viewport = {
  themeColor: '#d4af37',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
