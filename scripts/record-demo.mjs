#!/usr/bin/env node
/**
 * Автозапись видео-демо прототипа «Орбита» (Playwright + Chromium).
 *
 *   node scripts/record-demo.mjs            — полный цикл: сиды → сервер → запись → Orbita_Demo.webm (+ .mp4)
 *   node scripts/record-demo.mjs --no-seed  — не пересоздавать демо-данные
 *   node scripts/record-demo.mjs --headed   — показать окно браузера во время записи
 *
 * Если на http://localhost:3000 уже отвечает сервер — используется он. Иначе скрипт сам
 * поднимает `next start` (при наличии production-сборки) или `next dev` и гасит его по завершении.
 * Для конвертации в MP4 используется системный ffmpeg, а если его нет — пакет ffmpeg-static.
 */
import { chromium } from 'playwright';
import { spawn, spawnSync, execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.DEMO_BASE_URL ?? 'http://localhost:3000';
const RAW_DIR = path.join(ROOT, 'demo-raw');
const OUT_WEBM = path.join(ROOT, 'Orbita_Demo.webm');
const OUT_MP4 = path.join(ROOT, 'Orbita_Demo.mp4');
const ARGS = new Set(process.argv.slice(2));
const IS_WIN = process.platform === 'win32';
const VIDEO = { width: 1440, height: 900 };
// тот же SQLite-файл, что и в .env.example (путь относительно prisma/schema.prisma)
process.env.DATABASE_URL ??= 'file:./dev.db';

const log = (...a) => console.log('[demo]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────────────────────────── окружение

function run(cmd) {
  log('$', cmd);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', env: process.env });
}

async function isUp() {
  try {
    const r = await fetch(`${BASE}/login`, { redirect: 'manual' });
    return r.status < 500;
  } catch {
    return false;
  }
}

/**
 * Подготовка сидов под сценарий: в базовых сидах Алексей уже записан на хакатон,
 * а в ролике запись должна произойти в кадре — снимаем её (и счётчик мест).
 */
async function prepareDemoData() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email: 'alexey.sokolov@edu.orbita.ru' } });
    const ev = await prisma.campusEvent.findFirst({ where: { title: { startsWith: 'Хакатон цифровых' } } });
    if (!user || !ev) return;
    const { count } = await prisma.eventRegistration.deleteMany({ where: { userId: user.id, eventId: ev.id } });
    if (count) await prisma.campusEvent.update({ where: { id: ev.id }, data: { registeredCount: { decrement: count } } });
    log('сиды подготовлены к сценарию');
  } finally {
    await prisma.$disconnect();
  }
}

let server = null;

async function ensureServer() {
  if (await isUp()) {
    log(`сервер уже запущен: ${BASE}`);
    return;
  }
  const prod = fs.existsSync(path.join(ROOT, '.next', 'BUILD_ID'));
  const mode = prod ? 'start' : 'dev';
  log(`поднимаю next ${mode}…`);
  server = spawn('npx', ['next', mode, '-p', new URL(BASE).port || '3000'], {
    cwd: ROOT,
    shell: IS_WIN,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      // секрет только для локальной записи; cookie без Secure, т.к. стенд работает по http
      JWT_SECRET: process.env.JWT_SECRET ?? randomBytes(32).toString('hex'),
      COOKIE_SECURE: '0',
    },
  });
  server.stdout.on('data', (d) => process.env.DEMO_VERBOSE && process.stdout.write(d));
  server.stderr.on('data', (d) => process.stderr.write(d));
  for (let i = 0; i < 180; i++) {
    if (await isUp()) {
      // прогрев страниц, чтобы в кадр не попала компиляция dev-сервера
      for (const p of ['/login', '/', '/schedule', '/grades', '/study', '/campus', '/messages', '/requests', '/profile']) {
        await fetch(BASE + p).catch(() => {});
      }
      log('сервер готов');
      return;
    }
    await sleep(1000);
  }
  throw new Error('сервер не поднялся за 3 минуты');
}

function stopServer() {
  if (!server || server.exitCode !== null) return;
  log('останавливаю сервер');
  if (IS_WIN) spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  else server.kill('SIGTERM');
}

