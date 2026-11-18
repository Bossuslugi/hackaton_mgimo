import { BookOpen, CalendarDays, FileText, Gauge, Inbox, LayoutGrid, UserRound, type LucideIcon } from 'lucide-react';
import type { Role } from '@/lib/types';

export interface NavItem {
  href: string;
  label: string;
  /** Короткая подпись для Bottom Tab Bar */
  short: string;
  icon: LucideIcon;
}

/** Ровно 5 разделов для студента — они же в Bottom Tab Bar (§3 дизайн-системы). */
export const STUDENT_NAV: NavItem[] = [
  { href: '/', label: 'Сводка', short: 'Сводка', icon: LayoutGrid },
  { href: '/schedule', label: 'Расписание', short: 'Расписание', icon: CalendarDays },
  { href: '/study', label: 'Учёба и ДЗ', short: 'Учёба и ДЗ', icon: BookOpen },
  { href: '/grades', label: 'Успеваемость (БРС)', short: 'БРС', icon: Gauge },
  { href: '/requests', label: 'Заявки и справки', short: 'Справки', icon: FileText },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/', label: 'Панель деканата', short: 'Панель', icon: LayoutGrid },
  { href: '/requests', label: 'Очередь заявок', short: 'Заявки', icon: Inbox },
  { href: '/profile', label: 'Профиль', short: 'Профиль', icon: UserRound },
];

export const navFor = (role: Role) => (role === 'ADMIN' ? ADMIN_NAV : STUDENT_NAV);

export const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
