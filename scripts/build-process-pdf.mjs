import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const SCREENSHOTS_DIR = path.join(ROOT, 'ai-docs', 'screenshots');
const PDF_PATH = path.join(ROOT, 'Orbita_Process_Report.pdf');
const BASE_URL = 'http://localhost:3000';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function isServerAlive() {
  try {
    const res = await fetch(`${BASE_URL}/login`, { redirect: 'manual' });
    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await isServerAlive()) {
    console.log('✓ Локальный сервер уже запущен на', BASE_URL);
    return { stop: async () => {} };
  }

  console.log('⟳ Запуск локального сервера Next.js (npm run start)…');
  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'start'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: false,
  });

  for (let i = 0; i < 45; i++) {
    if (await isServerAlive()) {
      console.log('✓ Сервер готов к снятию скриншотов.');
      return {
        stop: async () => {
          child.kill('SIGTERM');
        },
      };
    }
    await sleep(1000);
  }
  child.kill('SIGTERM');
  throw new Error('Не удалось дождаться запуска сервера на http://localhost:3000');
}

async function captureScreenshots() {
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 820 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // 1. Экран входа /login
    console.log('📸 01_login_switcher.png');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h2:has-text("Вход в Орбиту")');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_login_switcher.png'), fullPage: false });

    // Входим в 1 клик под студентом Алексеем Соколовым
    await page.locator('button:has-text("Алексей Соколов")').first().click();
    await page.waitForURL(`${BASE_URL}/`, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await sleep(800);

    // Убедимся, что активна тёмная тема Obsidian Dark
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      try { localStorage.setItem('orbita-theme', 'dark'); } catch {}
    });
    await sleep(400);

    // 2. Дашборд «Фокус дня» + виджет «Время в вузе» в Obsidian Dark
    console.log('📸 02_dashboard_dark.png');
    await page.waitForSelector('text=Фокус дня');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_dashboard_dark.png'), fullPage: true });

    // 3. Интерактивный решатель задач /study
    console.log('📸 03_study_brs.png');
    await page.goto(`${BASE_URL}/study`, { waitUntil: 'networkidle' });
    await sleep(600);
    const solveBtn = page.locator('button:has-text("Открыть задачу и решить")').first();
    if (await solveBtn.count()) {
      await solveBtn.click();
      await sleep(700);
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_study_brs.png'), fullPage: false });
    // Закрываем рабочую зону
    const closeWs = page.locator('button[aria-label="Закрыть рабочую зону"]');
    if (await closeWs.count()) await closeWs.click();

    // 4. Печатная справка А4 с ЭЦП и QR-кодом (на белом фоне)
    console.log('📸 04_certificate_qr.png');
    await page.goto(`${BASE_URL}/requests`, { waitUntil: 'networkidle' });
    await sleep(600);
    await page.locator('button:has-text("Открыть цифровую справку")').first().click();
    await page.waitForSelector('[data-print-root]');
    await sleep(500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_certificate_qr.png'), fullPage: false });

    // 5. Хаб «Кампус и Сервисы» /campus
    console.log('📸 05_campus_hub.png');
    await page.goto(`${BASE_URL}/campus`, { waitUntil: 'networkidle' });
    await sleep(700);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_campus_hub.png'), fullPage: false });

    // 6. Профиль /profile с результатом IDOR-теста (403 Forbidden)
    console.log('📸 06_idor_security.png');
    await page.locator('a[href="/profile"]').first().click();
    await page.waitForURL(`${BASE_URL}/profile`, { timeout: 15000 });
    await page.waitForSelector('text=IDOR-тест', { timeout: 15000 });
    await sleep(500);
    const idorBtn = page.locator('button:has-text("Попытаться открыть")');
    await idorBtn.scrollIntoViewIfNeeded();
    await idorBtn.click();
    await page.waitForSelector('text=403', { timeout: 10000 });
    await sleep(500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_idor_security.png'), fullPage: false });

    // 7. Мобильная версия 360x800 с нижним таб-баром
    console.log('📸 07_mobile_360px.png');
    const mobileContext = await browser.newContext({
      viewport: { width: 360, height: 800 },
      deviceScaleFactor: 2,
      storageState: await context.storageState(),
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await mobilePage.evaluate(() => {
      document.documentElement.classList.add('dark');
      try { localStorage.setItem('orbita-theme', 'dark'); } catch {}
    });
    await sleep(700);
    await mobilePage.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_mobile_360px.png'), fullPage: false });
    await mobileContext.close();
  } finally {
    await browser.close();
  }
}

async function imgDataUri(filename) {
  const buf = await fs.readFile(path.join(SCREENSHOTS_DIR, filename));
  return `data:image/png;base64,${buf.toString('base64')}`;
}

async function buildHtml() {
  const imgs = {
    s01: await imgDataUri('01_login_switcher.png'),
    s02: await imgDataUri('02_dashboard_dark.png'),
    s03: await imgDataUri('03_study_brs.png'),
    s04: await imgDataUri('04_certificate_qr.png'),
    s05: await imgDataUri('05_campus_hub.png'),
    s06: await imgDataUri('06_idor_security.png'),
    s07: await imgDataUri('07_mobile_360px.png'),
  };

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<title>Орбита — Описание процесса создания и применения ИИ</title>
<style>
  @page {
    size: A4;
    margin: 16mm 14mm;
  }
  * {
    box-sizing: border-box;
  }
  body {
    margin: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
    font-size: 10pt;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, h3, h4, p, ul, ol, pre, table, figure {
    margin-top: 0;
  }
  .cover {
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    padding: 22px 24px;
    background: #f8fafc;
    margin-bottom: 18px;
  }
  .eyebrow {
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #1d4ed8;
    margin-bottom: 6px;
  }
  .cover h1 {
    font-size: 20pt;
    line-height: 1.2;
    font-weight: 800;
    color: #09090b;
    margin-bottom: 8px;
  }
  .subtitle {
    font-size: 10.5pt;
    color: #334155;
    margin-bottom: 14px;
  }
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 14px;
  }
  .meta-box {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 10px;
  }
  .meta-box .k {
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
  }
  .meta-box .v {
    font-size: 9.5pt;
    font-weight: 600;
    color: #0f172a;
    margin-top: 2px;
  }
  .disclaimer {
    border-left: 3px solid #2563eb;
    background: #eff6ff;
    padding: 9px 12px;
    border-radius: 0 6px 6px 0;
    font-size: 8.8pt;
    color: #1e3a8a;
  }
  h2 {
    font-size: 13pt;
    font-weight: 700;
    color: #0f172a;
    border-bottom: 1.5px solid #e2e8f0;
    padding-bottom: 5px;
    margin-top: 20px;
    margin-bottom: 10px;
    page-break-after: avoid;
    break-after: avoid;
  }
  h3 {
    font-size: 10.5pt;
    font-weight: 700;
    color: #1e293b;
    margin-top: 12px;
    margin-bottom: 6px;
    page-break-after: avoid;
    break-after: avoid;
  }
  p {
    margin-bottom: 8px;
    color: #1e293b;
  }
  ul, ol {
    padding-left: 18px;
    margin-bottom: 10px;
  }
  li {
    margin-bottom: 4px;
    color: #1e293b;
  }
  code {
    font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
    font-size: 8.6pt;
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
    color: #0f172a;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
    font-size: 8.8pt;
    break-inside: avoid;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #f1f5f9;
    font-weight: 700;
    color: #0f172a;
  }
  .cards-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 12px;
    break-inside: avoid;
  }
  .card {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 10px 12px;
    background: #ffffff;
  }
  .card h4 {
    font-size: 9.5pt;
    font-weight: 700;
    color: #1d4ed8;
    margin-bottom: 4px;
  }
  .card p {
    font-size: 8.5pt;
    margin-bottom: 0;
    color: #334155;
  }
  .prompt-box {
    border: 1px solid #cbd5e1;
    border-left: 3px solid #0f172a;
    border-radius: 6px;
    background: #f8fafc;
    padding: 9px 11px;
    margin-bottom: 10px;
    break-inside: avoid;
  }
  .prompt-title {
    font-size: 8.5pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 4px;
  }
  .prompt-text {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 8pt;
    line-height: 1.4;
    color: #334155;
    white-space: pre-wrap;
    margin: 0;
  }
  .bug-item {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 11px;
    margin-bottom: 8px;
    background: #ffffff;
    break-inside: avoid;
  }
  .bug-item strong {
    color: #0f172a;
  }
  .badge {
    display: inline-block;
    font-size: 7.5pt;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    margin-right: 6px;
  }
  .badge-fix { background: #dcfce7; color: #166534; }
  .badge-sec { background: #dbeafe; color: #1e40af; }
  .shot {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 14px;
    background: #f8fafc;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .shot img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 5px;
    border: 1px solid #e2e8f0;
  }
  .shot-mobile img {
    width: auto;
    max-width: 260px;
    margin: 0 auto;
  }
  .shot figcaption {
    margin-top: 7px;
    font-size: 8.8pt;
    color: #334155;
  }
  .shot figcaption strong {
    color: #0f172a;
  }
  .sec-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 10px;
    break-inside: avoid;
  }
  .page-break {
    page-break-before: always;
    break-before: page;
  }
</style>
</head>
<body>

  <!-- 1. ТИТУЛЬНЫЙ БЛОК И ДИСКЛЕЙМЕР -->
  <section class="cover">
    <div class="eyebrow">Конкурс «Цифровой деканат будущего» · Описание процесса создания (V1 → V3)</div>
    <h1>Орбита — Цифровой деканат будущего</h1>
    <p class="subtitle">
      Технический отчёт о проектировании, применении нейротехнологий (Spec-Driven Development),
      оркестрации параллельных ИИ-агентов, аудите безопасности и проверке качества веб-прототипа.
    </p>
    <div class="meta-grid">
      <div class="meta-box">
        <div class="k">Стек и архитектура</div>
        <div class="v">Next.js 15 · React 19 · Prisma 6 · SQLite</div>
      </div>
      <div class="meta-box">
        <div class="k">Версия и сборка</div>
        <div class="v">V3 · 34 маршрута · 0 ошибок TS</div>
      </div>
      <div class="meta-box">
        <div class="k">Безопасность</div>
        <div class="v">JWT HttpOnly · bcrypt · Anti-IDOR</div>
      </div>
    </div>
    <div class="disclaimer">
      <strong>Правовой дисклеймер и чистота данных:</strong> Проект «Орбита» является учебно-конкурсным прототипом,
      не является официальным сервисом какого-либо вуза и не использует его символику. Все персональные данные
      в базе данных (ФИО студентов и преподавателей, email-адреса, номера зачётных книжек, оценки и переписки)
      являются полностью вымышленными.
    </div>
  </section>

  <!-- 2. ПРОБЛЕМАТИКА И ОБОСНОВАНИЕ РАЗДЕЛОВ -->
  <h2>1. Проблематика и обоснование архитектуры из 3 контуров</h2>
  <p>
    Цифровая среда современного студента часто распадается на несколько несвязанных порталов: таблица расписания в PDF,
    разрозненные баллы БРС у преподавателей, сдача лабораторных через почту или чаты, а заказ обычной справки об обучении
    требует очного визита в деканат. На смартфонах эти сервисы вызывают горизонтальный скролл и теряют читаемость.
  </p>
  <p>
    <strong>Решение «Орбиты»</strong> — объединить ежедневные задачи студента, преподавателя и сотрудника деканата в едином
    адаптивном пространстве (от <code>360 px</code>), выстроенном вокруг трёх логических контуров:
  </p>
  <div class="cards-3">
    <div class="card">
      <h4>1. Учебный контур</h4>
      <p>
        Экран «Фокус дня» на главной, расписание с подсветкой переносов и поиском по группам/аудиториям (<code>.ics</code>),
        онлайн-редактор ДЗ (без сторонних ссылок), методички с ИИ-квизом и симулятор БРС «Что если?» с порогом допуска 50 и ПГАС 85.
      </p>
    </div>
    <div class="card">
      <h4>2. Административный контур</h4>
      <p>
        Конвейер из 7 типов заявок с динамическими полями (<code>payloadJson</code>), очередь рассмотрения в кабинете деканата,
        автоматические уведомления и генератор печатной справки формата А4 с ЭЦП и QR-кодом.
      </p>
    </div>
    <div class="card">
      <h4>3. Кампусный контур</h4>
      <p>
        Хаб «Кампус и Сервисы» (IT-доступы и ротация Wi-Fi пароля, афиша мероприятий, спортивные секции), бронирование
        коворкингов с защитой от двойного бронирования (<code>409 Conflict</code>), мессенджер и аналитика «Время в вузе».
      </p>
    </div>
  </div>

  <!-- 3. ПЕРЕЧЕНЬ ИИ-ИНСТРУМЕНТОВ -->
  <h2>2. Полный перечень ИИ-инструментов, IDE и сервисов</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 24%;">Инструмент / Сервис</th>
        <th style="width: 22%;">Категория</th>
        <th>Конкретная роль и вклад в проект «Орбита»</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>LLM-оркестратор (Gemini)</strong></td>
        <td>Системный архитектор</td>
        <td>Декомпозиция требований регламента, составление SDD-контрактов в <code>/specs</code>, формирование master-промптов и разделение зон владения файлами в <code>AGENTS.md</code>.</td>
      </tr>
      <tr>
        <td><strong>IDE с кодинг-агентами<br>(Stream A &amp; Stream B)</strong></td>
        <td>Параллельная разработка</td>
        <td>Два изолированных агента: <strong>Stream A</strong> реализовал схему Prisma, сидеры, JWT-авторизацию и REST API (<code>src/app/api/**</code>); <strong>Stream B</strong> создал дизайн-систему <code>Obsidian Dark</code>, UI-библиотеку и страницы (<code>src/components/**</code>).</td>
      </tr>
      <tr>
        <td><strong>AI Code Reviewer &amp; AppSec Auditor</strong></td>
        <td>Верификация и ревью</td>
        <td>Независимый сквозной аудит стыковки Frontend ↔ API ↔ Prisma, проверка защиты от IDOR/CSRF, аудит тёмной темы, фиксация отчётов <code>REVIEW_REPORT.md</code> и <code>REVIEW_REPORT_V2.md</code>.</td>
      </tr>
      <tr>
        <td><strong>Playwright (Chromium)</strong></td>
        <td>QA-автоматизация</td>
        <td>Автоматизированное снятие скриншотов всех ключевых сценариев (вход, дашборд, решатель задач, справка А4, кампус, IDOR-тест 403, мобильный вьюпорт <code>360×800</code>) и генерация PDF-отчёта.</td>
      </tr>
      <tr>
        <td><strong>Орбита Copilot<br>(<code>/api/ai/chat</code>, <code>/api/ai/quiz</code>)</strong></td>
        <td>Встроенный ИИ-модуль продукта</td>
        <td>Персонализированный ИИ-консьерж (тьютор + навигатор деканата) и генератор квизов по конспектам. Работает как через OpenAI-совместимый API, так и в автономном детерминированном fallback-режиме по реальным данным студента из SQLite.</td>
      </tr>
    </tbody>
  </table>

  <!-- 4. МЕТОДОЛОГИЯ SDD И КЛЮЧЕВЫЕ ПРОМПТЫ -->
  <h2>3. Методология Spec-Driven Development (SDD) и ключевые промпты</h2>
  <p>
    Вместо стихийной генерации кода («вайбкодинга») разработка велась строго от зафиксированных спецификаций к коду.
    Все 4 контракта в папке <code>/specs</code> выступали единым источником истины для обоих субагентов:
  </p>
  <ul>
    <li><code>specs/01_PRODUCT_PRD.md</code> — пользовательские сценарии, 3 роли (<code>STUDENT</code>, <code>TEACHER</code>, <code>ADMIN</code>), пороги БРС (50 / 60 / 85), логика ДЗ и ИИ-квизов.</li>
    <li><code>specs/02_DESIGN_SYSTEM.md</code> — токены темы <code>Obsidian Dark</code>, строгие запреты на кислотные градиенты, <code>tabular-nums</code> для цифр и сетка от <code>360 px</code>.</li>
    <li><code>specs/03_DATA_AND_SECURITY.md</code> — модель угроз IDOR, правила <code>bcrypt</code> (cost 10), <code>HttpOnly</code> JWT-сессия, CSRF-проверка Origin.</li>
    <li><code>specs/04_API_CONTRACT.md</code> — точные схемы JSON-запросов, HTTP-кодов (<code>400</code>, <code>401</code>, <code>403</code>, <code>409</code>) и ответов для 20+ эндпоинтов.</li>
  </ul>

  <div class="prompt-box">
    <div class="prompt-title">Этап 1. Промпт на дизайн-систему (Анти-вайбкод + Obsidian Dark + 360 px)</div>
    <p class="prompt-text">Спроектируй specs/02_DESIGN_SYSTEM.md и UI-слой (Stream B: src/components/**, src/app/**).
Жёсткие ограничения: никакого «вайбкод-шума», кислотных неоновых градиентов и тяжёлых теней. Палитра: строгий минимализм, глубокий Obsidian Dark (#09090B) без FOUC через inline-скрипт в &lt;head&gt;. Все числовые метрики (БРС, часы в кампусе, таймеры) — строго tabular-nums. Полная адаптивность от 360px без горизонтального скролла, тач-зоны ≥ 44px.</p>
  </div>

  <div class="prompt-box">
    <div class="prompt-title">Этап 2. Промпт на бэкенд и защиту от IDOR (Stream A)</div>
    <p class="prompt-text">Реализуй Prisma-схему, идемпотентный seed.ts (5 вымышленных аккаунтов) и REST API в src/app/api/**.
Критическое требование AppSec: ни один эндпоинт не имеет права доверять userId из query или body. Извлекай userId и role исключительно из серверной HttpOnly JWT-cookie. При обращении к чужой заявке, заданию или брони возвращай 403 Forbidden (без оракула перечисления).</p>
  </div>

  <div class="prompt-box">
    <div class="prompt-title">Этап 3. Промпт на апгрейды V2/V3 и независимое ревью</div>
    <p class="prompt-text">Расширь прототип до V2/V3: добавь роль TEACHER с проверкой и оценкой решений в БРС, онлайн-редактор кода, мессенджер с ACL, бронирование помещений с уникальным activeSlotKey (409 Conflict), хаб /campus (Wi-Fi, афиша, спорт) и палитру ⌘K. После слияния проведи полный аудит контрактов Frontend ↔ API ↔ Prisma и тёмной темы, исправь баги и зафиксируй отчёт.</p>
  </div>

  <!-- 5. РАБОТА С ОШИБКАМИ ИИ -->
  <h2>4. Работа с ошибками ИИ: выявленные дефекты и итерации исправления</h2>
  <p>
    Независимое ревью после параллельной генерации кода выявило ряд показательных расхождений между субагентами,
    которые были зафиксированы в <code>ai-docs/REVIEW_REPORT.md</code> и <code>REVIEW_REPORT_V2.md</code> и устранены в коде:
  </p>

  <div class="bug-item">
    <span class="badge badge-fix">Исправлено</span>
    <strong>1. Рассинхрон типа заявки <code>PGAS</code> между Backend и Frontend:</strong>
    Бэкенд-агент реализовал в Prisma и API заявку на повышенную стипендию (<code>PGAS</code>), а фронтенд-агент не добавил её в <code>RequestType</code>. Из-за фолбэка нормализатора заявка ПГАС отображалась как «Справка об обучении» и блокировала её заказ.
    <em>Решение:</em> синхронизированы типы, маппинг, каталог заявок и формулировка в бланке ЭЦП.
  </div>

  <div class="bug-item">
    <span class="badge badge-fix">Исправлено</span>
    <strong>2. Порог академической задолженности БРС (<code>50</code> vs <code>60</code>):</strong>
    На экране успеваемости (<code>/grades</code>) интерфейс использовал границу зачёта <code>PASS_THRESHOLD = 60</code> вместо порога допуска к сессии <code>ADMISSION_THRESHOLD = 50</code>, ошибочно помечая студентов с 58 баллами как должников.
    <em>Решение:</em> в <code>src/lib/brs.ts</code> введён <code>ADMISSION_THRESHOLD = 50</code>, логика UI приведена в соответствие с PRD и бэкендом.
  </div>

  <div class="bug-item">
    <span class="badge badge-fix">Исправлено</span>
    <strong>3. Инверсия печатного бланка справки в тёмной теме (<code>CertificateModal.tsx</code>):</strong>
    При внедрении <code>Obsidian Dark</code> в бланк официальной справки с ЭЦП и QR-кодом попали классы <code>dark:bg-[#12141A] dark:text-zinc-50</code>, превращавшие документ А4 в чёрный лист.
    <em>Решение:</em> инвертирующие классы удалены; бланк всегда рендерится как чистый белый лист бумаги (<code>bg-white text-slate-900</code>).
  </div>

  <div class="bug-item">
    <span class="badge badge-fix">Исправлено</span>
    <strong>4. Сдача ДЗ в V1 vs V2 и защита маршрутов в Edge Middleware:</strong>
    В V1 сервер требовал строгий <code>https://</code> URL (клиент пропускал <code>http://</code>); в V2 появилась сдача текста/кода прямо из редактора (<code>solutionText</code>) без ссылки — Zod-схема <code>submitAssignmentSchema</code> переработана под оба сценария. Дополнительно в <code>src/middleware.ts</code> добавлена серверная защита новых страниц <code>/messages</code> и <code>/campus</code> и детерминированный dev-секрет JWT для согласованности Edge и Node.js рантаймов.
  </div>

  <!-- 6. ВИЗУАЛЬНАЯ ЭВОЛЮЦИЯ И СКРИНШОТЫ -->
  <div class="page-break"></div>
  <h2>5. Визуальная верификация и скриншоты ключевых экранов (Playwright)</h2>
  <p>
    Все приведённые ниже экраны сняты автоматически в headless-браузере Chromium с живого приложения на <code>http://localhost:3000</code> с предзаполненной базой SQLite.
  </p>

  <figure class="shot">
    <img src="${imgs.s01}" alt="Экран входа" />
    <figcaption>
      <strong>Рис. 1. Экран входа (<code>/login</code>):</strong> Конкурсный дисклеймер о вымышленных данных и быстрый переключатель для 5 ролей (студент-отличник, студент в зоне риска, одногруппник, преподаватель, сотрудник деканата).
    </figcaption>
  </figure>

  <figure class="shot">
    <img src="${imgs.s02}" alt="Дашборд Фокус дня в тёмной теме" />
    <figcaption>
      <strong>Рис. 2. Дашборд «Фокус дня» и виджет «Время в вузе» (<code>Obsidian Dark</code>):</strong> Ближайшая пара, горящие дедлайны, статус справок и почасовая аналитика присутствия в кампусе с табличными цифрами (<code>tabular-nums</code>).
    </figcaption>
  </figure>

  <figure class="shot">
    <img src="${imgs.s03}" alt="Интерактивный решатель задач" />
    <figcaption>
      <strong>Рис. 3. Интерактивный решатель задач (<code>/study</code>):</strong> Двухпанельный Workspace с условием в Markdown/LaTeX и встроенным редактором кода, позволяющий сдать решение напрямую без внешнего Git-репозитория.
    </figcaption>
  </figure>

  <figure class="shot">
    <img src="${imgs.s04}" alt="Печатная справка с ЭЦП и QR-кодом" />
    <figcaption>
      <strong>Рис. 4. Печатная справка А4 с ЭЦП и QR-кодом (<code>/requests</code>):</strong> Модальное окно просмотра и печати документа. Даже при активной тёмной теме сам бланк остаётся белым листом бумаги.
    </figcaption>
  </figure>

  <figure class="shot">
    <img src="${imgs.s05}" alt="Хаб Кампус и Сервисы" />
    <figcaption>
      <strong>Рис. 5. Хаб «Кампус и Сервисы» (<code>/campus</code>):</strong> Управление IT-доступами и ротацией пароля от Wi-Fi в 1 клик, афиша университетских мероприятий и запись в спортивные секции.
    </figcaption>
  </figure>

  <figure class="shot">
    <img src="${imgs.s06}" alt="Проверка защиты от IDOR 403 Forbidden" />
    <figcaption>
      <strong>Рис. 6. Встроенный стенд проверки безопасности в профиле (<code>/profile</code>):</strong> Попытка студента обратиться к чужой заявке по прямому ID блокируется сервером с ответом <code>HTTP 403 Forbidden</code>.
    </figcaption>
  </figure>

  <figure class="shot shot-mobile">
    <img src="${imgs.s07}" alt="Мобильная версия 360x800" />
    <figcaption>
      <strong>Рис. 7. Адаптивная мобильная версия (<code>360×800 px</code>):</strong> Карточки без горизонтального скролла и фиксированная нижняя панель навигации с тач-зонами от 44 px.
    </figcaption>
  </figure>

  <!-- 7. БЕЗОПАСНОСТЬ ПРОСТЫМИ СЛОВАМИ -->
  <h2>6. Как устроены вход, хранение данных и защита — простыми словами</h2>
  <div class="sec-grid">
    <div class="card">
      <h4><span class="badge badge-sec">Пароли</span> Проверка без хранения в открытом виде</h4>
      <p>
        База данных не знает паролей пользователей: вместо них хранятся необратимые криптографические слепки (<code>bcrypt</code>-хеши с солью).
        При входе сервер хеширует введённый пароль и сверяет слепки, а защита от перебора (rate limiter) блокирует частые неверные попытки.
      </p>
    </div>
    <div class="card">
      <h4><span class="badge badge-sec">Сессия</span> Цифровой пропуск в <code>HttpOnly</code> cookie</h4>
      <p>
        После успешного входа сервер выписывает подписанный токен (JWT) и кладёт его в cookie с флагом <code>HttpOnly</code>.
        Скрипты в браузере физически не могут прочитать этот токен — это защищает сессию от кражи через XSS-уязвимости.
      </p>
    </div>
    <div class="card">
      <h4><span class="badge badge-sec">Anti-IDOR</span> Почему нельзя подсмотреть чужую справку</h4>
      <p>
        Сервер никогда не верит идентификатору пользователя, переданному с экрана. Для каждого запроса к справке, оценкам, ДЗ или броням
        владелец проверяется по токену на сервере. Подмена номера заявки в адресной строке даёт мгновенный отказ <code>403 Forbidden</code>.
      </p>
    </div>
    <div class="card">
      <h4><span class="badge badge-sec">Секреты</span> Где лежат ключи и как устроен деплой</h4>
      <p>
        Секрет подписи токенов (<code>JWT_SECRET</code>) и ключи ИИ (<code>AI_API_KEY</code>) хранятся исключительно в переменных окружения на сервере
        (<code>process.env</code>) и не имеют префикса <code>NEXT_PUBLIC_</code>, поэтому они никогда не попадают в код браузера.
      </p>
    </div>
  </div>

  <!-- 8. ЭТАПЫ, ПРОДЕЛАННЫЕ ВРУЧНУЮ -->
  <h2>7. Этапы и инженерные решения, выполненные вручную</h2>
  <ul>
    <li><strong>Продуктовая концепция и критерии конкурса:</strong> формулирование сценариев трёх контуров, матрицы ролей (Студент / Преподаватель / Деканат) и интерактивного IDOR-стенда для демонстрации жюри.</li>
    <li><strong>Проектирование и ревью SDD-спецификаций:</strong> утверждение контрактов в <code>/specs</code>, единой шкалы БРС и строгих анти-вайбкод правил до старта генерации кода.</li>
    <li><strong>Оркестрация и интеграция веток:</strong> разделение работы между параллельными субагентами, разрешение конфликтов слияния, интеграция обновлений V2 и V3 на GitHub без потери аудиторских правок.</li>
    <li><strong>Ручное тестирование 5 ролей:</strong> сквозная проверка переходов, сдачи и оценки ДЗ, чатов, бронирований и вёрстки на ширине <code>360 px</code> в светлой и тёмной темах.</li>
    <li><strong>Production-упаковка и деплой:</strong> настройка <code>Dockerfile</code> (Alpine + OpenSSL для Prisma 6), <code>docker-compose.yml</code> с именованным томом SQLite, healthcheck и развёртывание на российском хостинге.</li>
  </ul>

</body>
</html>`;
}

async function exportPdf(html) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.pdf({
      path: PDF_PATH,
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  const server = await ensureServer();
  try {
    await captureScreenshots();
    console.log('⟳ Генерация HTML и экспорт в PDF…');
    const html = await buildHtml();
    await exportPdf(html);
    const stat = await fs.stat(PDF_PATH);
    const kb = Math.round(stat.size / 1024);
    console.log(`✓ Готово! Создан ${PDF_PATH} (${kb} КБ)`);
    if (kb < 500) {
      console.warn(`⚠ Размер файла (${kb} КБ) меньше 500 КБ — проверьте скриншоты!`);
    }
  } finally {
    await server.stop();
  }
}

main().catch((err) => {
  console.error('Ошибка генерации отчёта:', err);
  process.exit(1);
});
