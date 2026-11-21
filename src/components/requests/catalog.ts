import { Award, BedDouble, FileSpreadsheet, GraduationCap, HandCoins, RotateCcw, Shield, type LucideIcon } from 'lucide-react';
import type { RequestType } from '@/lib/types';

export interface CatalogItem {
  type: RequestType;
  title: string;
  text: string;
  eta: string;
  icon: LucideIcon;
}

/** Каталог онлайн-заявок (specs/01_PRODUCT_PRD.md §V2.7). */
export const REQUEST_CATALOG: CatalogItem[] = [
  { type: 'STUDY_CERTIFICATE', title: 'Справка об обучении', text: 'По месту требования: работа, банк, соцзащита.', eta: '~1 рабочий день', icon: GraduationCap },
  { type: 'MILITARY_CERTIFICATE', title: 'Справка в военкомат', text: 'Приложение №4 — для отсрочки на период обучения.', eta: '~2 рабочих дня', icon: Shield },
  { type: 'ACADEMIC_TRANSCRIPT', title: 'Академическая справка', text: 'Выписка оценок для перевода или стажировки, RU/EN.', eta: '~5 рабочих дней', icon: FileSpreadsheet },
  { type: 'FINANCIAL_AID', title: 'Материальная помощь', text: 'Рассматривает стипендиальная комиссия факультета.', eta: '~5 рабочих дней', icon: HandCoins },
  { type: 'PGAS', title: 'Повышенная стипендия (ПГАС)', text: 'Учёба, наука, общественная и творческая деятельность.', eta: '~10 рабочих дней', icon: Award },
  { type: 'RETAKE', title: 'Заявление на пересдачу', text: 'Направление на повторную аттестацию по дисциплине.', eta: '~2 рабочих дня', icon: RotateCcw },
  { type: 'DORMITORY_PASS', title: 'Пропуск в общежитие', text: 'Постоянный или гостевой пропуск на выбранные даты.', eta: '~2 рабочих дня', icon: BedDouble },
];

/** Подписи полей payload для карточки заявки. */
export const PAYLOAD_LABELS: Record<string, string> = {
  destination: 'Место требования',
  copies: 'Экземпляров',
  militaryOffice: 'Военкомат',
  language: 'Язык',
  category: 'Основание',
  amountRequested: 'Сумма',
  reason: 'Обоснование',
  achievements: 'Достижения',
  subject: 'Дисциплина',
  controlPoint: 'Контрольная точка',
  dormitory: 'Общежитие',
  room: 'Комната',
  guestName: 'Гость',
  period: 'Период',
};
