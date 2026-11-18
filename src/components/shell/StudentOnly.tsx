'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { GraduationCap } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ICON_STROKE } from '@/lib/ui';
import { useSession } from './SessionProvider';

/** Студенческие разделы для сотрудника деканата показывают понятную заглушку вместо 403. */
export function StudentOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useSession();
  if (!isAdmin) return <>{children}</>;
  return (
    <EmptyState
      icon={<GraduationCap size={20} strokeWidth={ICON_STROKE} />}
      title="Раздел доступен студентам"
      description="Вы вошли как сотрудник деканата. Заявки и объявления — на панели деканата."
      action={
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
        >
          К панели деканата
        </Link>
      }
    />
  );
}
