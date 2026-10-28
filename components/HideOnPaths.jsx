'use client';

import { usePathname } from 'next/navigation';

// ซ่อนส่วนของ layout (เช่น footer) ในบางหน้า — children ยัง render ฝั่ง server ได้ตามปกติ
export default function HideOnPaths({ paths, children }) {
  const pathname = usePathname() || '/';
  return paths.includes(pathname) ? null : children;
}
