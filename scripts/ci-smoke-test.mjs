import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = process.env.SMOKE_PORT || '3100';
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = BASE;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function isUp() {
  try {
    const res = await fetch(`${BASE}/login`, { redirect: 'manual' });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function startServer() {
  const child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '-p', PORT, '-H', '127.0.0.1'],
    {
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        JWT_SECRET: process.env.JWT_SECRET || 'ci-smoke-test-secret-key-32-chars-min!',
        DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
      },
    },
  );

  let stderr = '';
  child.stderr?.on('data', (d) => {
    stderr += d.toString();
  });

  for (let i = 0; i < 40; i++) {
    if (await isUp()) return child;
    await sleep(500);
  }
  child.kill('SIGTERM');
  throw new Error(`Next.js server did not start on ${BASE}. stderr:\n${stderr}`);
}

async function req(path, { method = 'GET', body, cookie } = {}) {
  const headers = { origin: ORIGIN };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, json, text };
}

function extractCookie(headers) {
  const raw = headers.get('set-cookie') || '';
  const match = raw.match(/orbita_token=[^;]+/);
  return match ? match[0] : '';
}

async function runTests() {
  console.log('1. Проверка публичного /login и защиты API без сессии...');
  const loginPage = await req('/login');
  assert.equal(loginPage.status, 200, '/login должен возвращать 200');

  const unauth = await req('/api/requests');
  assert.equal(unauth.status, 401, 'GET /api/requests без токена должен возвращать 401');

  const badLogin = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'alexey.sokolov@edu.orbita.ru', password: 'WrongPassword!' },
  });
  assert.equal(badLogin.status, 401, 'Неверный пароль должен возвращать 401');

  console.log('2. Авторизация студента и проверка HttpOnly JWT...');
  const login = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'alexey.sokolov@edu.orbita.ru', password: 'Student2026!' },
  });
  assert.equal(login.status, 200, 'Вход студента должен возвращать 200');
  const studentCookie = extractCookie(login.headers);
  assert.ok(studentCookie.startsWith('orbita_token='), 'Должна выдаваться cookie orbita_token');

  const me = await req('/api/auth/me', { cookie: studentCookie });
  assert.equal(me.status, 200);
  assert.equal(me.json?.user?.email, 'alexey.sokolov@edu.orbita.ru');
  assert.equal(me.json?.user?.passwordHash, undefined, 'passwordHash не должен утекать в API');

  console.log('3. AppSec Anti-IDOR и RBAC проверки...');
  const idorOther = await req('/api/requests/3', { cookie: studentCookie });
  assert.equal(idorOther.status, 403, 'Чужая заявка #3 должна блокироваться с 403');

  const idorMissing = await req('/api/requests/99999', { cookie: studentCookie });
  assert.equal(idorMissing.status, 403, 'Несуществующая заявка #99999 должна возвращать 403 без оракула');

  const rbacTeacher = await req('/api/teacher/assignments', { cookie: studentCookie });
  assert.equal(rbacTeacher.status, 403, 'Студент не должен иметь доступ к /api/teacher/assignments');

  console.log('4. Бизнес-логика: дашборд, БРС, расписание, кампус, статистика, ИИ...');
  for (const ep of ['/api/dashboard', '/api/grades', '/api/schedule', '/api/campus/services', '/api/stats']) {
    const r = await req(ep, { cookie: studentCookie });
    assert.equal(r.status, 200, `${ep} должен возвращать 200`);
  }

  const ai = await req('/api/ai/chat', {
    method: 'POST',
    cookie: studentCookie,
    body: { message: 'Какой у меня средний балл?', mode: 'concierge' },
  });
  assert.equal(ai.status, 200, 'ИИ-консьерж должен отвечать в fallback-режиме');
  assert.ok(typeof ai.json?.reply === 'string' && ai.json.reply.length > 10);

  console.log('5. Сдача онлайн-ДЗ в V2 только текстом/кодом (без submissionUrl)...');
  const study = await req('/api/study', { cookie: studentCookie });
  assert.equal(study.status, 200);
  const todoTask = study.json?.assignments?.find((a) => a.status === 'TODO');
  assert.ok(todoTask, 'У студента должно быть хотя бы одно TODO-задание из сида');

  const submit = await req(`/api/study/assignments/${todoTask.id}/submit`, {
    method: 'POST',
    cookie: studentCookie,
    body: { solutionText: 'def check(s): return "YES"', studentComment: 'CI smoke test' },
  });
  assert.equal(submit.status, 200, 'Сдача только solutionText без URL должна проходить с 200');
  assert.equal(submit.json?.assignment?.status, 'SUBMITTED');

  console.log('6. Авторизация преподавателя и доступ к проверке работ...');
  const teacherLogin = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'volkov.igor@edu.orbita.ru', password: 'Teacher2026!' },
  });
  assert.equal(teacherLogin.status, 200);
  const teacherCookie = extractCookie(teacherLogin.headers);

  const teacherList = await req('/api/teacher/assignments', { cookie: teacherCookie });
  assert.equal(teacherList.status, 200, 'Преподаватель должен получать список своих заданий');
  assert.ok(Array.isArray(teacherList.json?.assignments));

  console.log('✓ Все 6 блоков smoke и AppSec тестов успешно пройдены!');
}

const server = await startServer();
try {
  await runTests();
} finally {
  server.kill('SIGTERM');
}
