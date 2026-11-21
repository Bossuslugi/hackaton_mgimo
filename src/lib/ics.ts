/**
 * Экспорт расписания недели в iCalendar (RFC 5545) — импорт в Apple / Google / Яндекс Календарь.
 * Время пар — московское (UTC+3 круглый год), в файл пишется в UTC с суффиксом Z.
 */
import { LESSON_TYPE_LABEL } from './format';
import type { Lesson } from './types';

const MSK_OFFSET_H = 3;

/** Понедельник текущей недели по Москве: [год, месяц(1–12), день]. */
function mondayMsk(now = new Date()): [number, number, number] {
  const msk = new Date(now.getTime() + MSK_OFFSET_H * 3_600_000);
  const dow = msk.getUTCDay() === 0 ? 7 : msk.getUTCDay();
  const mon = new Date(Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate() - (dow - 1)));
  return [mon.getUTCFullYear(), mon.getUTCMonth() + 1, mon.getUTCDate()];
}

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** Экранирование TEXT-значений: \ ; , и переводы строк. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Перенос строк длиннее 75 октетов (UTF-8), продолжение начинается с пробела. */
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    const limit = out.length === 0 ? 75 : 74;
    if (enc.encode(cur + ch).length > limit) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function buildIcs(lessons: Lesson[], calendarName = 'Орбита — расписание', now = new Date()): string {
  const [y, m, d] = mondayMsk(now);
  const dtstamp = stamp(now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Orbita//Digital Deanery//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calendarName)}`,
    'X-WR-TIMEZONE:Europe/Moscow',
  ];
  for (const l of lessons) {
    if (l.dayOfWeek < 1 || l.dayOfWeek > 7) continue;
    const [sh, sm] = l.startTime.split(':').map(Number);
    const [eh, em] = l.endTime.split(':').map(Number);
    if ([sh, sm, eh, em].some((n) => !Number.isFinite(n))) continue;
    const day = d + (l.dayOfWeek - 1);
    const start = new Date(Date.UTC(y, m - 1, day, sh - MSK_OFFSET_H, sm));
    const end = new Date(Date.UTC(y, m - 1, day, eh - MSK_OFFSET_H, em));
    const type = LESSON_TYPE_LABEL[l.type];
    const desc = [type, l.teacher && `Преподаватель: ${l.teacher}`, l.group && `Группа: ${l.group}`, l.isRescheduled && l.oldRoom ? `Перенос из ${l.oldRoom}` : '']
      .filter(Boolean)
      .join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${esc(`${l.id}-${stamp(start)}@orbita.edu`)}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(`${l.subject} (${type})`)}`,
      `LOCATION:${esc(l.building ? `${l.building}, ${l.room}` : l.room)}`,
      `DESCRIPTION:${esc(desc)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:-PT15M',
      `DESCRIPTION:${esc(`Через 15 минут: ${l.subject}`)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadIcs(content: string, filename = 'orbita-schedule.ics') {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
