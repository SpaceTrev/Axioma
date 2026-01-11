import type { Metadata } from 'next';
import './globals.css';
import { Header, Footer } from '@/components/layout';

export const metadata: Metadata = {
  title: 'Axioma - Prediction Markets',
  description: 'Trade on the outcome of future events',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
