/**
 * Генератор презентации «Орбита» в формате PowerPoint (16:9, 10 слайдов).
 *
 *   node scripts/build-pptx.mjs   →   ./Orbita_Presentation.pptx
 *
 * Дизайн — Obsidian Dark из specs/02_DESIGN_SYSTEM.md §2.6: фон #09090B, карточки #12141A
 * с рамкой #27272A, один акцент #3B82F6, текст #FAFAFA / #A1A1AA. Без градиентов и теней.
 * Иконки — lucide-react (как в приложении), растеризуются через sharp.
 * QR-код на бланке справки — настоящий, из того же генератора src/lib/qr.ts.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Lucide from 'lucide-react';
import sharp from 'sharp';
import pptxgen from 'pptxgenjs';
import JSZip from 'jszip';
import { writeFile } from 'node:fs/promises';
import { tsImport } from 'tsx/esm/api';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'deliverables', 'presentation', 'Orbita_Presentation.pptx');
const { qrMatrix } = await tsImport('../src/lib/qr.ts', import.meta.url);

// ───────────────────────── Токены Obsidian Dark

const C = {
  bg: '09090B',
  card: '12141A',
  elevated: '18181B',
  line: '27272A',
  line2: '3F3F46',
  text: 'FAFAFA',
  text2: 'A1A1AA',
  text3: '71717A',
  brand: '3B82F6',
  brandText: '60A5FA',
};
// Семантические бейджи (spec §2.6), полупрозрачные классы пересчитаны в непрозрачные цвета поверх #12141A
const BADGE = {
  brand: { fill: '131D33', line: '1E3A6B', color: '60A5FA' },
  success: { fill: '0A2A1F', line: '14532D', color: '6EE7B7' },
  warning: { fill: '2B1D0A', line: '78350F', color: 'FCD34D' },
  danger: { fill: '2D1012', line: '7F1D1D', color: 'FCA5A5' },
  neutral: { fill: '18181B', line: '27272A', color: 'A1A1AA' },
};
const FONT = 'Arial';
const MONO = 'Consolas';

const W = 13.333;
const H = 7.5;
const MX = 0.6; // поля слайда
const CW = W - MX * 2; // ширина контента

// ───────────────────────── Растровые ресурсы

const iconCache = new Map();
async function icon(name, color = C.text2) {
  const key = `${name}:${color}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const Cmp = Lucide[name];
  if (!Cmp) throw new Error(`Нет иконки lucide: ${name}`);
  const svg = renderToStaticMarkup(createElement(Cmp, { size: 256, color: `#${color}`, strokeWidth: 1.75 }));
  const png = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  const data = `image/png;base64,${png.toString('base64')}`;
  iconCache.set(key, data);
  return data;
}

async function logoPng(stroke = C.text, size = 512, dot = C.brand) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none">
    <ellipse cx="16" cy="16" rx="13.25" ry="6" transform="rotate(-32 16 16)" stroke="#${stroke}" stroke-width="1.75"/>
    <ellipse cx="16" cy="16" rx="13.25" ry="6" transform="rotate(32 16 16)" stroke="#${stroke}" stroke-width="1.75"/>
    <circle cx="16" cy="16" r="2.25" fill="#${stroke}"/>
    <circle cx="26.4" cy="8.6" r="2.6" stroke-width="1.5" fill="#${dot}" stroke="#${C.bg}"/>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `image/png;base64,${png.toString('base64')}`;
}

async function qrPng(value) {
  const m = qrMatrix(value);
  const n = m.length + 8;
  let d = '';
  m.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + 4} ${y + 4}h1v1h-1z`; }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="600" height="600" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#FFFFFF"/><path d="${d}" fill="#0F172A"/></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `image/png;base64,${png.toString('base64')}`;
}

// ───────────────────────── Презентация и макеты

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.title = 'Орбита — Цифровой деканат будущего';
pres.subject = 'Конкурсный прототип для хакатона «Цифровой деканат будущего»';
pres.author = 'Команда «Орбита»';
pres.company = 'Конкурсный прототип';
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };

const LOGO_SMALL = await logoPng(C.text2, 128);
const LOGO_BIG = await logoPng(C.text, 1024);
const LOGO_GHOST = await logoPng('1C1D23', 1400, '1E3A6B');

pres.defineSlideMaster({
  title: 'ORBITA_TITLE',
  background: { color: C.bg },
  objects: [],
});

pres.defineSlideMaster({
  title: 'ORBITA_CONTENT',
  background: { color: C.bg },
  margin: [0.5, MX, 0.6, MX],
  objects: [
    { image: { data: LOGO_SMALL, x: MX, y: 6.98, w: 0.22, h: 0.22 } },
    {
      text: {
        text: 'Орбита · Цифровой деканат будущего · конкурсный прототип',
        options: { x: MX + 0.32, y: 6.96, w: 7, h: 0.26, fontFace: FONT, fontSize: 10, color: C.text3, margin: 0, valign: 'middle' },
      },
    },
    {
      placeholder: {
        options: { name: 'eyebrow', type: 'body', x: MX, y: 0.42, w: CW, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: C.brandText, charSpacing: 2, margin: 0, valign: 'middle' },
        text: '',
      },
    },
    {
      placeholder: {
        options: { name: 'title', type: 'title', x: MX, y: 0.74, w: CW, h: 0.8, fontFace: FONT, fontSize: 32, bold: true, color: C.text, margin: 0, valign: 'top', align: 'left' },
        text: '',
      },
    },
  ],
  slideNumber: { x: W - MX - 1.2, y: 6.96, w: 1.2, h: 0.26, fontFace: FONT, fontSize: 10, color: C.text3, align: 'right' },
});

// ───────────────────────── Хелперы

let objN = 0;
const oname = (p) => `${p}-${++objN}`;

function text(slide, value, opts) {
  slide.addText(value, {
    fontFace: FONT,
    fontSize: 14,
    color: C.text2,
    margin: 0,
    valign: 'top',
    isTextBox: true,
    objectName: oname('text'),
    ...opts,
  });
}

function card(slide, x, y, w, h, { fill = C.card, line = C.line, radius = 0.12 } = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h,
    fill: { color: fill },
    line: { color: line, width: 0.75 },
    rectRadius: radius,
    objectName: oname('card'),
  });
}

/** Ширина бейджа по тексту (Arial, оценка ~0.55em на символ). */
const badgeW = (t, size = 10, bold = true) => t.length * size * (bold ? 0.0084 : 0.0076) + 0.26;

function badge(slide, t, x, y, kind = 'brand', { size = 10, h = 0.28, mono = false } = {}) {
  const b = BADGE[kind];
  const w = mono ? badgeW(t, size, false) * 1.08 : badgeW(t, size);
  slide.addText(t, {
    shape: pres.shapes.ROUNDED_RECTANGLE,
    x, y, w, h,
    rectRadius: 0.06,
    fill: { color: b.fill },
    line: { color: b.line, width: 0.75 },
    fontFace: mono ? MONO : FONT,
    fontSize: size,
    bold: !mono,
    color: b.color,
    align: 'center',
    valign: 'middle',
    margin: 0,
    objectName: oname('badge'),
  });
  return w;
}

