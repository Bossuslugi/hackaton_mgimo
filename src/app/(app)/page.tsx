'use client';

import { AdminPanel } from '@/components/admin/AdminPanel';
import { StudentDashboard } from '@/components/dashboard/StudentDashboard';
import { useSession } from '@/components/shell/SessionProvider';

export default function HomePage() {
  const { isAdmin } = useSession();
  return isAdmin ? <AdminPanel /> : <StudentDashboard />;
}
