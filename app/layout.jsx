import '@fontsource/sarabun/300.css';
import '@fontsource/sarabun/400.css';
import '@fontsource/sarabun/600.css';
import '@fontsource/sarabun/700.css';
import './globals.css';
import { Suspense } from 'react';
import ChatWidget from '@/components/ChatWidget';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import NavProgress from '@/components/NavProgress';
import { chatEnabled } from '@/lib/chat-limit';

export const metadata = {
  title: 'HERB Center — ค้นหารหัสยาสมุนไพร',
  description: 'รวมรหัสยาแผนไทย 24 หลัก (กรมการแพทย์แผนไทยฯ) กับ TTMT Master (สมสท.) และ Drug Group',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className="flex min-h-screen flex-col">
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        {chatEnabled() && <ChatWidget />}
      </body>
    </html>
  );
}
