'use client';

import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { countdownLabel, countdownParts, deadlineTone } from '@/lib/format';
import { ICON_STROKE } from '@/lib/ui';
import { Badge } from './Badge';

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Тикающий таймер дедлайна в бейдже: < 24 ч — danger, < 72 ч — warning. */
export function Countdown({ deadline, done }: { deadline: string; done?: boolean }) {
  const now = useNow(1000);
  const p = countdownParts(deadline, now);
  if (done) return null;
  return (
    <Badge tone={deadlineTone(p.ms)} icon={<Timer size={12} strokeWidth={ICON_STROKE} />} className="tabular-nums">
      <span suppressHydrationWarning>{countdownLabel(p)}</span>
    </Badge>
  );
}