async function iconAt(slide, name, x, y, size = 0.3, color = C.text2) {
  slide.addImage({ data: await icon(name, color), x, y, w: size, h: size, objectName: oname(`icon-${name}`) });
}

function arrow(slide, x1, y1, x2, y2, color = C.line2, { dash, width = 1.25 } = {}) {
  const flipH = x2 < x1;
  const flipV = y2 < y1;
  slide.addShape(pres.shapes.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2),
    w: Math.max(Math.abs(x2 - x1), 0.001), h: Math.max(Math.abs(y2 - y1), 0.001),
    flipH, flipV,
    line: { color, width, endArrowType: 'triangle', dashType: dash },
    objectName: oname('arrow'),
  });
}

function hline(slide, x, y, w, color = C.line) {
  slide.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color, width: 0.75 }, objectName: oname('rule') });
}

function contentSlide(section, eyebrow, title) {
  const s = pres.addSlide({ masterName: 'ORBITA_CONTENT', sectionTitle: section });
  s.addText(eyebrow.toUpperCase(), { placeholder: 'eyebrow' });
  s.addText(title, { placeholder: 'title' });
  return s;
}

/** Таблица в стиле карточки: тёмный заголовок, тонкие разделители. */
function table(slide, rows, { x, y, w, colW, fontSize = 12, rowH = 0.42, headColor = C.text3 }) {
  const border = { type: 'solid', pt: 0.75, color: C.line };
  const none = { type: 'none' };
  const data = rows.map((row, ri) =>
    row.map((cell) => {
      const base = typeof cell === 'string' ? { text: cell, options: {} } : cell;
      return {
        text: base.text,
        options: {
          fontFace: base.options.mono ? MONO : FONT,
          fontSize: ri === 0 ? 10 : fontSize,
          bold: ri === 0 || base.options.bold,
          color: ri === 0 ? headColor : base.options.color ?? C.text2,
          fill: { color: ri === 0 ? C.elevated : C.card },
          border: [ri === 0 ? none : border, none, border, none],
          margin: [0.06, 0.12, 0.06, 0.12],
          valign: 'middle',
          charSpacing: ri === 0 ? 1 : 0,
        },
      };
    }),
  );
  slide.addTable(data, { x, y, w, colW, rowH, objectName: oname('table') });
}

// ═════════════════════════ 1. Титульный

pres.addSection({ title: 'Открытие' });
{
  const s = pres.addSlide({ masterName: 'ORBITA_TITLE', sectionTitle: 'Открытие' });
  s.addImage({ data: LOGO_GHOST, x: 7.9, y: 0.9, w: 5.9, h: 5.9, objectName: 'ghost-orbit' });

  s.addImage({ data: LOGO_BIG, x: MX, y: 0.75, w: 0.62, h: 0.62, objectName: 'logo' });
  badge(s, 'Конкурс «Цифровой деканат будущего» · 2026', MX + 0.85, 0.92, 'brand', { size: 11, h: 0.3 });

  text(s, 'ОРБИТА', { x: MX, y: 1.95, w: 8, h: 1.3, fontSize: 80, bold: true, color: C.text, charSpacing: 6 });
  text(s, 'Цифровой деканат будущего', { x: MX, y: 3.2, w: 8, h: 0.6, fontSize: 30, color: C.text2 });
  text(s, 'Учёба, деканат и кампус в одном окне — с телефона, за пару касаний.', {
    x: MX, y: 3.95, w: 8.5, h: 0.5, fontSize: 16, color: C.text3,
  });

  const stats = [
    ['3', 'контура: учёба, деканат, кампус'],
    ['30', 'API-маршрутов с проверкой владельца'],
    ['13', 'моделей данных в Prisma'],
    ['360 px', 'минимальная ширина экрана'],
  ];
  const sw = 1.78;
  stats.forEach(([v, l], i) => {
    const x = MX + i * (sw + 0.2);
    text(s, v, { x, y: 4.85, w: sw, h: 0.55, fontSize: 30, bold: true, color: C.text });
    text(s, l, { x, y: 5.42, w: sw, h: 0.45, fontSize: 11, color: C.text3 });
  });

  card(s, MX, 6.3, 7.75, 0.6, { fill: C.elevated });
  await iconAt(s, 'Info', MX + 0.2, 6.46, 0.28, C.text2);
  text(s, 'Конкурсный прототип. Не является официальным сервисом вуза. Все персональные данные вымышленные.', {
    x: MX + 0.6, y: 6.3, w: 7, h: 0.6, fontSize: 11, color: C.text2, valign: 'middle',
  });

  s.addNotes('«Орбита» — концепт цифрового деканата и учебного пространства студента. Это конкурсный прототип, а не официальный сервис вуза; все люди и данные в демо-базе вымышлены.');
}

// ═════════════════════════ 2. Проблема

pres.addSection({ title: 'Проблема и решение' });
{
  const s = contentSlide('Проблема и решение', 'Проблема', 'Студенческая жизнь разложена по десятку систем');
  text(s, 'Каждая потребность живёт в своём месте, и почти ничего из этого не открывается нормально с телефона.', {
    x: MX, y: 1.6, w: 7.2, h: 0.5, fontSize: 14,
  });

  const frags = [
    ['CalendarDays', 'Расписание', 'отдельная система'],
    ['ChartColumn', 'Баллы БРС', 'другая система'],
    ['BookOpen', 'Домашние задания', 'LMS'],
    ['FileText', 'Справки', 'окошко деканата'],
    ['ArrowRightLeft', 'Переносы пар', 'чат старосты'],
    ['Wifi', 'Пароль Wi-Fi', 'старое письмо в почте'],
  ];
  const fw = 2.3, fh = 1.42, gx = 0.2, gy = 0.2;
  for (const [i, [ic, t, where]] of frags.entries()) {
    const col = i % 3, row = Math.floor(i / 3);
    const x = MX + col * (fw + gx), y = 2.35 + row * (fh + gy);
    card(s, x, y, fw, fh);
    await iconAt(s, ic, x + 0.22, y + 0.22, 0.3, C.text2);
    text(s, t, { x: x + 0.22, y: y + 0.66, w: fw - 0.44, h: 0.3, fontSize: 14, bold: true, color: C.text });
    badge(s, where, x + 0.22, y + 1.0, 'neutral', { size: 9, h: 0.25 });
  }
  text(s, '6 мест — 6 логинов, 6 интерфейсов, ни одного общего «что важно сегодня».', {
    x: MX, y: 5.75, w: 7.3, h: 0.4, fontSize: 12, color: C.text3, italic: true,
  });

  // Правая колонка — боли
  const px = 8.3, pw = W - MX - px;
  card(s, px, 1.6, pw, 4.95);
  const pains = [
    ['Smartphone', 'Студент со смартфона', 'Таблицы не влезают в 360 px, у каждой системы свой вход. Нужное приходится искать, а не открывать.'],
    ['Clock', 'Время уходит на поиск', 'Где пара? Сколько баллов не хватает до допуска? Когда дедлайн? Сколько ждать справку?'],
    ['Inbox', 'Деканат в бумагах', 'Однотипные бумажные заявки и нет быстрого способа оповестить группу о переносе аудитории.'],
  ];
  for (const [i, [ic, t, d]] of pains.entries()) {
    const y = 1.88 + i * 1.55;
    await iconAt(s, ic, px + 0.3, y + 0.02, 0.3, C.brandText);
    text(s, t, { x: px + 0.8, y, w: pw - 1.1, h: 0.34, fontSize: 15, bold: true, color: C.text });
    text(s, d, { x: px + 0.8, y: y + 0.4, w: pw - 1.1, h: 0.85, fontSize: 12, color: C.text2 });
    if (i < 2) hline(s, px + 0.3, y + 1.38, pw - 0.6);
  }
  s.addNotes('Проблема — фрагментация: расписание, БРС, ДЗ, справки и переносы живут в разных местах. Студент ищет, а не учится; деканат тонет в однотипных заявках.');
}

