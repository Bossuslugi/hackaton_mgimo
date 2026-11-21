'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Lock, Minus, Plus, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/cn';
import { toGrades } from '@/lib/normalize';
import type { RequestType } from '@/lib/types';
import { ICON_STROKE } from '@/lib/ui';
import { useApi } from '@/lib/use-api';
import { REQUEST_CATALOG } from './catalog';

/**
 * Динамическая форма онлайн-заявки. Поля из схемы бэкенда (specs/04 §V2.8) уходят в `payload`,
 * остальное (способ получения, портфолио, карта и т.п.) — в `comment` построчно.
 * Номер карты МИР проверяется на клиенте и передаётся только в маскированном виде.
 */

export interface RequestSubmission {
  type: RequestType;
  payload: Record<string, unknown>;
  comment: string;
}

type Delivery = 'EDS' | 'PAPER';
const DELIVERY: Record<Delivery, { title: string; text: string }> = {
  EDS: { title: 'Электронная с ЭЦП', text: 'PDF с QR-кодом в личном кабинете' },
  PAPER: { title: 'Бумажный оригинал', text: 'Окно №2 деканата, с печатью' },
};

const AID_BASIS: { label: string; category: string }[] = [
  { label: 'Социальная категория: малоимущая семья', category: 'Малоимущая семья' },
  { label: 'Социальная категория: сирота', category: 'Сирота' },
  { label: 'Социальная категория: инвалидность', category: 'Инвалидность' },
  { label: 'Сложная жизненная ситуация', category: 'Сложная жизненная ситуация' },
  { label: 'Рождение ребёнка', category: 'Рождение ребёнка' },
  { label: 'Расходы на лечение', category: 'Другое' },
  { label: 'Расходы на проезд', category: 'Другое' },
];

const PGAS_NOMINATIONS: { label: string; type: string }[] = [
  { label: 'Научно-исследовательская', type: 'Научная' },
  { label: 'Учебная', type: 'Учебная' },
  { label: 'Общественная', type: 'Общественная' },
  { label: 'Культурно-творческая', type: 'Культурная' },
  { label: 'Спортивная', type: 'Спортивная' },
];

const DESTINATIONS = ['По месту работы', 'Банк', 'Соцзащита', 'Пенсионный фонд', 'Посольство'];
const CONTROL_POINTS = ['РК-1', 'РК-2', 'Экзамен', 'Зачёт', 'Лабораторная работа'];
const DORMS = ['Общежитие №1 (ул. Студенческая, 12)', 'Общежитие №2 (пр. Науки, 5)', 'Общежитие №3 (ул. Академическая, 8)'];

interface Achievement {
  title: string;
  date: string;
}

