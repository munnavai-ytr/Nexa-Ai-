import type {Metadata} from 'next';
import './globals.css'; // Global styles
import SplashScreen from '@/components/SplashScreen';
import {Analytics} from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: 'Play Nexa AI — Autonomous Coding & Deep Research Engine',
  description: 'Autonomous Coding & Research Agent by Play Nexa',
  openGraph: {
    title: 'Play Nexa AI — Autonomous Coding & Deep Research Engine',
    description: 'Autonomous Coding & Research Agent by Play Nexa',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Play Nexa AI — Autonomous Coding & Deep Research Engine',
    description: 'Autonomous Coding & Research Agent by Play Nexa',
  },
  verification: {
    google: 'dtXzEN6HswwcZBy6woxiEMM9LJ8d27GI4jCLHFdEpTk',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="flex flex-col min-h-screen">
        <SplashScreen />
        <main className="flex-grow">
          {children}
        </main>
        <Analytics />
      </body>
    </html>
  );
}
