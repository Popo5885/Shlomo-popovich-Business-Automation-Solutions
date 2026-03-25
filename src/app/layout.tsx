import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'שלמה פופוביץ - שירותי אוטומציות לעסקים',
  description: 'מערכת שידור הודעות WhatsApp לקבוצות - שלמה פופוביץ שירותי אוטומציות לעסקים',
  keywords: ['WhatsApp', 'אוטומציה', 'שידור', 'קבוצות', 'עסקים'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background antialiased font-hebrew">{children}</body>
    </html>
  );
}