// ═════════════════════════ 3. Решение

{
  const s = contentSlide('Проблема и решение', 'Решение', '«Фокус дня» вместо пассивных таблиц');

  // Телефон с главным экраном
  const phx = MX + 0.1, phy = 1.62, phw = 3.0, phh = 5.08;
  card(s, phx, phy, phw, phh, { fill: C.bg, line: C.line2, radius: 0.32 });
  const ix = phx + 0.18, iw = phw - 0.36;
  text(s, 'Сводка', { x: ix, y: phy + 0.25, w: 1.5, h: 0.3, fontSize: 13, bold: true, color: C.text });
  text(s, 'чт, 26 ноября', { x: ix + 1.3, y: phy + 0.27, w: iw - 1.3, h: 0.28, fontSize: 9, color: C.text3, align: 'right' });

  let y = phy + 0.7;
  card(s, ix, y, iw, 1.12, { radius: 0.08 });
  text(s, 'СЛЕДУЮЩАЯ ПАРА · 11:40', { x: ix + 0.14, y: y + 0.12, w: iw - 0.28, h: 0.2, fontSize: 7.5, bold: true, color: C.text3, charSpacing: 1 });
  text(s, 'Алгоритмы и структуры данных', { x: ix + 0.14, y: y + 0.36, w: iw - 0.28, h: 0.26, fontSize: 10.5, bold: true, color: C.text });
  badge(s, 'Перенос', ix + 0.14, y + 0.74, 'warning', { size: 8, h: 0.22 });
  text(s, 'Ауд. 405 → Лаб. 105', { x: ix + 0.9, y: y + 0.74, w: iw - 1.0, h: 0.22, fontSize: 8.5, color: C.text2, valign: 'middle' });

  y += 1.24;
  card(s, ix, y, iw, 0.98, { radius: 0.08 });
  text(s, 'ГОРЯЩИЙ ДЕДЛАЙН', { x: ix + 0.14, y: y + 0.12, w: iw - 0.28, h: 0.2, fontSize: 7.5, bold: true, color: C.text3, charSpacing: 1 });
  text(s, 'Лабораторная №3 · Алгоритмы', { x: ix + 0.14, y: y + 0.34, w: iw - 0.28, h: 0.24, fontSize: 9.5, color: C.text });
  badge(s, '05:42:10', ix + 0.14, y + 0.64, 'danger', { size: 9, h: 0.22, mono: true });

  y += 1.1;
  const half = (iw - 0.12) / 2;
  card(s, ix, y, half, 0.92, { radius: 0.08 });
  text(s, 'СРЕДНИЙ БАЛЛ', { x: ix + 0.12, y: y + 0.12, w: half - 0.2, h: 0.2, fontSize: 7, bold: true, color: C.text3 });
  text(s, '91', { x: ix + 0.12, y: y + 0.36, w: half - 0.2, h: 0.45, fontSize: 24, bold: true, color: C.text });
  card(s, ix + half + 0.12, y, half, 0.92, { radius: 0.08 });
  text(s, 'СПРАВКА', { x: ix + half + 0.24, y: y + 0.12, w: half - 0.2, h: 0.2, fontSize: 7, bold: true, color: C.text3 });
  badge(s, 'На проверке', ix + half + 0.24, y + 0.46, 'brand', { size: 7.5, h: 0.22 });

  // Таб-бар
  hline(s, phx, phy + phh - 0.62, phw, C.line);
  const tabs = ['LayoutDashboard', 'CalendarDays', 'BookOpen', 'ChartColumn', 'FileText'];
  for (const [i, ic] of tabs.entries()) {
    await iconAt(s, ic, phx + 0.3 + i * 0.53, phy + phh - 0.45, 0.24, i === 0 ? C.brand : C.text3);
  }

  // Правая часть — контуры
  const rx = 4.35, rw = W - MX - rx;
  text(s, 'Приложение само говорит, что важно сегодня: ближайшая пара с переносом, дедлайны с обратным отсчётом, статус заявок и средний балл. Всё остальное — на расстоянии одного касания.', {
    x: rx, y: 1.62, w: rw, h: 0.8, fontSize: 14,
  });
  const contours = [
    ['GraduationCap', 'Учебный', 'Расписание с переносами, БРС и симулятор «Что если?», онлайн-задачи, методички с ИИ-квизами, кабинет преподавателя'],
    ['Stamp', 'Административный', 'Онлайн-заявки и справки с реестровым номером, очередь деканата, подпись ЭЦП, бланк с QR, массовые объявления'],
    ['Building2', 'Кампусный', 'Бронирование коворкингов, Wi-Fi и IT-доступы, Smart-пропуск, афиша мероприятий, спортсекции, мессенджер'],
  ];
  const cw3 = (rw - 0.4) / 3;
  for (const [i, [ic, t, d]] of contours.entries()) {
    const x = rx + i * (cw3 + 0.2);
    card(s, x, 2.6, cw3, 2.55);
    await iconAt(s, ic, x + 0.25, 2.85, 0.32, C.brandText);
    text(s, t, { x: x + 0.25, y: 3.35, w: cw3 - 0.5, h: 0.32, fontSize: 15, bold: true, color: C.text });
    text(s, d, { x: x + 0.25, y: 3.75, w: cw3 - 0.5, h: 1.3, fontSize: 11.5 });
  }
  card(s, rx, 5.35, rw, 1.35, { fill: C.elevated });
  await iconAt(s, 'Sparkles', rx + 0.25, 5.6, 0.3, C.brandText);
  text(s, 'Орбита Copilot — проактивный консьерж', { x: rx + 0.75, y: 5.55, w: rw - 1, h: 0.34, fontSize: 14, bold: true, color: C.text });
  text(s, 'Перед ответом сервер собирает контекст текущего пользователя из БД: Copilot знает именно ваши баллы, долги и дедлайны. Работает с любым OpenAI-совместимым LLM, а без ключа отвечает по правилам на реальных данных.', {
    x: rx + 0.75, y: 5.92, w: rw - 1, h: 0.7, fontSize: 11.5,
  });
  s.addNotes('Главный экран — «Фокус дня»: приложение само показывает, что важно сегодня. Три контура в одном окне, плюс Copilot с персональным контекстом.');
}

