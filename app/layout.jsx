import '@fontsource/sarabun/300.css';
import '@fontsource/sarabun/400.css';
import '@fontsource/sarabun/600.css';
import '@fontsource/sarabun/700.css';
import './globals.css';
import { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HideOnPaths from '@/components/HideOnPaths';
import NavProgress from '@/components/NavProgress';

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
        {/* หน้า login ไม่แสดง footer */}
        <HideOnPaths paths={['/login']}>
          <Footer />
        </HideOnPaths>
      </body>
    </html>
  );
}
