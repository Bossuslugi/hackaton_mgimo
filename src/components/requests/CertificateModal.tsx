'use client';

import { Printer } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { QRCode } from '@/components/ui/QRCode';
import { Sheet } from '@/components/ui/Sheet';
import { fmtDate, fmtDateShort, REQUEST_TYPE_LABEL } from '@/lib/format';
import type { StudentRequest, User } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';

/** Детерминированный «серийный номер сертификата» для демо-штампа ЭЦП. */
function certSerial(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    h1 = Math.imul(h1 ^ seed.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 + seed.charCodeAt(i), 2246822507) >>> 0;
  }
  const hex = (h1.toString(16) + h2.toString(16) + (h1 ^ h2).toString(16)).toUpperCase().padEnd(24, '0');
  return hex.slice(0, 24).replace(/(.{4})/g, '$1 ').trim();
}

const TITLE: Record<StudentRequest['type'], { head: string; sub: string }> = {
  STUDY_CERTIFICATE: { head: 'Справка', sub: 'об обучении в образовательной организации' },
  MILITARY_CERTIFICATE: { head: 'Справка', sub: 'для представления в военный комиссариат' },
  FINANCIAL_AID: { head: 'Уведомление', sub: 'о решении по заявлению на материальную помощь' },
  RETAKE: { head: 'Направление', sub: 'на повторную промежуточную аттестацию' },
  ACADEMIC_TRANSCRIPT: { head: 'Академическая справка', sub: 'о результатах промежуточной аттестации' },
  PGAS: { head: 'Уведомление', sub: 'о назначении повышенной государственной академической стипендии' },
  DORMITORY_PASS: { head: 'Пропуск', sub: 'в студенческое общежитие' },
};

function Body({ r, u }: { r: StudentRequest; u: Partial<User> & { fullName: string } }) {
  const course = u.course ? `${u.course} курса` : '';
  const form = (u.studyForm ?? 'очной').toLowerCase();
  const common = (
    <>
      является студентом <b className="tabular-nums">{course}</b> {form} формы обучения
      {u.faculty ? <> факультета «{u.faculty}»</> : null}
      {u.program ? <>, направление подготовки «{u.program}»</> : null}, учебная группа{' '}
      <b className="tabular-nums">{u.group ?? '—'}</b>.
    </>
  );
  switch (r.type) {
    case 'STUDY_CERTIFICATE':
      return (
        <p>
          Настоящая справка выдана <b>{u.fullName}</b> в том, что он(а) действительно {common} Основа обучения:{' '}
          {(u.funding ?? 'бюджетная').toLowerCase()}. Справка выдана для предъявления по месту требования.
        </p>
      );
    case 'MILITARY_CERTIFICATE':
      return (
        <p>
          Выдана <b>{u.fullName}</b> в том, что он(а) {common} Обучение по программе с государственной аккредитацией.
          Нормативный срок окончания обучения — <span className="tabular-nums">31.08.2029</span>. Справка выдана для
          представления в военный комиссариат.
        </p>
      );
    case 'FINANCIAL_AID':
      return (
        <p>
          Заявление студента <b>{u.fullName}</b> (группа <span className="tabular-nums">{u.group ?? '—'}</span>) на
          оказание материальной помощи рассмотрено стипендиальной комиссией и <b>одобрено</b>. Выплата будет
          произведена в ближайший расчётный период на счёт, указанный в личном деле.
          {r.comment ? <> Основание: {r.comment}.</> : null}
        </p>
      );
    case 'RETAKE':
      return (
        <p>
          Студент <b>{u.fullName}</b>, учебная группа <span className="tabular-nums">{u.group ?? '—'}</span>, допускается к
          повторной промежуточной аттестации
          {r.comment ? <> по дисциплине «{r.comment}»</> : null}. Дата, время и аудитория пересдачи публикуются в разделе
          «Расписание».
        </p>
      );
    case 'ACADEMIC_TRANSCRIPT':
      return (
        <p>
          Выдана <b>{u.fullName}</b> в том, что он(а) {common} Результаты промежуточной аттестации за период обучения
          приведены в приложении к справке и сформированы по данным балльно-рейтинговой системы.
        </p>
      );
    case 'PGAS':
      return (
        <p>
          Заявление студента <b>{u.fullName}</b> (группа <span className="tabular-nums">{u.group ?? '—'}</span>) на
          назначение повышенной государственной академической стипендии рассмотрено стипендиальной комиссией и{' '}
          <b>одобрено</b>. Стипендия назначается со следующего месяца.
        </p>
      );
    case 'DORMITORY_PASS':
      return (
        <p>
          Студенту <b>{u.fullName}</b>, учебная группа <span className="tabular-nums">{u.group ?? '—'}</span>, оформлен
          пропуск в студенческое общежитие. Пропуск действителен при предъявлении студенческого билета.
        </p>
      );
  }
}

