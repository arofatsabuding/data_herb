// รายการเมนูหลัก — ใช้ทั้งแถบด้านบน (components/SiteNav.jsx) และ footer
// เมนูที่ต้อง login (สรุป, วิเคราะห์รหัสยา, ผู้ดูแลระบบ, ผู้พัฒนา) อยู่ใน SiteNav
// also = หน้าย่อยที่นับว่าอยู่ใต้เมนูนั้น
export const NAV = [
  { href: '/', label: 'หน้าหลัก' },
  { href: '/search', label: 'ข้อมูลยา', also: ['/drug'] },
  { href: '/groups', label: 'Drug Group' },
  { href: '/kpi', label: 'ตัวชี้วัด' },
];
