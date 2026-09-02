import type { Metadata, Viewport } from 'next';
import './globals.css'; // Global styles
import SplashScreen from '@/components/SplashScreen';
import PWAProvider from '@/components/PWAProvider';

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Nexa Ai — Elite AI Developer Assistant',
  description: 'Advanced Claude-like AI Coding Assistant powered by Gemini with Infinite Memory, Zip Codebase Processing, and Deep Engineering Analysis.',
  applicationName: 'Nexa Ai',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nexa Ai',
  },
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Nexa Ai — Elite AI Developer Assistant',
    description: 'Advanced Claude-like AI Coding Assistant powered by Gemini with Infinite Memory, Zip Codebase Processing, and Deep Engineering Analysis.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexa Ai — Elite AI Developer Assistant',
    description: 'Advanced Claude-like AI Coding Assistant powered by Gemini with Infinite Memory, Zip Codebase Processing, and Deep Engineering Analysis.',
  },
  verification: {
    google: 'dtXzEN6HswwcZBy6woxiEMM9LJ8d27GI4jCLHFdEpTk',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Nexa Ai" />
      </head>
      <body suppressHydrationWarning className="flex flex-col min-h-screen">
        <PWAProvider>
          <SplashScreen />
          <main className="flex-grow">
            {children}
          </main>
        </PWAProvider>
      </body>
    </html>
  );
}