export function CertificateDocument({ request, user }: { request: StudentRequest; user: Partial<User> & { fullName: string } }) {
  const reg = request.registryNumber ?? `ОРБ-${request.id}`;
  const signed = request.signedAt ?? request.updatedAt ?? request.createdAt;
  const t = TITLE[request.type];
  const qrText = [
    'Орбита · цифровой документ (демо)',
    `Рег. № ${reg}`,
    REQUEST_TYPE_LABEL[request.type],
    `Студент: ${user.fullName}`,
    `Подписано ЭЦП: ${fmtDateShort(signed)}`,
    'Концепт. Данные вымышленные.',
  ].join('\n');

  return (
    <article
      data-print-root
      className="mx-auto w-full max-w-[720px] rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-5 text-[13px] leading-relaxed text-slate-900 dark:text-zinc-50 sm:p-8"
    >
      <header className="flex flex-col gap-4 border-b border-slate-900 dark:border-zinc-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <LogoMark size={36} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider">Орбита · демонстрационный вуз</p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">Деканат {user.faculty ? `факультета «${user.faculty}»` : 'факультета'}</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">dekanat@edu.orbita.ru</p>
          </div>
        </div>
        <dl className="shrink-0 text-xs sm:text-right">
          <div className="flex gap-1.5 sm:justify-end">
            <dt className="text-slate-500 dark:text-zinc-400">Рег. №</dt>
            <dd className="font-mono font-medium tabular-nums">{reg}</dd>
          </div>
          <div className="flex gap-1.5 sm:justify-end">
            <dt className="text-slate-500 dark:text-zinc-400">от</dt>
            <dd className="tabular-nums">{fmtDateShort(signed)}</dd>
          </div>
        </dl>
      </header>

      <div className="py-6 text-center">
        <h3 className="text-lg font-semibold uppercase tracking-[0.2em]">{t.head}</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{t.sub}</p>
      </div>

      <div className="space-y-3 sm:text-justify">
        <Body r={request} u={user} />
        <p className="text-slate-600 dark:text-zinc-400">
          Дата формирования: <span className="tabular-nums">{fmtDate(signed)}</span>.
        </p>
      </div>

      <footer className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[340px] rounded-lg border-[1.5px] border-blue-600 dark:border-blue-500 p-3 text-blue-700 dark:text-blue-400">
          <p className="text-[10px] font-semibold uppercase leading-tight tracking-wider">
            Документ подписан
            <br />
            электронной подписью
          </p>
          <dl className="mt-2 space-y-0.5 text-[11px] leading-snug">
            <div className="flex gap-1.5">
              <dt className="shrink-0 text-blue-600/80 dark:text-blue-400/80">Сертификат</dt>
              <dd className="font-mono tabular-nums break-all">{certSerial(reg)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="shrink-0 text-blue-600/80 dark:text-blue-400/80">Владелец</dt>
              <dd>{request.signedBy ?? 'Деканат, уполномоченный сотрудник'}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="shrink-0 text-blue-600/80 dark:text-blue-400/80">Действителен</dt>
              <dd className="tabular-nums">с 01.09.2026 по 31.08.2027</dd>
            </div>
          </dl>
        </div>
        <div className="flex items-end gap-3 self-start sm:self-auto">
          <div className="text-[11px] leading-snug text-slate-500 dark:text-zinc-400 sm:text-right">
            Проверка
            <br />
            подлинности
            <br />
            <span className="font-mono tabular-nums text-slate-700 dark:text-zinc-300">{reg}</span>
          </div>
          <QRCode value={qrText} size={96} title={`QR-код проверки документа ${reg}`} />
        </div>
      </footer>

      <p className="mt-8 border-t border-slate-200 dark:border-zinc-800 pt-3 text-[10px] leading-relaxed text-slate-400 dark:text-zinc-500">
        Сформировано в концепт-прототипе «Орбита» для конкурса «Цифровой деканат будущего». Не является официальным
        документом и не имеет юридической силы. Все персональные данные вымышленные.
      </p>
    </article>
  );
}

export function CertificateModal({
  request,
  user,
  onClose,
}: {
  request: StudentRequest | null;
  user: Partial<User> & { fullName: string };
  onClose: () => void;
}) {
  return (
    <Sheet
      open={request !== null}
      onClose={onClose}
      size="xl"
      title="Цифровая справка"
      description={request ? REQUEST_TYPE_LABEL[request.type] : undefined}
      bodyClassName="bg-slate-50 dark:bg-zinc-900"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="min-h-11 sm:min-h-0">
            Закрыть
          </Button>
          <Button
            onClick={() => window.print()}
            icon={<Printer size={16} strokeWidth={ICON_STROKE} />}
            className="min-h-11 sm:min-h-0"
          >
            Распечатать / Сохранить PDF
          </Button>
        </>
      }
    >
      {request && <CertificateDocument request={request} user={user} />}
    </Sheet>
  );
}