// ═════════════════════════ 4. Учебный трек

pres.addSection({ title: 'Продукт' });
{
  const s = contentSlide('Продукт', 'Учебный трек', 'От задания до балла в БРС — без выхода из Орбиты');
  const feats = [
    ['SquareCode', 'Онлайн-решатель задач', 'Split-View: условие слева, редактор справа (на телефоне — вкладки). Нумерация строк, JetBrains Mono, шаблон кода.'],
    ['Presentation', 'Кабинет преподавателя', 'Выдать задание в Markdown, открыть решение, поставить балл с рецензией. Балл сам попадает в БРС одной транзакцией.'],
    ['BookOpenCheck', 'Методички + ИИ-квиз', 'Встроенный ридер и «Проверь себя»: 3 вопроса, мгновенная проверка и пояснения. Работает и без LLM-ключа.'],
    ['SlidersHorizontal', 'Симулятор БРС «Что если?»', 'Ползунки «добрать N баллов» — и сразу итог, оценка, долги и судьба стипендии.'],
  ];
  const fw = 3.55, fh = 2.4;
  for (const [i, [ic, t, d]] of feats.entries()) {
    const col = i % 2, row = Math.floor(i / 2);
    const x = MX + col * (fw + 0.2), y = 1.65 + row * (fh + 0.2);
    card(s, x, y, fw, fh);
    await iconAt(s, ic, x + 0.25, y + 0.25, 0.32, C.brandText);
    text(s, t, { x: x + 0.25, y: y + 0.72, w: fw - 0.5, h: 0.34, fontSize: 15, bold: true, color: C.text });
    text(s, d, { x: x + 0.25, y: y + 1.12, w: fw - 0.5, h: 1.15, fontSize: 12 });
  }

  // Мок симулятора
  const sx = MX + 2 * fw + 0.45, sw = W - MX - sx, sy = 1.65, sh = 5.0;
  card(s, sx, sy, sw, sh);
  text(s, 'СИМУЛЯТОР «ЧТО ЕСЛИ?»', { x: sx + 0.3, y: sy + 0.28, w: sw - 0.6, h: 0.24, fontSize: 9, bold: true, color: C.text3, charSpacing: 1.5 });
  text(s, 'Математический анализ', { x: sx + 0.3, y: sy + 0.6, w: sw - 0.6, h: 0.34, fontSize: 16, bold: true, color: C.text });
  text(s, [
    { text: '42', options: { fontSize: 40, bold: true, color: C.text2 } },
    { text: '  →  ', options: { fontSize: 24, color: C.text3 } },
    { text: '62', options: { fontSize: 40, bold: true, color: C.text } },
    { text: ' / 100', options: { fontSize: 16, color: C.text3 } },
  ], { x: sx + 0.3, y: sy + 1.05, w: sw - 0.6, h: 0.75, valign: 'middle' });

  // Шкала с порогами
  const bx = sx + 0.3, bw = sw - 0.6, by = sy + 2.0;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: bx, y: by, w: bw, h: 0.12, rectRadius: 0.06, fill: { color: C.line }, line: { type: 'none' }, objectName: 'brs-track' });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: bx, y: by, w: bw * 0.62, h: 0.12, rectRadius: 0.06, fill: { color: C.brand }, line: { type: 'none' }, objectName: 'brs-fill' });
  for (const [v, label] of [[50, 'допуск 50'], [85, 'отлично 85']]) {
    const tx = bx + (bw * v) / 100;
    s.addShape(pres.shapes.LINE, { x: tx, y: by - 0.08, w: 0, h: 0.28, line: { color: C.text2, width: 1 }, objectName: oname('tick') });
    text(s, label, { x: tx - 0.6, y: by + 0.24, w: 1.2, h: 0.22, fontSize: 9, color: C.text3, align: 'center' });
  }

  const sliders = [['Лабораторные', 24, 40, '+10'], ['Рубежный контроль', 22, 40, '+10'], ['Посещаемость', 16, 20, '+0']];
  for (const [i, [label, v, max, add]] of sliders.entries()) {
    const yy = sy + 2.75 + i * 0.52;
    text(s, label, { x: bx, y: yy, w: 1.8, h: 0.22, fontSize: 10.5, color: C.text2 });
    text(s, `${v}/${max}  ${add}`, { x: bx + bw - 1.2, y: yy, w: 1.2, h: 0.22, fontSize: 10.5, color: add === '+0' ? C.text3 : C.brandText, align: 'right', fontFace: MONO });
    const ty = yy + 0.3;
    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: ty, w: bw, h: 0.05, fill: { color: C.line }, line: { type: 'none' }, objectName: oname('slider-track') });
    const f = (v / max) * bw;
    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: ty, w: f, h: 0.05, fill: { color: C.brand }, line: { type: 'none' }, objectName: oname('slider-fill') });
    s.addShape(pres.shapes.OVAL, { x: bx + f - 0.08, y: ty - 0.055, w: 0.16, h: 0.16, fill: { color: C.elevated }, line: { color: C.brand, width: 1.25 }, objectName: oname('slider-thumb') });
  }
  const by2 = sy + 4.4;
  let bxx = bx;
  bxx += badge(s, 'Допуск получен', bxx, by2, 'success', { size: 9.5 }) + 0.1;
  badge(s, 'Удовлетворительно', bxx, by2, 'neutral', { size: 9.5 });
  s.addNotes('Учебный трек: задача решается прямо на сайте, преподаватель ставит балл — он сразу в БРС. Симулятор показывает конкретное число: «не хватает 8 до допуска». Пороги: допуск 50, отлично 85.');
}

// ═════════════════════════ 5. Документооборот

