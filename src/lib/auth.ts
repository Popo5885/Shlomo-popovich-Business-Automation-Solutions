import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'shlomo@example.com';

export type UserRole = 'super_admin' | 'staff_support' | 'staff_billing' | 'client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      clientId: string;
      staffRole?: string;
    } & DefaultSession['user'];
  }
  interface User {
    id: string;
    role: UserRole;
    clientId: string;
    staffRole?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'אימייל', type: 'email' },
        password: { label: 'סיסמה', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email as string;
        const password = credentials.password as string;

        // 1. Check Staff accounts first
        const staff = await prisma.staff.findUnique({ where: { email } });
        if (staff && staff.isActive) {
          const valid = await bcrypt.compare(password, staff.passwordHash);
          if (!valid) return null;
          const role: UserRole =
            staff.role === 'SUPER_ADMIN'
              ? 'super_admin'
              : staff.role === 'BILLING_ONLY'
                ? 'staff_billing'
                : 'staff_support';
          return {
            id: staff.id,
            name: staff.name,
            email: staff.email,
            role,
            clientId: staff.id,
            staffRole: staff.role,
          };
        }

        // 2. Check Client accounts
        const client = await prisma.client.findUnique({ where: { email } });
        if (!client || !client.isActive) return null;

        // Check subscription — if suspended, block login
        if (client.subscriptionStatus === 'SUSPENDED') {
          return null; // Will show error on login page
        }

        const valid = await bcrypt.compare(password, client.passwordHash);
        if (!valid) return null;

        return {
          id: client.id,
          name: client.name,
          email: client.email,
          role: 'client' as UserRole,
          clientId: client.id,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.clientId = user.clientId;
        token.staffRole = user.staffRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.clientId = token.clientId as string;
        session.user.staffRole = token.staffRole as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
});

// ── RBAC helpers ──────────────────────────────────────────────────────────────

export function isSuperAdmin(role?: string): boolean {
  return role === 'super_admin';
}

export function isAdminOrStaff(role?: string): boolean {
  return role === 'super_admin' || role === 'staff_support' || role === 'staff_billing';
}

export function canAccessBilling(role?: string): boolean {
  return role === 'super_admin' || role === 'staff_billing';
}

export function canDeleteClients(role?: string): boolean {
  return role === 'super_admin';
}

export function canResetLimits(role?: string): boolean {
  return role === 'super_admin' || role === 'staff_support';
}