// ───────────────────────────── оверлеи: титры и курсор

/** Видимый курсор (в headless-записи системного курсора нет) + стили титров. */
const OVERLAY_INIT = () => {
  const install = () => {
    if (document.getElementById('__demo-style')) return;
    const st = document.createElement('style');
    st.id = '__demo-style';
    st.textContent = `
      #__demo-cursor{position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
        background:rgba(244,244,245,.18);border:2px solid rgba(244,244,245,.9);box-shadow:0 1px 6px rgba(0,0,0,.45);
        pointer-events:none;z-index:2147483647;transition:transform .12s ease,background .12s ease}
      #__demo-cursor.down{transform:scale(.7);background:rgba(37,99,235,.55)}
      #__demo-caption{position:fixed;left:50%;bottom:28px;transform:translate(-50%,12px);opacity:0;
        width:min(880px,calc(100vw - 24px));box-sizing:border-box;padding:16px 22px;border-radius:16px;
        background:rgba(12,13,17,.74);-webkit-backdrop-filter:blur(12px) saturate(140%);backdrop-filter:blur(12px) saturate(140%);
        border:1px solid #27272a;box-shadow:0 12px 40px rgba(0,0,0,.45);color:#fafafa;pointer-events:none;
        z-index:2147483646;font-family:Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
        transition:opacity .35s ease,transform .35s ease}
      #__demo-caption.on{opacity:1;transform:translate(-50%,0)}
      #__demo-caption .k{display:flex;align-items:center;gap:8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#a1a1aa;font-variant-numeric:tabular-nums}
      #__demo-caption .k i{width:6px;height:6px;border-radius:50%;background:#3b82f6;display:inline-block}
      #__demo-caption .t{margin-top:6px;font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-.01em}
      #__demo-caption .s{margin-top:4px;font-size:16px;line-height:1.45;color:#d4d4d8}
      @media (max-width:640px){#__demo-caption{bottom:84px;padding:12px 14px;border-radius:14px}
        #__demo-caption .t{font-size:17px}#__demo-caption .s{font-size:13px}#__demo-caption .k{font-size:10px}}
      @media print{#__demo-caption,#__demo-cursor{display:none!important}}`;
    document.documentElement.appendChild(st);
    const c = document.createElement('div');
    c.id = '__demo-cursor';
    document.documentElement.appendChild(c);
    const pos = window.__demoCursor || { x: innerWidth / 2, y: innerHeight / 2 };
    c.style.left = pos.x + 'px';
    c.style.top = pos.y + 'px';
    addEventListener('mousemove', (e) => {
      c.style.left = e.clientX + 'px';
      c.style.top = e.clientY + 'px';
    }, true);
    addEventListener('mousedown', () => c.classList.add('down'), true);
    addEventListener('mouseup', () => c.classList.remove('down'), true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
};

let currentCaption = null;

async function paintCaption(page) {
  if (!currentCaption) return;
  await page
    .evaluate(({ step, title, subtitle }) => {
      let el = document.getElementById('__demo-caption');
      if (!el) {
        el = document.createElement('div');
        el.id = '__demo-caption';
        el.setAttribute('aria-hidden', 'true');
        document.documentElement.appendChild(el);
      }
      const esc = (s) => String(s).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
      const html = `<div class="k"><i></i>${esc(step)}</div><div class="t">${esc(title)}</div>${subtitle ? `<div class="s">${esc(subtitle)}</div>` : ''}`;
      if (el.dataset.html === html && el.classList.contains('on')) return;
      el.classList.remove('on');
      el.dataset.html = html;
      setTimeout(() => {
        el.innerHTML = html;
        el.classList.add('on');
      }, el.innerHTML ? 220 : 0);
    }, currentCaption)
    .catch(() => {});
}

/** Стеклянная плашка-титр внизу экрана (Obsidian Dark). Переживает навигацию. */
async function showCaption(page, title, subtitle = '', hold = 0) {
  currentCaption = { step: scene.label, title, subtitle };
  await paintCaption(page);
  if (hold) await page.waitForTimeout(Math.round(hold * HOLD_SCALE));
}

/** Множитель пауз под титрами: подгоняет хронометраж ролика к ~3 минутам. */
const HOLD_SCALE = Number(process.env.DEMO_HOLD_SCALE ?? 0.75);

const scene = { n: 0, total: 6, label: '' };
function startScene(name) {
  scene.n += 1;
  scene.label = `Сцена ${scene.n} из ${scene.total} · ${name}`;
  log('▶', scene.label);
}

// ───────────────────────────── плавные действия

const mouse = { x: VIDEO.width / 2, y: VIDEO.height / 2 };

// slowMo применяется к каждому шагу мыши, поэтому шагов немного — движение и так плавное
async function moveTo(page, x, y, steps = 9) {
  await page.mouse.move(x, y, { steps });
  mouse.x = x;
  mouse.y = y;
}

/** Плавно ведёт курсор к элементу и кликает. */
async function click(page, locator, { pause = 450 } = {}) {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const box = await locator.boundingBox();
  if (box) {
    await moveTo(page, box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(120);
  }
  await locator.click();
  await page.waitForTimeout(pause);
}

/**
 * «Печать» небольшими порциями: slowMo добавляет паузу к каждой клавише, и посимвольный
 * ввод длинного текста растянул бы ролик. Порции по 2–4 символа выглядят как живой набор.
 */
async function typeChunks(page, text, size = 3) {
  for (let i = 0; i < text.length; i += size) {
    await page.keyboard.insertText(text.slice(i, i + size));
  }
}

async function type(page, locator, text, size = 3) {
  await click(page, locator, { pause: 150 });
  await typeChunks(page, text, size);
}

/** Плавная прокрутка колесом. */
async function scroll(page, dy, { step = 70, delay = 16 } = {}) {
  const n = Math.max(1, Math.round(Math.abs(dy) / step));
  for (let i = 0; i < n; i++) {
    await page.mouse.wheel(0, Math.sign(dy) * step);
    await page.waitForTimeout(delay);
  }
  await page.waitForTimeout(350);
}

async function scrollToTop(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(700);
}

/** Бережно прокручивает к элементу, оставляя его в верхней трети экрана. */
async function scrollToEl(page, locator, offset = 140) {
  await locator.waitFor({ state: 'attached', timeout: 15000 });
  const y = await locator.evaluate((el, off) => el.getBoundingClientRect().top - off, offset);
  await scroll(page, y);
}

async function go(page, url) {
  await page.goto(BASE + url, { waitUntil: 'networkidle' }).catch(() => page.goto(BASE + url));
  await page.waitForTimeout(500);
}

/** Шаг сценария: при сбое логируем, делаем скриншот и продолжаем запись. */
const failures = [];
async function step(page, name, fn) {
  try {
    await fn();
  } catch (e) {
    failures.push(name);
    log(`⚠ шаг «${name}» не удался: ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: path.join(RAW_DIR, `fail-${failures.length}.png`) }).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
  }
}

// ───────────────────────────── сцены

async function loginAs(page, roleLabel) {
  if (!page.url().includes('/login')) await go(page, '/login');
  await page.getByRole('button', { name: new RegExp(roleLabel) }).waitFor();
  await click(page, page.getByRole('button', { name: new RegExp(roleLabel) }), { pause: 200 });
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(900);
}

async function logout(page) {
  await click(page, page.getByRole('button', { name: 'Выйти' }).first(), { pause: 300 });
  await page.waitForURL(/\/login/, { timeout: 15000 });
  await page.waitForTimeout(600);
}

async function scene1(page) {
  startScene('Вход и «Фокус дня»');
  await go(page, '/login');
  await showCaption(page, 'Вход в «Орбиту»', 'Корпоративная почта вуза или быстрый вход для жюри в 1 клик. Все данные вымышленные.', 2600);
  await step(page, 'дисклеймер', async () => {
    const q = page.getByRole('heading', { name: 'Быстрый вход для жюри в 1 клик' });
    const box = await q.boundingBox();
    if (box) await moveTo(page, box.x + 120, box.y + 8, 12);
    await showCaption(page, '1-Click Demo Switcher', 'Четыре роли: студент-отличник, студент с долгами, деканат и преподаватель.', 2400);
  });
  await showCaption(page, 'Входим как студент Алексей Соколов', 'Студент-отличник, группа М3203');
  await loginAs(page, 'Студент-отличник');

  await showCaption(page, 'Дашборд «Фокус дня»', 'Ближайшая пара, средний балл БРС и горящие дедлайны — на одном экране.', 2800);
  await step(page, 'дедлайны', async () => {
    await scrollToEl(page, page.getByRole('heading', { name: 'Горящие дедлайны' }), 260);
    await showCaption(page, 'Горящие дедлайны с обратным отсчётом', 'Задачи отсортированы по сроку, рядом — сколько баллов БРС они дают.', 2600);
  });
  await step(page, 'время в вузе', async () => {
    await scrollToEl(page, page.getByRole('heading', { name: 'Время в вузе и учебная активность' }), 120);
    await showCaption(page, 'Время в вузе и учебная активность', 'Часы на парах, в коворкингах и онлайн — статистика по неделям.', 3000);
  });
  await scrollToTop(page);
}

async function scene2(page) {
  startScene('Расписание и бронирование');
  await go(page, '/schedule');
  await showCaption(page, 'Расписание группы', 'Сегодня, неделя и экспорт в календарь (.ics) в один клик.', 1600);
  await step(page, 'перенос', async () => {
    await click(page, page.getByRole('tab', { name: 'Неделя' }));
    const badge = page.getByText('Перенос', { exact: true }).first();
    await badge.waitFor({ timeout: 8000 });
    await scrollToEl(page, badge, 320);
    const box = await badge.boundingBox();
    if (box) await moveTo(page, box.x + box.width / 2, box.y + box.height / 2, 12);
    await showCaption(page, 'Перенос аудитории виден сразу', 'Деканат публикует перенос — у группы появляется бейдж «Перенос» и старая аудитория зачёркнута.', 3000);
    await scrollToTop(page);
  });
  await step(page, 'поиск по группам', async () => {
    await click(page, page.getByRole('tab', { name: /Группы и аудитории|Поиск/ }));
    await showCaption(page, 'Поиск по группам и аудиториям', 'Где сейчас пара у другой группы и свободна ли нужная аудитория.', 2400);
  });
  await step(page, 'бронирование', async () => {
    await click(page, page.getByRole('tab', { name: /Бронирование/ }));
    await showCaption(page, 'Бронирование коворкингов и переговорных', 'Выбираем дату, помещение и свободный слот.', 1200);
    const dates = page.getByRole('radiogroup', { name: 'Дата бронирования' }).getByRole('radio');
    if ((await dates.count()) > 1) await click(page, dates.nth(1));
    else {
      const btns = page.getByRole('radiogroup', { name: 'Дата бронирования' }).getByRole('button');
      if ((await btns.count()) > 1) await click(page, btns.nth(1));
    }
    const slot = page.getByRole('button', { name: /свободно, забронировать/ }).first();
    await scrollToEl(page, slot, 380);
    await click(page, slot, { pause: 700 });
    const chip = page.getByRole('button', { name: 'Подготовка к хакатону' });
    if (await chip.isVisible().catch(() => false)) await click(page, chip);
    await click(page, page.getByRole('button', { name: 'Забронировать', exact: true }), { pause: 1400 });
    await showCaption(page, 'Готово — помещение забронировано', 'Бронь сразу видна в «Моих бронях», слот помечается занятым.', 2400);
    await scrollToTop(page);
  });
}

async function scene3(page) {
  startScene('Симулятор БРС и онлайн-решатель');
  await go(page, '/grades');
  await showCaption(page, 'Успеваемость по балльно-рейтинговой системе', 'Лабораторные, рубежный контроль и посещаемость по каждой дисциплине.', 1800);
  await step(page, 'симулятор', async () => {
    await click(page, page.getByRole('tab', { name: 'Симулятор' }));
    await showCaption(page, 'Симулятор БРС «Что если?»', 'Двигаем ползунки — итог и стипендия пересчитываются мгновенно.', 800);
    const sliders = page.locator('input[type="range"]:not([disabled])');
    const n = Math.min(await sliders.count(), 3);
    for (let i = 0; i < n; i++) {
      const s = sliders.nth(i);
      await s.scrollIntoViewIfNeeded();
      const box = await s.boundingBox();
      if (!box) continue;
      const y = box.y + box.height / 2;
      await moveTo(page, box.x + 6, y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.85, y, { steps: 12 });
      await page.mouse.move(box.x + box.width * 0.6, y, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(500);
    }
    await showCaption(page, 'Рейтинг и стипендия пересчитаны', 'Видно, сколько баллов не хватает до повышенной стипендии (порог 85).', 1200);
    const min = page.getByRole('button', { name: 'До 85 минимально' });
    if (await min.isVisible().catch(() => false)) {
      await click(page, min, { pause: 1200 });
      await showCaption(page, 'Кнопка «До 85 минимально»', 'Симулятор сам подбирает минимальный план баллов для стипендии.', 2200);
    }
  });

  await go(page, '/study');
  await showCaption(page, 'Учёба и домашние задания', 'Онлайн-задачи от преподавателя с дедлайнами и баллами БРС.', 1600);
  await step(page, 'решатель', async () => {
    const card = page.getByRole('heading', { name: /скобочная последовательность/ });
    const open = (await card.count())
      ? card.locator('xpath=ancestor::*[.//button[normalize-space()="Открыть задачу и решить"]][1]').getByRole('button', { name: 'Открыть задачу и решить' })
      : page.getByRole('button', { name: 'Открыть задачу и решить' }).first();
    await click(page, open, { pause: 900 });
    await showCaption(page, 'Интерактивный редактор решения', 'Условие слева, код справа: нумерация строк, Tab, автосохранение черновика.', 600);
    const editor = page.locator('#ws-code');
    await click(page, editor, { pause: 150 });
    await page.keyboard.press(IS_WIN ? 'Control+A' : 'Meta+A');
    await page.keyboard.press('Delete');
    const code = [
      'def is_valid(s: str) -> bool:',
      '    pairs = {")": "(", "]": "[", "}": "{"}',
      '    stack = []',
      '    for ch in s:',
      '        if ch in "([{":',
      '            stack.append(ch)',
      '        elif not stack or stack.pop() != pairs[ch]:',
      '            return False',
      '    return not stack',
    ];
    for (const [i, line] of code.entries()) {
      await typeChunks(page, line, 5);
      if (i < code.length - 1) await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(800);
    await showCaption(page, 'ИИ-помощник «Орбита Copilot»', 'Разбирает задачу по шагам и не выдаёт готовый код — помогает думать.', 300);
    await click(page, page.getByRole('dialog').getByRole('button', { name: 'Разобрать с ИИ' }).first(), { pause: 600 });
    const panel = page.getByRole('dialog', { name: 'Орбита Copilot' });
    await panel.waitFor({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(3500);
    const pb = await panel.boundingBox().catch(() => null);
    if (pb) await moveTo(page, pb.x + pb.width / 2, pb.y + pb.height / 2, 12);
    await scroll(page, 260, { step: 40, delay: 30 }); // прокрутка ответа в панели
    await page.waitForTimeout(1500);
    const close = page.getByRole('button', { name: 'Закрыть Copilot' });
    if (await close.isVisible().catch(() => false)) {
      // dispatchEvent не зависит от анимации выезда панели
      const box = await close.boundingBox();
      if (box) await moveTo(page, box.x + box.width / 2, box.y + box.height / 2);
      await close.dispatchEvent('click');
      await page.waitForTimeout(500);
    }
    const closeWs = page.getByRole('button', { name: 'Закрыть рабочую зону' });
    if (await closeWs.isVisible().catch(() => false)) await click(page, closeWs);
  });
}

async function scene4(page) {
  startScene('Кампус 360° и мессенджер');
  await go(page, '/campus');
  await showCaption(page, 'Кампус и сервисы', 'Wi-Fi, лицензии, Smart-пропуск, мероприятия и спорт — в одном разделе.', 1400);
  await step(page, 'wi-fi', async () => {
    await click(page, page.getByRole('button', { name: 'Сгенерировать новый пароль' }), { pause: 900 });
    const show = page.getByRole('button', { name: 'Показать пароль' });
    if (await show.isVisible().catch(() => false)) await click(page, show, { pause: 600 });
    await showCaption(page, 'Новый пароль Wi-Fi в один клик', 'Без похода в IT-отдел: пароль перевыпускается мгновенно.', 2000);
  });
  await step(page, 'smart pass', async () => {
    const qr = page.getByRole('img', { name: 'Динамический QR-код пропуска' });
    await scrollToEl(page, qr, 260);
    const box = await qr.boundingBox();
    if (box) await moveTo(page, box.x + box.width / 2, box.y + box.height / 2, 12);
    await showCaption(page, 'Smart-пропуск с динамическим QR', 'Код обновляется каждые 30 секунд и скрывается вне активной вкладки.', 2600);
    await scrollToTop(page);
  });
  await step(page, 'хакатон', async () => {
    await click(page, page.getByRole('tab', { name: /Мероприятия/ }), { pause: 700 });
    const title = page.getByText('Хакатон цифровых сервисов кампуса').first();
    await scrollToEl(page, title, 260);
    const btn = title.locator('xpath=ancestor::*[.//button][1]').getByRole('button', { name: /Записаться в 1 клик/ });
    await click(page, btn, { pause: 1200 });
    await showCaption(page, 'Запись на хакатон в один клик', 'Билет с QR-кодом сразу появляется в личном кабинете.', 2000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await scrollToTop(page);
  });
  await step(page, 'спорт', async () => {
    await click(page, page.getByRole('tab', { name: /Физкультура/ }), { pause: 800 });
    await showCaption(page, 'Физкультура и спортивные секции', 'Расписание секций, свободные места и запись онлайн.', 1200);
    await scroll(page, 380);
    await page.waitForTimeout(1200);
    await scrollToTop(page);
  });

  await go(page, '/messages');
  await showCaption(page, 'Мессенджер с преподавателями и деканатом', 'Без личных номеров и сторонних чатов.', 1000);
  await step(page, 'сообщение', async () => {
    await click(page, page.getByRole('button', { name: /^Волков Игорь Сергеевич/ }), { pause: 800 });
    const input = page.getByPlaceholder('Сообщение…');
    await type(page, input, 'Игорь Сергеевич, добрый день! Замеры на 10⁶ ключей добавил, отправляю лабу сегодня.', 4);
    await click(page, page.getByRole('button', { name: 'Отправить' }).last(), { pause: 1000 });
    await showCaption(page, 'Сообщение отправлено преподавателю', 'Непрочитанные — счётчиком в навигации и в шапке.', 1800);
  });
}

async function scene5(page) {
  startScene('Студент ↔ Деканат ↔ справка с QR');
  await go(page, '/requests');
  await showCaption(page, 'Заявки и справки онлайн', 'Семь типов документов без очереди в деканат.', 1400);
  await step(page, 'заказ справки', async () => {
    const h = page.getByRole('heading', { name: 'Справка об обучении', exact: true });
    await click(page, h.locator('xpath=..').getByRole('button', { name: 'Оформить' }), { pause: 700 });
    await showCaption(page, 'Заказываем справку об обучении', 'Электронная с ЭЦП, место требования — один клик по подсказке.', 300);
    const dest = page.locator('#r-dest');
    await type(page, dest, 'АО «Технопарк Северный»', 2);
    await page.waitForTimeout(300);
    await click(page, page.getByRole('button', { name: 'Отправить в деканат' }), { pause: 1500 });
    await showCaption(page, 'Заявка отправлена', 'Статус и шаги согласования отображаются в «Моих заявках».', 2000);
  });

  await step(page, 'деканат', async () => {
    await showCaption(page, 'Переключаемся на сотрудника деканата', 'dekanat@edu.orbita.ru — вход в 1 клик');
    await logout(page);
    await loginAs(page, 'Сотрудник деканата');
    await showCaption(page, 'Панель сотрудника деканата', 'Очередь заявок студентов: новая справка Алексея уже здесь.', 1400);
    const row = page.getByRole('row').filter({ hasText: 'Соколов Алексей' }).filter({ hasText: 'Справка об обучении' }).first();
    await scrollToEl(page, row, 260);
    await click(page, row.getByRole('button', { name: 'Одобрить и подписать ЭЦП' }), { pause: 1500 });
    await showCaption(page, 'Одобрено и подписано ЭЦП', 'Документу присвоен регистрационный номер, студент получает уведомление.', 2200);
  });

  await step(page, 'студент получает справку', async () => {
    await showCaption(page, 'Возвращаемся к Алексею Соколову');
    await logout(page);
    await loginAs(page, 'Студент-отличник');
    const bell = page.getByRole('button', { name: /^Уведомления/ });
    await click(page, bell, { pause: 900 });
    await showCaption(page, 'Уведомление: справка готова', 'Колокольчик сообщает о решении деканата сразу после подписи.', 2400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await go(page, '/requests');
    const btn = page.getByRole('button', { name: 'Открыть цифровую справку' }).first();
    await scrollToEl(page, btn, 300);
    await click(page, btn, { pause: 1200 });
    await showCaption(page, 'Печатный бланк справки с ЭЦП и QR-кодом', 'QR ведёт на проверку подлинности документа по регистрационному номеру.', 1500);
    await scroll(page, 500);
    await page.waitForTimeout(2200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });
}

async function scene6(page) {
  startScene('Безопасность, темы, мобильная версия');
  await go(page, '/profile');
  await step(page, 'IDOR', async () => {
    const btn = page.getByRole('button', { name: 'Попытаться открыть чужую заявку по ID' });
    await scrollToEl(page, btn, 420);
    await showCaption(page, 'Проверка защиты от IDOR', 'Пробуем открыть чужую заявку, подставив её ID в адрес запроса.', 1200);
    await click(page, btn, { pause: 1200 });
    await page.getByText('403 Forbidden').first().waitFor({ timeout: 8000 });
    await showCaption(page, '403 Forbidden — доступ запрещён', 'Сервер берёт userId только из HttpOnly JWT и сверяет владельца заявки.', 3000);
  });
  await step(page, 'тема', async () => {
    const light = page.getByRole('radio', { name: 'Светлая' });
    await scrollToEl(page, light, 300);
    await showCaption(page, 'Две темы: Obsidian Dark и Светлая', 'Выбор сохраняется на устройстве.', 300);
    await click(page, light, { pause: 1800 });
    await click(page, page.getByRole('radio', { name: 'Obsidian Dark' }), { pause: 1200 });
  });
  await step(page, 'мобильная версия', async () => {
    await page.setViewportSize({ width: 360, height: 800 });
    // с этого момента страница рисуется в углу кадра — отрезок «телефона» для постобработки
    timeline.mobileAt = (Date.now() - timeline.t0) / 1000;
    await go(page, '/');
    await showCaption(page, 'Мобильная версия · 360 px', 'Нижний таб-бар, без горизонтального скролла.', 1800);
    const tabs = [
      ['Расписание', 'Расписание'],
      ['Учёба и ДЗ', 'Учёба'],
      ['БРС', 'БРС'],
      ['Сводка', 'Сводка'],
    ];
    for (const [name, label] of tabs) {
      const link = page.getByRole('navigation').last().getByRole('link', { name, exact: true });
      await click(page, link, { pause: 900 });
      await page.waitForLoadState('networkidle').catch(() => {});
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      await showCaption(page, `Мобильная версия · ${label}`, overflow > 0 ? `Горизонтальный скролл: ${overflow}px` : 'Ширина 360 px — горизонтального скролла нет.', 300);
      await scroll(page, 500, { step: 50 });
      await page.waitForTimeout(500);
      await scrollToTop(page);
    }
  });
  await showCaption(page, '«Орбита» — цифровой деканат будущего', 'Концепт для конкурса. Не является официальным сервисом вуза. Все данные вымышленные.', 3500);
}

// ───────────────────────────── main

async function findFfmpeg() {
  if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore', shell: IS_WIN }).status === 0) return 'ffmpeg';
  try {
    return (await import('ffmpeg-static')).default;
  } catch {
    return null;
  }
}

/**
 * Playwright пишет видео фиксированного размера: после setViewportSize(360×800) страница
 * занимает левый верхний угол кадра на сером фоне. Этот отрезок кадрируем, увеличиваем
 * и ставим по центру на тёмном фоне в рамке — как экран телефона.
 */
function videoFilter(mobileAt) {
  const base = '[0:v]fps=30,format=yuv420p';
  if (mobileAt == null) return `${base}[v]`;
  const t = mobileAt.toFixed(2);
  const h = 880;
  const w = Math.round((360 / 800) * h / 2) * 2;
  const x = (VIDEO.width - w) / 2;
  const y = (VIDEO.height - h) / 2;
  return [
    `${base},split=2[a][b]`,
    `[a]trim=end=${t},setpts=PTS-STARTPTS[a1]`,
    `[b]trim=start=${t},setpts=PTS-STARTPTS,crop=360:800:0:0,scale=${w}:${h}:flags=lanczos,` +
      `pad=${VIDEO.width}:${VIDEO.height}:${x}:${y}:color=0x09090b,drawbox=x=${x - 2}:y=${y - 2}:w=${w + 4}:h=${h + 4}:color=0x3f3f46:t=2[b1]`,
    '[a1][b1]concat=n=2:v=1:a=0[v]',
  ].join(';');
}

async function finalize(raw, mobileAt) {
  const ff = await findFfmpeg();
  if (!ff) {
    fs.copyFileSync(raw, OUT_WEBM);
    log(`✓ ${path.relative(ROOT, OUT_WEBM)} (сырой, без постобработки)`);
    log('ffmpeg не найден — MP4 пропущен (поставьте ffmpeg или `npm i -D ffmpeg-static`)');
    return;
  }
  const filter = videoFilter(mobileAt);
  const encode = (out, codec) => {
    const r = spawnSync(ff, ['-y', '-loglevel', 'error', '-i', raw, '-filter_complex', filter, '-map', '[v]', '-an', ...codec, out], { stdio: 'inherit' });
    if (r.status === 0) log(`✓ ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1048576).toFixed(1)} МБ)`);
    return r.status === 0;
  };
  log('кодирую WebM (VP9)…');
  const okWebm = encode(OUT_WEBM, ['-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4']);
  if (!okWebm) {
    fs.copyFileSync(raw, OUT_WEBM);
    log('⚠ VP9 не удался — сохранён сырой WebM');
  }
  log('кодирую MP4 (H.264)…');
  if (!encode(OUT_MP4, ['-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'])) {
    log('⚠ ffmpeg не смог собрать MP4');
  }
}

/** Секунда записи, с которой начинается мобильный отрезок (для постобработки). */
const timeline = { t0: 0, mobileAt: null };

async function main() {
  fs.rmSync(RAW_DIR, { recursive: true, force: true });
  fs.mkdirSync(RAW_DIR, { recursive: true });

  if (!ARGS.has('--no-seed')) {
    run('npx prisma db push --skip-generate');
    run('npx tsx prisma/seed.ts');
    await prepareDemoData();
  }
  await ensureServer();

  const browser = await chromium.launch({ headless: !ARGS.has('--headed'), slowMo: 120 });
  const context = await browser.newContext({
    viewport: VIDEO,
    deviceScaleFactor: 1,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    colorScheme: 'dark',
    recordVideo: { dir: RAW_DIR, size: VIDEO },
  });
  context.setDefaultTimeout(12000); // зависший шаг не должен растягивать ролик
  await context.addInitScript(OVERLAY_INIT);
  const page = await context.newPage();
  timeline.t0 = Date.now(); // видео страницы начинается с её создания
  page.on('domcontentloaded', () => void paintCaption(page));
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.addInitScript(() => {
    window.print = () => {}; // «Печать» в бланке не должна открывать системный диалог
  });

  try {
    await scene1(page);
    await scene2(page);
    await scene3(page);
    await scene4(page);
    await scene5(page);
    await scene6(page);
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();
    const raw = video ? await video.path() : null;
    log(`запись: ${((Date.now() - timeline.t0) / 1000).toFixed(0)} сек`);
    if (raw && fs.existsSync(raw)) await finalize(raw, timeline.mobileAt);
    else log('⚠ видеофайл не найден');
  }
  if (failures.length) log(`⚠ шагов с ошибками: ${failures.length} — ${failures.join(', ')} (скриншоты в demo-raw/)`);
  else fs.rmSync(RAW_DIR, { recursive: true, force: true });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(stopServer);