{
  const s = contentSlide('Продукт', 'Цифровой документооборот', 'Справка с ЭЦП и QR-кодом за 2 касания');

  // Двусторонний контур
  const lx = MX, lw = 7.7;
  card(s, lx, 1.62, lw, 2.15);
  text(s, 'СТУДЕНТ', { x: lx + 0.3, y: 1.82, w: 1.4, h: 0.22, fontSize: 9, bold: true, color: C.text3, charSpacing: 1.5 });
  text(s, 'ДЕКАНАТ', { x: lx + 0.3, y: 2.92, w: 1.4, h: 0.22, fontSize: 9, bold: true, color: C.text3, charSpacing: 1.5 });
  hline(s, lx + 0.3, 2.72, lw - 0.6);
  const node = (t, x, y, w, kind = 'neutral') => {
    const b = BADGE[kind];
    s.addText(t, {
      shape: pres.shapes.ROUNDED_RECTANGLE, x, y, w, h: 0.44, rectRadius: 0.08,
      fill: { color: b.fill }, line: { color: b.line, width: 0.75 },
      fontFace: FONT, fontSize: 11, bold: true, color: kind === 'neutral' ? C.text : b.color,
      align: 'center', valign: 'middle', margin: 0, objectName: oname('flow-node'),
    });
  };
  const n1x = lx + 1.6;
  node('1 · Выбрать тип', n1x, 2.1, 1.75);
  node('2 · Отправить', n1x + 2.15, 2.1, 1.6);
  node('Справка с QR', n1x + 4.2, 2.1, 1.65, 'success');
  arrow(s, n1x + 1.75, 2.32, n1x + 2.13, 2.32);
  node('Проверка', n1x + 2.15, 3.15, 1.6);
  node('Подписать ЭЦП', n1x + 4.2, 3.15, 1.65, 'brand');
  arrow(s, n1x + 2.95, 2.54, n1x + 2.95, 3.13);
  arrow(s, n1x + 3.75, 3.37, n1x + 4.18, 3.37);
  arrow(s, n1x + 5.02, 3.13, n1x + 5.02, 2.56, C.brand);

  // Жизненный цикл
  let x = lx;
  const ly = 3.98;
  text(s, 'Жизненный цикл', { x, y: ly + 0.03, w: 1.5, h: 0.24, fontSize: 10.5, color: C.text3 });
  x += 1.5;
  for (const [t, k, last] of [['NEW', 'neutral'], ['IN_REVIEW', 'warning'], ['APPROVED', 'success'], ['REJECTED + комментарий', 'danger', true]]) {
    const w = badge(s, t, x, ly, k, { size: 9.5, mono: true });
    x += w + (last ? 0 : 0.12);
    if (!last) { text(s, t === 'APPROVED' ? '|' : '→', { x, y: ly, w: 0.2, h: 0.28, fontSize: 11, color: C.text3, valign: 'middle', align: 'center' }); x += 0.32; }
  }

  // Было / Стало
  table(s, [
    ['', 'БЫЛО', 'СТАЛО В ОРБИТЕ'],
    [{ text: 'Подача', options: { bold: true, color: C.text } }, 'Заявление в окошке', '7 типов заявок онлайн с динамическими полями'],
    [{ text: 'Статус', options: { bold: true, color: C.text } }, '«Зайдите через неделю»', 'Степпер статусов и номер ОРБ-2026-NNNN'],
    [{ text: 'Подпись', options: { bold: true, color: C.text } }, 'Живая подпись и печать', '«Одобрить и подписать ЭЦП» в один клик'],
    [{ text: 'Проверка', options: { bold: true, color: C.text } }, 'Звонок в деканат', 'QR-код проверки на печатном бланке'],
  ], { x: lx, y: 4.5, w: lw, colW: [1.2, 2.45, 4.05], fontSize: 11.5, rowH: 0.42 });

  // Бланк справки (всегда светлый, как в приложении)
  const px = 8.75, pw = W - MX - px, py = 1.62, ph = 5.08;
  card(s, px, py, pw, ph, { fill: 'FFFFFF', line: 'E2E8F0', radius: 0.1 });
  text(s, 'СПРАВКА ОБ ОБУЧЕНИИ', { x: px + 0.3, y: py + 0.3, w: pw - 0.6, h: 0.26, fontSize: 11, bold: true, color: '0F172A', charSpacing: 1 });
  text(s, '№ ОРБ-2026-0042', { x: px + 0.3, y: py + 0.6, w: pw - 0.6, h: 0.24, fontSize: 10.5, color: '475569', fontFace: MONO });
  s.addShape(pres.shapes.LINE, { x: px + 0.3, y: py + 1.0, w: pw - 0.6, h: 0, line: { color: 'E2E8F0', width: 0.75 }, objectName: 'cert-rule' });
  text(s, 'Дана Соколову Алексею Дмитриевичу в том, что он действительно обучается на 2 курсе, группа М3203, форма обучения — очная, бюджет.', {
    x: px + 0.3, y: py + 1.15, w: pw - 0.6, h: 1.1, fontSize: 10.5, color: '334155',
  });
  s.addImage({ data: await qrPng('https://orbita.example/verify/ОРБ-2026-0042'), x: px + 0.3, y: py + 2.35, w: 1.45, h: 1.45, objectName: 'cert-qr' });
  text(s, 'Сканируйте, чтобы проверить подлинность', { x: px + 1.9, y: py + 2.55, w: pw - 2.2, h: 0.65, fontSize: 9.5, color: '64748B' });
  s.addText('Подписано ЭЦП', {
    shape: pres.shapes.ROUNDED_RECTANGLE, x: px + 1.9, y: py + 3.3, w: 1.3, h: 0.28, rectRadius: 0.06,
    fill: { color: 'ECFDF5' }, line: { color: 'A7F3D0', width: 0.75 }, fontFace: FONT, fontSize: 9.5, bold: true, color: '047857',
    align: 'center', valign: 'middle', margin: 0, objectName: 'cert-badge',
  });
  text(s, 'Данные вымышлены · демо-бланк', { x: px + 0.3, y: py + ph - 0.5, w: pw - 0.6, h: 0.24, fontSize: 9, color: '94A3B8' });

  s.addNotes('Студент выбирает тип и отправляет — два касания. Сотрудник деканата видит очередь, одобряет и подписывает ЭЦП, отказ возможен только с комментарием. На бланке — настоящий сканируемый QR.');
}

// ═════════════════════════ 6. Кампус 360°

{
  const s = contentSlide('Продукт', 'Кампус 360°', 'Весь кампус в одном хабе');
  const tiles = [
    ['Armchair', 'Коворкинги и аудитории', '5 пространств, слоты совпадают с парами. Двойная бронь невозможна даже при одновременных запросах.', '409 Conflict'],
    ['Wifi', 'Генератор Wi-Fi паролей', 'Сеть Orbita-Edu-5G: показать, скопировать, сгенерировать новый одной кнопкой. Без похожих символов 0/O, 1/I/L.', 'crypto.randomInt · ~59 бит'],
    ['Ticket', 'Афиша мероприятий', 'Хакатоны, митапы, карьера, наука, клубы. Запись в 1 клик, счётчик мест меняется атомарно.', 'EVT-2026-XXXX'],
    ['Dumbbell', 'Спортивные секции', 'Трекер зачёта по физкультуре и каталог секций. Переход между секциями — одной транзакцией.', '16 / 20 занятий'],
    ['MessagesSquare', 'Мессенджер', 'Одногруппники, преподаватели и деканат. Шаблоны, счётчик непрочитанных, кнопка «Написать преподавателю» прямо из ДЗ.', 'Optimistic UI'],
    ['ScanLine', 'Smart-пропуск', 'QR-токен обновляется каждые 30 секунд, «живые» часы отличают пропуск от скриншота.', 'QR · 30 с'],
  ];
  const tw = (CW - 0.4) / 3, th = 2.42;
  for (const [i, [ic, t, d, tag]] of tiles.entries()) {
    const col = i % 3, row = Math.floor(i / 3);
    const x = MX + col * (tw + 0.2), y = 1.65 + row * (th + 0.2);
    card(s, x, y, tw, th);
    await iconAt(s, ic, x + 0.28, y + 0.28, 0.32, C.brandText);
    badge(s, tag, x + tw - 0.28 - badgeW(tag, 9, false) * 1.08, y + 0.3, 'neutral', { size: 9, mono: true });
    text(s, t, { x: x + 0.28, y: y + 0.78, w: tw - 0.56, h: 0.34, fontSize: 15, bold: true, color: C.text });
    text(s, d, { x: x + 0.28, y: y + 1.18, w: tw - 0.56, h: 1.1, fontSize: 12 });
  }
  s.addNotes('Хаб «Кампус и Сервисы»: бронь без двойных записей (уникальный индекс → 409), криптостойкий генератор Wi-Fi пароля, афиша, физкультура, мессенджер и динамический Smart-пропуск.');
}

