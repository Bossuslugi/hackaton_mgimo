'use client';

import { Suspense } from 'react';
import { Messenger } from '@/components/messages/Messenger';
import { SkeletonCard } from '@/components/ui/Skeleton';

export default function MessagesPage() {
  // useSearchParams внутри Messenger требует Suspense-границы
  return (
    <Suspense fallback={<SkeletonCard lines={6} />}>
      <Messenger />
    </Suspense>
  );
}
