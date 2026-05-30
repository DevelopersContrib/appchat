import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth.js';
import Link from 'next/link';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/tenants', label: 'Tenants', icon: '🏢' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/rooms', label: 'Rooms', icon: '📹' },
  { href: '/admin/plans', label: 'Plans', icon: '💳' },
  { href: '/admin/usage', label: 'Usage', icon: '📈' },
];

export default async function AdminLayout({ children }) {
  const user = await getSession();
  if (!user) redirect('/login');
  if (!user.is_admin) redirect('/');

  return (
    <div className="h-screen flex bg-gray-950">
      <aside className="w-60 flex flex-col border-r border-gray-800 bg-gray-900">
        <div className="p-5 border-b border-gray-800">
          <Link href="/">
            <img src="https://www.brandidentity.com/logo/appchat.com" alt="AppChat" className="h-7" />
          </Link>
          <p className="text-xs text-[#d63031] mt-2 font-medium">Admin Dashboard</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#d63031] flex items-center justify-center text-xs font-bold">
              {(user.name || user.email)[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{user.name || user.email}</p>
              <p className="text-[10px] text-gray-500">Super Admin</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