// ═════════════════════════ 7. Дизайн и Mobile-First

pres.addSection({ title: 'Качество' });
{
  const s = contentSlide('Качество', 'Дизайн и Mobile-First', 'Obsidian Dark: спокойно, плотно, точно');

  // Палитра
  const sw = [
    [C.bg, 'Фон', '#09090B'],
    [C.card, 'Карточка', '#12141A'],
    [C.line, 'Рамка', '#27272A'],
    [C.brand, 'Акцент', '#3B82F6'],
    [C.text, 'Текст', '#FAFAFA'],
    [C.text2, 'Вторичный', '#A1A1AA'],
  ];
  const swW = 1.12;
  for (const [i, [col, name, hex]] of sw.entries()) {
    const x = MX + i * (swW + 0.15);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.65, w: swW, h: 0.8, rectRadius: 0.1, fill: { color: col }, line: { color: C.line2, width: 0.75 }, objectName: oname('swatch') });
    text(s, name, { x, y: 2.55, w: swW, h: 0.24, fontSize: 11, bold: true, color: C.text });
    text(s, hex, { x, y: 2.8, w: swW, h: 0.22, fontSize: 10, color: C.text3, fontFace: MONO });
  }

  // Анти-вайбкод правила
  table(s, [
    ['ЗАПРЕЩЕНО', 'ВМЕСТО ЭТОГО'],
    ['Неоновые и радужные градиенты, glow-пятна', 'Плоские поверхности и один акцент #3B82F6'],
    ['Тяжёлые тени shadow-lg / xl / 2xl', 'Глубина через контраст фона и рамку 1 px'],
    ['Пропорциональные цифры в данных', 'tabular-nums на баллах, таймерах, датах'],
    ['Эмодзи и цветные подложки у иконок', 'lucide-react, штрих 1.75, currentColor'],
    ['Горизонтальный скролл на 360 px', 'Таблицы → карточки, min-w-0, overflow-x-hidden'],
  ], { x: MX, y: 3.3, w: 7.5, colW: [3.5, 4.0], fontSize: 11.5, rowH: 0.48 });

  // Телефон 360 px
  const phx = 8.75, phy = 1.65, phw = 2.25, phh = 4.95;
  card(s, phx, phy, phw, phh, { fill: C.bg, line: C.line2, radius: 0.28 });
  card(s, phx + 0.15, phy + 0.18, phw - 0.3, 0.38, { fill: C.card, radius: 0.06 });
  text(s, 'Шапка · стекло', { x: phx + 0.15, y: phy + 0.18, w: phw - 0.3, h: 0.38, fontSize: 8.5, color: C.text3, align: 'center', valign: 'middle' });
  for (let i = 0; i < 4; i++) card(s, phx + 0.15, phy + 0.72 + i * 0.85, phw - 0.3, 0.72, { radius: 0.06 });
  hline(s, phx, phy + phh - 0.55, phw, C.line);
  for (let i = 0; i < 5; i++) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: phx + 0.18 + i * 0.39, y: phy + phh - 0.42, w: 0.3, h: 0.3, rectRadius: 0.06, fill: { color: i === 0 ? '131D33' : C.card }, line: { color: i === 0 ? '1E3A6B' : C.line, width: 0.5 }, objectName: oname('tab') });
  }
  // Размерная линия
  const dy = phy + phh + 0.12;
  s.addShape(pres.shapes.LINE, { x: phx, y: dy, w: phw, h: 0, line: { color: C.brand, width: 1, beginArrowType: 'triangle', endArrowType: 'triangle' }, objectName: 'dim-360' });
  text(s, '360 px', { x: phx, y: dy + 0.05, w: phw, h: 0.24, fontSize: 10, bold: true, color: C.brandText, align: 'center', fontFace: MONO });

  // Метрики справа
  const mx = 11.3;
  const metrics = [['44×44', 'тач-зоны на мобильном'], ['60 FPS', 'анимации только transform и opacity'], ['5', 'разделов в нижнем таб-баре'], ['0 мс', 'мигания темы при загрузке']];
  for (const [i, [v, l]] of metrics.entries()) {
    const y = 1.65 + i * 1.25;
    text(s, v, { x: mx, y, w: W - MX - mx, h: 0.5, fontSize: 24, bold: true, color: C.text });
    text(s, l, { x: mx, y: y + 0.52, w: W - MX - mx, h: 0.5, fontSize: 10.5, color: C.text3 });
  }
  s.addNotes('Дизайн-система Obsidian Dark: один акцент, никаких неоновых градиентов и тяжёлых теней, tabular-nums на цифрах. Mobile-first от 360 px: нижний таб-бар, тач-зоны 44×44, стекло только на оверлеях.');
}

// ═════════════════════════ 8. Безопасность

