'use client';

import { AdminPanel } from '@/components/admin/AdminPanel';
import { StudentDashboard } from '@/components/dashboard/StudentDashboard';
import { TeacherDashboard } from '@/components/dashboard/TeacherDashboard';
import { useSession } from '@/components/shell/SessionProvider';

export default function HomePage() {
  const { isAdmin, isTeacher } = useSession();
  if (isAdmin) return <AdminPanel />;
  if (isTeacher) return <TeacherDashboard />;
  return <StudentDashboard />;
}
