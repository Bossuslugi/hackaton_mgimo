'use client';

import { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Dumbbell, PartyPopper, Wifi } from 'lucide-react';
import { Events } from '@/components/campus/Events';
import { ItAccess } from '@/components/campus/ItAccess';
import { Sports } from '@/components/campus/Sports';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ICON_STROKE } from '@/lib/ui';

type Tab = 'it' | 'events' | 'sports';
const TABS: Tab[] = ['it', 'events', 'sports'];

export default function CampusPage() {
  return (
    <Suspense fallback={<SkeletonCard lines={5} />}>
      <Campus />
    </Suspense>
  );
}

/** «Кампус и сервисы»: IT-доступы и Wi-Fi, мероприятия, физкультура. Вкладка — в ?tab=. */
function Campus() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get('tab') as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : 'it';
  const setTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false });

  return (
    <>
      <PageHeader
        title="Кампус и сервисы"
        description="Wi-Fi и пропуск, афиша мероприятий и спортивные секции — в одном месте"
      />
      <Segmented<Tab>
        ariaLabel="Раздел кампуса"
        value={tab}
        onChange={setTab}
        className="mb-5 max-w-full"
        options={[
          { value: 'it', label: <><Wifi size={14} strokeWidth={ICON_STROKE} className="hidden sm:inline" /> <span className="sm:hidden">IT и Wi-Fi</span><span className="hidden sm:inline">IT-доступы и Wi-Fi</span></> },
          { value: 'events', label: <><PartyPopper size={14} strokeWidth={ICON_STROKE} className="hidden sm:inline" /> <span className="sm:hidden">События</span><span className="hidden sm:inline">Мероприятия вуза</span></> },
          { value: 'sports', label: <><Dumbbell size={14} strokeWidth={ICON_STROKE} className="hidden sm:inline" /> <span className="sm:hidden">Спорт</span><span className="hidden sm:inline">Физкультура и секции</span></> },
        ]}
      />
      {tab === 'it' ? <ItAccess /> : tab === 'events' ? <Events /> : <Sports />}
    </>
  );
}
