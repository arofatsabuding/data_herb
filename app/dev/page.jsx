import ExcelButton from '@/components/ExcelButton';
import LoginRequired from '@/components/LoginRequired';
import { ROLE_LABEL, allowed, currentUser, isDevHash } from '@/lib/auth';
import { DB_ROLES, countLogins, listLogins, listUsers } from '@/lib/auth-db';
import { changeRole } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'ผู้พัฒนา — HERB Center' };

const fmt = (n) => Number(n || 0).toLocaleString('th-TH');
const when = (t) =>
  new Date(t).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'medium' }) + ' น.';

const TH = 'px-4 py-2 font-semibold';
const TD = 'px-4 py-2';

// หน้าผู้พัฒนา — เฉพาะเลขบัตรใน THAID_DEV_CIDS: รายชื่อผู้เข้าสู่ระบบ + กำหนด role + ประวัติการเข้าใช้
export default async function DevPage() {
  const user = await currentUser();
  if (!allowed(user, 'dev')) return <LoginRequired next="/dev" title="หน้าผู้พัฒนา" user={user} />;

  const users = listUsers().map((u) => ({ ...u, dev: isDevHash(u.cid_hash) }));
  const logins = listLogins(300);
  const total = countLogins();

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-gray-800">ผู้พัฒนา — ผู้ใช้และการเข้าสู่ระบบ</h1>
        <p className="text-sm text-gray-600">
          ผู้ที่เคยเข้าสู่ระบบด้วย ThaiD ทั้งหมด · คนใหม่ได้ role <b>ผู้ใช้</b> · role <b>ผู้พัฒนา</b> กำหนดจากเลขบัตรใน{' '}
          <span className="mono">THAID_DEV_CIDS</span> (.env) เท่านั้น · ตอนนี้ทุก role เข้าหน้าสรุปและหน้าผู้ดูแลได้
          (ตั้งที่ <span className="mono">ACCESS</span> ใน lib/auth.js)
        </p>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-800">รายชื่อผู้ใช้ ({fmt(users.length)} คน)</h2>
          <ExcelButton tables={[{ id: 'dev-users', name: 'ผู้ใช้' }]} filename="herb_users" />
        </div>
        <div className="overflow-x-auto">
          <table id="dev-users" className="w-full text-sm">
            <thead className="bg-gradient-to-r from-emerald-50 to-teal-50 text-left text-emerald-900">
              <tr>
                <th className={TH}>ชื่อ</th>
                <th className={TH}>เลขบัตร (ปิดบางส่วน)</th>
                <th className={TH}>สิทธิ์ (role)</th>
                <th className={TH}>เข้าครั้งแรก</th>
                <th className={TH}>เข้าล่าสุด</th>
                <th className={`${TH} text-right`}>จำนวนครั้ง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-emerald-50/50">
                  <td className={TD}>
                    {u.name || '-'}
                    {u.name_en && <div className="text-xs text-gray-500">{u.name_en}</div>}
                  </td>
                  <td className={`${TD} mono`}>{u.cid_masked}</td>
                  <td className={TD} data-excel={u.dev ? ROLE_LABEL.dev : ROLE_LABEL[u.role] || u.role}>
                    {u.dev ? (
                      <span className="badge bg-amber-100 text-amber-800">ผู้พัฒนา (.env)</span>
                    ) : (
                      <form action={changeRole} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={u.id} />
                        <select name="role" defaultValue={u.role} aria-label={`role ของ ${u.name || ''}`} className="input py-1 text-sm">
                          {DB_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50">
                          บันทึก
                        </button>
                      </form>
                    )}
                  </td>
                  <td className={TD}>{when(u.first_login)}</td>
                  <td className={TD}>{when(u.last_login)}</td>
                  <td className={`${TD} text-right`}>{fmt(u.login_count)}</td>
                </tr>
              ))}
              {!users.length && (
                <tr data-excel-skip>
                  <td colSpan={6} className={`${TD} text-center text-gray-500`}>
                    ยังไม่มีผู้เข้าสู่ระบบ
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold text-gray-800">
              <tr>
                <td className={TD}>รวม</td>
                <td className={TD}>{fmt(users.length)} คน</td>
                <td className={TD} colSpan={3}></td>
                <td className={`${TD} text-right`}>{fmt(users.reduce((s, u) => s + u.login_count, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-800">
            ประวัติการเข้าสู่ระบบ {total > logins.length ? `(${fmt(logins.length)} ครั้งล่าสุด จาก ${fmt(total)})` : ''}
          </h2>
          <ExcelButton tables={[{ id: 'dev-logins', name: 'ประวัติเข้าใช้' }]} filename="herb_logins" />
        </div>
        <div className="overflow-x-auto">
          <table id="dev-logins" className="w-full text-sm">
            <thead className="bg-gradient-to-r from-emerald-50 to-teal-50 text-left text-emerald-900">
              <tr>
                <th className={TH}>เวลา</th>
                <th className={TH}>ชื่อ</th>
                <th className={TH}>IP</th>
                <th className={TH}>อุปกรณ์ / เบราว์เซอร์</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logins.map((l, i) => (
                <tr key={i} className="hover:bg-emerald-50/50">
                  <td className={`${TD} whitespace-nowrap`}>{when(l.at)}</td>
                  <td className={TD}>{l.name || '-'}</td>
                  <td className={`${TD} mono`}>{l.ip || '-'}</td>
                  <td className={`${TD} max-w-md truncate text-xs text-gray-500`} title={l.user_agent || ''}>
                    {l.user_agent || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold text-gray-800">
              <tr>
                <td className={TD}>รวม</td>
                <td className={TD} colSpan={3}>
                  {fmt(logins.length)} ครั้ง
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