{
  const s = contentSlide('Качество', 'Безопасность · AppSec', 'Чужая заявка недоступна даже по прямой ссылке');

  // Диаграмма IDOR
  const dx = MX, dw = 5.4;
  card(s, dx, 1.65, dw, 5.0);
  text(s, 'ПУТЬ ЗАПРОСА', { x: dx + 0.3, y: 1.88, w: 3, h: 0.22, fontSize: 9, bold: true, color: C.text3, charSpacing: 1.5 });
  const steps = [
    ['Monitor', 'GET /api/requests/99999', 'Студент подставляет чужой id', true],
    ['Cookie', 'middleware.ts', 'JWT из HttpOnly-cookie, сверка Origin'],
    ['KeyRound', 'session.ts', 'userId и role — только из токена'],
    ['ShieldCheck', 'Проверка владельца', 'Чужой и несуществующий id — одинаково'],
  ];
  for (const [i, [ic, t, d, mono]] of steps.entries()) {
    const y = 2.25 + i * 0.82;
    card(s, dx + 0.3, y, dw - 0.6, 0.62, { fill: C.elevated, radius: 0.08 });
    await iconAt(s, ic, dx + 0.48, y + 0.17, 0.28, C.text2);
    text(s, t, { x: dx + 0.92, y: y + 0.08, w: dw - 1.4, h: 0.24, fontSize: 11.5, bold: true, color: C.text, fontFace: mono ? MONO : FONT });
    text(s, d, { x: dx + 0.92, y: y + 0.33, w: dw - 1.4, h: 0.22, fontSize: 10, color: C.text3 });
    arrow(s, dx + dw / 2, y + 0.63, dx + dw / 2, y + 0.81);
  }
  const ry = 2.25 + 4 * 0.82;
  s.addText([
    { text: '403 Forbidden', options: { bold: true, fontFace: MONO, fontSize: 14 } },
    { text: '   + запись [security] IDOR blocked', options: { fontSize: 10, color: 'FCA5A5' } },
  ], {
    shape: pres.shapes.ROUNDED_RECTANGLE, x: dx + 0.3, y: ry, w: dw - 0.6, h: 0.55, rectRadius: 0.08,
    fill: { color: BADGE.danger.fill }, line: { color: BADGE.danger.line, width: 0.75 }, color: BADGE.danger.color,
    fontFace: FONT, align: 'center', valign: 'middle', margin: 0, objectName: 'idor-403',
  });

  // Таблица защит
  const tx = dx + dw + 0.3, tw = W - MX - tx;
  table(s, [
    ['УГРОЗА', 'ЗАЩИТА'],
    [{ text: 'IDOR', options: { bold: true, color: C.text } }, 'Владелец проверяется на каждом ресурсе, ответ 403'],
    [{ text: 'Кража сессии (XSS)', options: { bold: true, color: C.text } }, 'JWT HS256 в cookie HttpOnly · SameSite=Lax · Secure'],
    [{ text: 'Утечка паролей', options: { bold: true, color: C.text } }, 'bcrypt cost 10, защита от тайминг-атаки'],
    [{ text: 'Перебор паролей', options: { bold: true, color: C.text } }, '5 попыток на «IP + email» за 15 минут → 429'],
    [{ text: 'CSRF', options: { bold: true, color: C.text } }, 'SameSite=Lax и сверка Origin с Host'],
    [{ text: 'Утечка секретов', options: { bold: true, color: C.text } }, 'JWT_SECRET и AI_API_KEY только на сервере'],
  ], { x: tx, y: 1.65, w: tw, colW: [2.15, tw - 2.15], fontSize: 11.5, rowH: 0.47 });

  card(s, tx, 5.25, tw, 1.4, { fill: C.elevated });
  await iconAt(s, 'MapPin', tx + 0.28, 5.5, 0.3, C.brandText);
  text(s, 'Автономность в РФ без VPN', { x: tx + 0.78, y: 5.45, w: tw - 1.1, h: 0.34, fontSize: 14, bold: true, color: C.text });
  text(s, 'База — файл SQLite, внешних сервисов нет. Copilot и ИИ-квизы работают и без LLM-ключа. Жюри может проверить IDOR-тест прямо в профиле студента.', {
    x: tx + 0.78, y: 5.82, w: tw - 1.1, h: 0.75, fontSize: 11.5,
  });
  s.addNotes('Главная угроза для цифрового деканата — IDOR. userId берётся только из HttpOnly-токена, чужой и несуществующий id дают одинаковый 403, поэтому перебором нельзя узнать, какие заявки существуют.');
}

// ═════════════════════════ 9. SDD

pres.addSection({ title: 'Процесс' });
{
  const s = contentSlide('Процесс', 'Масштаб ИИ-разработки · Spec-Driven Development', 'Сначала контракт, потом код');

  // Колонка спецификаций
  const c1x = MX, c1w = 3.0;
  text(s, '1 · КОНТРАКТЫ /specs', { x: c1x, y: 1.65, w: c1w, h: 0.24, fontSize: 9, bold: true, color: C.text3, charSpacing: 1.5 });
  const specs = [['01_PRODUCT_PRD', 'роли, пороги БРС, сценарии'], ['02_DESIGN_SYSTEM', 'токены, анти-вайбкод, 360 px'], ['03_DATA_AND_SECURITY', 'модели, матрица доступа'], ['04_API_CONTRACT', 'запросы, ответы, ошибки']];
  for (const [i, [t, d]] of specs.entries()) {
    const y = 2.0 + i * 0.86;
    card(s, c1x, y, c1w, 0.72, { radius: 0.08 });
    text(s, `${t}.md`, { x: c1x + 0.2, y: y + 0.1, w: c1w - 0.4, h: 0.26, fontSize: 10.5, bold: true, color: C.text, fontFace: MONO });
    text(s, d, { x: c1x + 0.2, y: y + 0.4, w: c1w - 0.4, h: 0.22, fontSize: 10, color: C.text3 });
  }

  // Параллельные потоки
  const c2x = c1x + c1w + 0.55, c2w = 4.5;
  text(s, '2 · ПАРАЛЛЕЛЬНЫЕ СУБАГЕНТЫ', { x: c2x, y: 1.65, w: c2w, h: 0.24, fontSize: 9, bold: true, color: C.text3, charSpacing: 1.5 });
  const streams = [
    ['Server', 'Stream A · Backend & Security', ['Prisma + seed', '/api + zod', 'JWT · bcrypt · IDOR']],
    ['Palette', 'Stream B · Design & Frontend', ['UI-кит', 'Экраны + Copilot', 'normalize + моки']],
  ];
  for (const [i, [ic, t, chain]] of streams.entries()) {
    const y = 2.0 + i * 1.74;
    card(s, c2x, y, c2w, 1.58);
    await iconAt(s, ic, c2x + 0.22, y + 0.2, 0.26, C.brandText);
    text(s, t, { x: c2x + 0.6, y: y + 0.2, w: c2w - 0.8, h: 0.28, fontSize: 12, bold: true, color: C.text });
    const chipW = (c2w - 0.44 - 0.4) / 3;
    chain.forEach((c, j) => {
      const x = c2x + 0.22 + j * (chipW + 0.2);
      s.addText(c, {
        shape: pres.shapes.ROUNDED_RECTANGLE, x, y: y + 0.72, w: chipW, h: 0.55, rectRadius: 0.06,
        fill: { color: C.elevated }, line: { color: C.line, width: 0.75 }, fontFace: FONT, fontSize: 9.5, color: C.text2,
        align: 'center', valign: 'middle', margin: 0.04, objectName: oname('chip'),
      });
      if (j < 2) arrow(s, x + chipW + 0.02, y + 1.0, x + chipW + 0.18, y + 1.0);
    });
  }
  // Связи spec → потоки
  arrow(s, c1x + c1w + 0.05, 2.79, c2x - 0.05, 2.79);
  arrow(s, c1x + c1w + 0.05, 4.53, c2x - 0.05, 4.53);

  // Аудит
  const c3x = c2x + c2w + 0.55, c3w = W - MX - c3x;
  text(s, '3 · ДВОЙНОЙ ИИ-АУДИТ', { x: c3x, y: 1.65, w: c3w, h: 0.24, fontSize: 9, bold: true, color: C.text3, charSpacing: 1.5 });
  card(s, c3x, 2.0, c3w, 3.32);
  const audit = [['ScanSearch', 'Сверка кода со спеками'], ['Bug', 'Поиск рассинхронов и уязвимостей'], ['FilePen', 'Исправление в коде и в спеке']];
  for (const [i, [ic, t]] of audit.entries()) {
    const y = 2.25 + i * 0.95;
    await iconAt(s, ic, c3x + 0.25, y, 0.28, C.text2);
    text(s, t, { x: c3x + 0.68, y: y - 0.02, w: c3w - 0.9, h: 0.55, fontSize: 11.5, color: C.text });
    if (i < 2) arrow(s, c3x + 0.39, y + 0.38, c3x + 0.39, y + 0.85);
  }
  arrow(s, c2x + c2w + 0.05, 3.66, c3x - 0.05, 3.66);

  let rbx = c3x + 0.25;
  for (const r of ['REVIEW_REPORT.md', 'REVIEW_REPORT_V2.md']) { badge(s, r, rbx, 4.82, 'neutral', { size: 8.5, mono: true }); rbx += badgeW(r, 8.5, false) * 1.08 + 0.1; }

  // Петля версий
  const vy = 5.7;
  card(s, MX, vy, CW, 0.95, { fill: C.elevated });
  text(s, 'Петля версий', { x: MX + 0.25, y: vy, w: 1.2, h: 0.95, fontSize: 11, color: C.text3, valign: 'middle' });
  const vers = [['V1', 'Вход, «Фокус дня», БРС, заявки с QR, Copilot, IDOR'], ['V2', 'Роль TEACHER, онлайн-ДЗ, мессенджер, бронирование'], ['V3', 'Кампус, афиша, ⌘K, .ics, ИИ-квиз, Optimistic UI']];
  const vw = (CW - 1.5) / 3;
  vers.forEach(([v, d], i) => {
    const x = MX + 1.35 + i * vw;
    badge(s, v, x, vy + 0.33, 'brand', { size: 10, mono: true });
    text(s, d, { x: x + 0.55, y: vy + 0.18, w: vw - 0.7, h: 0.6, fontSize: 10.5, color: C.text2, valign: 'middle' });
  });
  s.addNotes('Spec-Driven Development: четыре контракта в /specs — единственный источник истины для людей и агентов. Два субагента работали параллельно с непересекающимися зонами файлов, затем независимый агент-ревьюер сверял код со спеками. V2 и V3 только добавляют.');
}

