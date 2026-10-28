// ข้อมูลติดต่อผู้ดูแลเว็บ (ใช้ในหน้านโยบายความเป็นส่วนตัว / ข้อกำหนดการใช้งาน)
// ตั้ง SITE_CONTACT_EMAIL ใน .env — ไม่ตั้ง = บอกให้ติดต่อผ่านผู้ดูแลระบบของหน่วยงาน
export const POLICY_UPDATED = '27 ตุลาคม 2569';

export function contactText() {
  const email = process.env.SITE_CONTACT_EMAIL;
  return email ? `อีเมล ${email}` : 'ผู้ดูแลระบบ HERB Center ของหน่วยงานที่ท่านสังกัด';
}
