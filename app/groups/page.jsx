import { redirect } from 'next/navigation';

// เมนู Drug Group รวมเข้ากับเมนูข้อมูลยาแล้ว (dropdown Drug Group) — ลิงก์เดิมพาไปหน้าค้นหา
export default async function GroupsPage({ searchParams }) {
  const sp = await searchParams;
  redirect(sp.group ? `/search?group=${encodeURIComponent(sp.group)}` : '/search');
}