// ═════════════════════════ 10. Итоги

pres.addSection({ title: 'Итоги' });
{
  const s = contentSlide('Итоги', 'Итоги', 'Готово к проверке: одна команда и пять аккаунтов');

  const stack = ['Next.js 15', 'React 19', 'TypeScript', 'Tailwind CSS v4', 'Prisma + SQLite', 'jose (JWT)', 'bcryptjs', 'zod'];
  let x = MX;
  for (const t of stack) x += badge(s, t, x, 1.65, 'neutral', { size: 10.5, h: 0.32 }) + 0.12;

  // Docker
  const dw = 4.1;
  card(s, MX, 2.25, dw, 2.1, { fill: C.elevated });
  await iconAt(s, 'Container', MX + 0.25, 2.47, 0.28, C.brandText);
  text(s, 'Docker-деплой', { x: MX + 0.65, y: 2.47, w: dw - 0.9, h: 0.3, fontSize: 13, bold: true, color: C.text });
  card(s, MX + 0.25, 2.95, dw - 0.5, 0.5, { fill: C.bg, radius: 0.06 });
  text(s, '$ docker compose up --build -d', { x: MX + 0.4, y: 2.95, w: dw - 0.8, h: 0.5, fontSize: 11, color: C.text, fontFace: MONO, valign: 'middle' });
  text(s, 'Сборка, схема БД, демо-данные и запуск на localhost:3000. База сохраняется в томе.', { x: MX + 0.25, y: 3.58, w: dw - 0.5, h: 0.65, fontSize: 11 });

  card(s, MX, 4.5, dw, 2.15);
  await iconAt(s, 'Zap', MX + 0.25, 4.72, 0.28, C.brandText);
  text(s, 'Быстрый вход для жюри', { x: MX + 0.65, y: 4.72, w: dw - 0.9, h: 0.3, fontSize: 13, bold: true, color: C.text });
  text(s, 'На странице /login — вход в один клик для первых четырёх аккаунтов. Пятый — через форму. Стенд сбрасывается командой npm run db:setup. Все аккаунты и данные вымышлены.', {
    x: MX + 0.25, y: 5.15, w: dw - 0.5, h: 1.3, fontSize: 11,
  });

  // Аккаунты
  const tx = MX + dw + 0.3, tw = W - MX - tx;
  const role = (t, k) => ({ text: t, options: { bold: true, color: BADGE[k].color } });
  const mono = (t) => ({ text: t, options: { mono: true, color: C.text } });
  table(s, [
    ['РОЛЬ', 'ЛОГИН', 'ПАРОЛЬ', 'ЧТО ПРОВЕРИТЬ'],
    [role('Студент · отличник', 'brand'), mono('alexey.sokolov@edu.orbita.ru'), mono('Student2026!'), '«Фокус дня», симулятор, решатель, Wi-Fi, IDOR-тест'],
    [role('Студент · риск', 'warning'), mono('maria.kuznetsova@edu.orbita.ru'), mono('Student2026!'), '42 балла и «не хватает 8 до допуска»'],
    [role('Деканат', 'success'), mono('dekanat@edu.orbita.ru'), mono('Admin2026!'), 'Одобрить и подписать ЭЦП, перенос аудитории'],
    [role('Преподаватель', 'brand'), mono('volkov.igor@edu.orbita.ru'), mono('Teacher2026!'), 'Выдать задачу, оценить — балл в БРС'],
    [role('Одногруппник', 'neutral'), mono('dmitry.orlov@edu.orbita.ru'), mono('Student2026!'), 'Чужой слот брони → 409'],
  ], { x: tx, y: 2.25, w: tw, colW: [1.6, 2.75, 1.3, tw - 5.65], fontSize: 10, rowH: 0.66 });

  s.addNotes('Итоги: стек, деплой одной командой docker compose и пять демо-аккаунтов. Первые четыре доступны кнопками быстрого входа на /login.');
}

// pptxgenjs (JSZip) пишет в архив записи-папки — облачные хранилища на них спотыкаются, убираем.
const raw = await pres.write({ outputType: 'nodebuffer' });
const src = await JSZip.loadAsync(raw);
const clean = new JSZip();
for (const [name, entry] of Object.entries(src.files)) {
  // zip.remove(папка) удалил бы и её содержимое — поэтому копируем только файлы, без создания папок
  if (!entry.dir) clean.file(name, await entry.async('nodebuffer'), { createFolders: false });
}
await writeFile(OUT, await clean.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log(`✓ ${path.relative(ROOT, OUT)} — ${pres.slides?.length ?? 10} слайдов`);
