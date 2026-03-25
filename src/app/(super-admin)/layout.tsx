import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { signOut } from '@/lib/auth';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  MessageSquare,
  CreditCard,
  Bot,
  UserCog,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'סקירה כללית', icon: LayoutDashboard, roles: ['super_admin', 'staff_support', 'staff_billing'] },
  { href: '/admin/clients', label: 'ניהול לקוחות', icon: Users, roles: ['super_admin', 'staff_support'] },
  { href: '/admin/billing', label: 'חיוב ו-CRM', icon: CreditCard, roles: ['super_admin', 'staff_billing'] },
  { href: '/admin/staff', label: 'עובדים', icon: UserCog, roles: ['super_admin'] },
  { href: '/admin/ai-assistant', label: 'עוזר AI', icon: Bot, roles: ['super_admin'] },
  { href: '/admin/settings', label: 'הגדרות', icon: Settings, roles: ['super_admin'] },
];

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.user.role === 'client') redirect('/login');

  const role = session.user.role;
  const visibleNav = navItems.filter((item) => item.roles.includes(role));

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">
      <aside className="w-64 bg-white border-l border-gray-200 flex flex-col shadow-sm fixed right-0 top-0 h-full z-10">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-sm leading-tight">לוח ניהול</h1>
              <p className="text-xs text-blue-600 font-semibold">
                {role === 'super_admin' ? 'Super Admin' : 'Staff'}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors group"
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-700">
                {session.user.name?.charAt(0) || 'א'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{session.user.name}</p>
              <p className="text-xs text-blue-600 font-semibold capitalize">{role.replace('_', ' ')}</p>
            </div>
          </div>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button
              type="submit"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>יציאה</span>
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 mr-64 p-6 min-h-screen">{children}</main>
    </div>
  );
}