/** Luhn + диапазон МИР (2200–2204). */
function isMirCard(digits: string): boolean {
  if (!/^220[0-4]\d{12}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

const fmtCard = (v: string) =>
  v
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ');

const ymdToRu = (ymd: string) => (ymd ? ymd.split('-').reverse().join('.') : '');

export function RequestFormSheet({
  type,
  onClose,
  onSubmit,
  busy,
  error,
}: {
  type: RequestType | null;
  onClose: () => void;
  onSubmit: (s: RequestSubmission) => void;
  busy: boolean;
  error: string | null;
}) {
  const item = REQUEST_CATALOG.find((c) => c.type === type);
  return (
    <Sheet
      open={type !== null}
      onClose={onClose}
      size="lg"
      title={item?.title ?? ''}
      description={item ? `${item.eta} · подпись ЭЦП деканата` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="min-h-11 sm:min-h-0">
            Отмена
          </Button>
          <Button type="submit" form="request-form" loading={busy} icon={<Send size={16} strokeWidth={ICON_STROKE} />} className="min-h-11 sm:min-h-0">
            Отправить в деканат
          </Button>
        </>
      }
    >
      {type && <FormBody key={type} type={type} onSubmit={onSubmit} serverError={error} />}
    </Sheet>
  );
}

function FormBody({ type, onSubmit, serverError }: { type: RequestType; onSubmit: (s: RequestSubmission) => void; serverError: string | null }) {
  const [copies, setCopies] = useState(1);
  const [delivery, setDelivery] = useState<Delivery>('EDS');
  const [destination, setDestination] = useState('');
  const [office, setOffice] = useState('');
  const [language, setLanguage] = useState<'ru' | 'en'>('ru');
  const [basis, setBasis] = useState(AID_BASIS[3].label);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [card, setCard] = useState('');
  const [nomination, setNomination] = useState(PGAS_NOMINATIONS[0].label);
  const [achievements, setAchievements] = useState<Achievement[]>([{ title: '', date: '' }]);
  const [portfolio, setPortfolio] = useState('');
  const [subject, setSubject] = useState('');
  const [controlPoint, setControlPoint] = useState(CONTROL_POINTS[0]);
  const [retakeDate, setRetakeDate] = useState('');
  const [dorm, setDorm] = useState(DORMS[0]);
  const [room, setRoom] = useState('');
  const [passKind, setPassKind] = useState<'PERMANENT' | 'GUEST'>('PERMANENT');
  const [guest, setGuest] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const grades = useApi(type === 'RETAKE' ? '/api/grades' : null, toGrades);
  const subjects = useMemo(() => (grades.data ?? []).map((g) => g.name), [grades.data]);
  const maxCopies = type === 'MILITARY_CERTIFICATE' ? 3 : 5;
  const cardDigits = card.replace(/\D/g, '');

  function build(): RequestSubmission | string {
    const lines: string[] = [];
    const payload: Record<string, unknown> = {};
    const withDelivery = () => lines.push(`Способ получения: ${DELIVERY[delivery].title}${delivery === 'PAPER' ? ' (окно №2)' : ''}`);

    switch (type) {
      case 'STUDY_CERTIFICATE':
      case 'ACADEMIC_TRANSCRIPT':
        if (!destination.trim()) return 'Укажите место требования.';
        payload.destination = destination.trim();
        payload.copies = copies;
        if (type === 'ACADEMIC_TRANSCRIPT') payload.language = language;
        withDelivery();
        break;
      case 'MILITARY_CERTIFICATE':
        if (!office.trim()) return 'Укажите военный комиссариат.';
        payload.militaryOffice = office.trim();
        payload.copies = copies;
        lines.push('Форма: Приложение №4');
        withDelivery();
        break;
      case 'FINANCIAL_AID': {
        const b = AID_BASIS.find((x) => x.label === basis) ?? AID_BASIS[3];
        if (reason.trim().length < 10) return 'Опишите ситуацию подробнее (от 10 символов).';
        if (!isMirCard(cardDigits)) return 'Проверьте номер карты МИР: 16 цифр, начинается с 2200–2204.';
        payload.category = b.category;
        payload.reason = reason.trim();
        if (amount.trim()) {
          const n = Number(amount.replace(/\s/g, ''));
          if (!Number.isInteger(n) || n <= 0 || n > 1_000_000) return 'Сумма — целое число до 1 000 000 ₽.';
          payload.amountRequested = n;
        }
        lines.push(`Основание: ${b.label}`, `Зачисление на карту МИР •••• ${cardDigits.slice(-4)}`);
        break;
      }
      case 'PGAS': {
        const n = PGAS_NOMINATIONS.find((x) => x.label === nomination) ?? PGAS_NOMINATIONS[0];
        const list = achievements.filter((a) => a.title.trim());
        if (!list.length) return 'Добавьте хотя бы одно достижение.';
        if (portfolio.trim() && !/^https:\/\/\S+\.\S+/.test(portfolio.trim())) return 'Ссылка на портфолио должна начинаться с https://';
        payload.achievements = list.map((a) => ({ type: n.type, title: a.title.trim(), ...(a.date ? { date: a.date } : {}) }));
        lines.push(`Номинация: ${n.label}`);
        if (portfolio.trim()) lines.push(`Портфолио: ${portfolio.trim()}`);
        break;
      }
      case 'RETAKE':
        if (!subject.trim()) return 'Выберите дисциплину.';
        if (reason.trim().length < 5) return 'Укажите причину пересдачи.';
        payload.subject = subject.trim();
        payload.controlPoint = controlPoint;
        payload.reason = reason.trim();
        if (retakeDate) lines.push(`Желаемая дата: ${ymdToRu(retakeDate)}`);
        break;
      case 'DORMITORY_PASS':
        if (!room.trim()) return 'Укажите номер комнаты.';
        if (passKind === 'GUEST' && !guest.trim()) return 'Укажите ФИО гостя.';
        if (!from || !to || to < from) return 'Выберите корректный период.';
        payload.dormitory = dorm;
        payload.room = room.trim();
        payload.period = `${ymdToRu(from)} – ${ymdToRu(to)}`;
        if (passKind === 'GUEST') payload.guestName = guest.trim();
        lines.push(`Тип пропуска: ${passKind === 'GUEST' ? 'гостевой' : 'постоянный'}`);
        break;
    }
    if (note.trim()) lines.push(note.trim());
    return { type, payload, comment: lines.join('\n').slice(0, 1000) };
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const r = build();
    if (typeof r === 'string') {
      setError(r);
      return;
    }
    setError(null);
    onSubmit(r);
  }

  const showDelivery = type === 'STUDY_CERTIFICATE' || type === 'MILITARY_CERTIFICATE' || type === 'ACADEMIC_TRANSCRIPT';

  return (
    <form id="request-form" onSubmit={submit} noValidate className="space-y-4">
      {showDelivery && (
        <>
          <Field label="Способ получения">
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Способ получения">
              {(Object.keys(DELIVERY) as Delivery[]).map((d) => (
                <Choice key={d} on={delivery === d} onClick={() => setDelivery(d)} title={DELIVERY[d].title} text={DELIVERY[d].text} />
              ))}
            </div>
          </Field>
          <Field label="Количество экземпляров" hint={`1–${maxCopies}`}>
            <Stepper value={copies} min={1} max={maxCopies} onChange={setCopies} />
          </Field>
        </>
      )}

      {(type === 'STUDY_CERTIFICATE' || type === 'ACADEMIC_TRANSCRIPT') && (
        <Field label="Место требования" htmlFor="r-dest">
          <Input id="r-dest" value={destination} onChange={(e) => setDestination(e.target.value)} maxLength={200} placeholder="Например, ООО «Ромашка»" data-autofocus />
          <Chips items={type === 'ACADEMIC_TRANSCRIPT' ? ['Перевод в другой вуз', 'Стажировка', 'Магистратура'] : DESTINATIONS} value={destination} onPick={setDestination} />
        </Field>
      )}

      {type === 'ACADEMIC_TRANSCRIPT' && (
        <Field label="Язык справки">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Язык">
            <Choice on={language === 'ru'} onClick={() => setLanguage('ru')} title="Русский" />
            <Choice on={language === 'en'} onClick={() => setLanguage('en')} title="English" />
          </div>
        </Field>
      )}

      {type === 'MILITARY_CERTIFICATE' && (
        <Field label="Военный комиссариат" htmlFor="r-office">
          <Input id="r-office" value={office} onChange={(e) => setOffice(e.target.value)} maxLength={200} placeholder="Военный комиссариат Петроградского района" data-autofocus />
        </Field>
      )}

      {type === 'FINANCIAL_AID' && (
        <>
          <Field label="Основание" htmlFor="r-basis">
            <Select id="r-basis" value={basis} onChange={(e) => setBasis(e.target.value)}>
              {AID_BASIS.map((b) => (
                <option key={b.label} value={b.label}>
                  {b.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Описание ситуации" htmlFor="r-reason">
            <Textarea id="r-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="Кратко опишите обстоятельства и приложите подтверждающие документы в деканат" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Сумма, ₽" hint="Необязательно" htmlFor="r-amount">
              <Input id="r-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d\s]/g, ''))} placeholder="15 000" className="tabular-nums" />
            </Field>
            <Field label="Карта МИР для зачисления" htmlFor="r-card">
              <Input
                id="r-card"
                inputMode="numeric"
                autoComplete="off"
                value={card}
                onChange={(e) => setCard(fmtCard(e.target.value))}
                placeholder="2200 0000 0000 0000"
                aria-invalid={cardDigits.length === 16 && !isMirCard(cardDigits)}
                className="tabular-nums"
              />
            </Field>
          </div>
          <p className="flex gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
            <Lock size={14} strokeWidth={ICON_STROKE} className="mt-0.5 shrink-0" />
            В заявку уходят только последние 4 цифры карты, полный номер бухгалтерия запросит при выплате.
          </p>
        </>
      )}

      {type === 'PGAS' && (
        <>
          <Field label="Номинация">
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Номинация">
              {PGAS_NOMINATIONS.slice(0, 4).map((n) => (
                <Choice key={n.label} on={nomination === n.label} onClick={() => setNomination(n.label)} title={n.label} />
              ))}
            </div>
          </Field>
          <Field label="Достижения" hint={`${achievements.length} / 10`}>
            <ul className="space-y-2">
              {achievements.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <Input
                    value={a.title}
                    onChange={(e) => setAchievements((xs) => xs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    maxLength={300}
                    placeholder="Статья в сборнике конференции"
                    aria-label={`Достижение ${i + 1}`}
                    className="min-w-0 flex-1"
                  />
                  <div className="w-36 shrink-0 sm:w-40">
                  <Input
                    type="month"
                    value={a.date}
                    onChange={(e) => setAchievements((xs) => xs.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))}
                    aria-label={`Дата достижения ${i + 1}`}
                    className="tabular-nums"
                  />
                  </div>
                  {achievements.length > 1 && (
                    <Button
                      variant="ghost"
                      onClick={() => setAchievements((xs) => xs.filter((_, j) => j !== i))}
                      aria-label={`Удалить достижение ${i + 1}`}
                      square
                      className="shrink-0 max-sm:size-11"
                    >
                      <Trash2 size={16} strokeWidth={ICON_STROKE} />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {achievements.length < 10 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAchievements((xs) => [...xs, { title: '', date: '' }])}
                icon={<Plus size={14} strokeWidth={ICON_STROKE} />}
                className="mt-2 min-h-11 sm:min-h-9"
              >
                Добавить достижение
              </Button>
            )}
          </Field>
          <Field label="Ссылка на портфолио" hint="Необязательно · https://" htmlFor="r-portfolio">
            <Input id="r-portfolio" type="url" inputMode="url" value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="https://disk.example.ru/portfolio" />
          </Field>
        </>
      )}

      {type === 'RETAKE' && (
        <>
          <Field label="Дисциплина" htmlFor="r-subject">
            {subjects.length ? (
              <Select id="r-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">Выберите дисциплину</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            ) : (
              <Input id="r-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Базы данных" />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Контрольная точка" htmlFor="r-cp">
              <Select id="r-cp" value={controlPoint} onChange={(e) => setControlPoint(e.target.value)}>
                {CONTROL_POINTS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Желаемая дата" hint="Необязательно" htmlFor="r-date">
              <Input id="r-date" type="date" value={retakeDate} onChange={(e) => setRetakeDate(e.target.value)} className="tabular-nums" />
            </Field>
          </div>
          <Field label="Причина" htmlFor="r-reason2">
            <Textarea id="r-reason2" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="Например, болезнь в период РК (справка приложена)" />
          </Field>
        </>
      )}

      {type === 'DORMITORY_PASS' && (
        <>
          <Field label="Тип пропуска">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Тип пропуска">
              <Choice on={passKind === 'PERMANENT'} onClick={() => setPassKind('PERMANENT')} title="Постоянный" text="Для проживающих" />
              <Choice on={passKind === 'GUEST'} onClick={() => setPassKind('GUEST')} title="Гостевой" text="Для посетителя" />
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <Field label="Общежитие" htmlFor="r-dorm">
              <Select id="r-dorm" value={dorm} onChange={(e) => setDorm(e.target.value)}>
                {DORMS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </Field>
            <Field label="Комната" htmlFor="r-room">
              <Input id="r-room" value={room} onChange={(e) => setRoom(e.target.value)} maxLength={20} placeholder="412" className="tabular-nums" />
            </Field>
          </div>
          {passKind === 'GUEST' && (
            <Field label="ФИО гостя" htmlFor="r-guest">
              <Input id="r-guest" value={guest} onChange={(e) => setGuest(e.target.value)} maxLength={200} placeholder="Иванов Иван Иванович" />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="С" htmlFor="r-from">
              <Input id="r-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="tabular-nums" />
            </Field>
            <Field label="По" htmlFor="r-to">
              <Input id="r-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="tabular-nums" />
            </Field>
          </div>
        </>
      )}

      <Field label="Комментарий" hint="Необязательно" htmlFor="r-note">
        <Textarea id="r-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="min-h-16" placeholder="Что ещё важно знать деканату" />
      </Field>

      {(error || serverError) && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-950/60 dark:text-red-300">
          {error ?? serverError}
        </p>
      )}
    </form>
  );
}

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor} hint={hint}>
        {label}
      </Label>
      {children}
    </div>
  );
}

function Choice({ on, onClick, title, text }: { on: boolean; onClick: () => void; title: string; text?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'flex min-h-11 flex-col justify-center rounded-lg border px-3 py-2 text-left transition-colors',
        on
          ? 'border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-500/10'
          : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800',
      )}
    >
      <span className={cn('text-sm font-medium', on ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-zinc-50')}>{title}</span>
      {text && <span className="text-xs text-slate-500 dark:text-zinc-400">{text}</span>}
    </button>
  );
}

function Chips({ items, value, onPick }: { items: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((x) => (
        <button
          key={x}
          type="button"
          aria-pressed={value === x}
          onClick={() => onPick(x)}
          className={cn(
            'min-h-9 rounded-full border px-3 text-xs transition-colors',
            value === x
              ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900',
          )}
        >
          {x}
        </button>
      ))}
    </div>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center gap-2">
      <Button variant="secondary" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Меньше" square className="max-sm:size-11">
        <Minus size={16} strokeWidth={ICON_STROKE} />
      </Button>
      <span className="w-8 text-center text-base font-semibold text-slate-900 tabular-nums dark:text-zinc-50" aria-live="polite">
        {value}
      </span>
      <Button variant="secondary" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Больше" square className="max-sm:size-11">
        <Plus size={16} strokeWidth={ICON_STROKE} />
      </Button>
    </div>
  );
}
