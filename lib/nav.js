// รายการเมนูหลัก — ใช้ทั้งแถบด้านบน (NavLinks) และ footer
// also = หน้าย่อยที่นับว่าอยู่ใต้เมนูนั้น
export const NAV = [
  { href: '/', label: 'หน้าหลัก' },
  { href: '/search', label: 'ข้อมูลยา', also: ['/drug'] },
  { href: '/groups', label: 'Drug Group' },
  { href: '/kpi', label: 'ตัวชี้วัด' },
  { href: '/stats', label: 'สรุป' },
];
