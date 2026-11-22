import type { Metadata } from 'next';
import { PitchDeck } from '@/components/pitch/PitchDeck';

/** Публичная веб-презентация проекта: доступна без входа (см. PUBLIC_PAGES в src/middleware.ts). */
export const metadata: Metadata = {
  title: 'Презентация',
  description: 'Интерактивная презентация «Орбиты» — концепта цифрового деканата будущего. Конкурсный прототип, данные вымышлены.',
};

export default function PitchPage() {
  return <PitchDeck />;
}
