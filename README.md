# Орбита — цифровой деканат будущего

> Конкурсный веб-прототип учебного пространства студента, кабинета преподавателя и цифрового деканата. Не является официальным сервисом вуза; все персональные данные вымышленные.

## Стек

- **Frontend / Full-Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend / БД:** Prisma 6, SQLite, Zod, `jose` (JWT в `HttpOnly` cookie), `bcryptjs`

---

## Запуск через Docker Compose

Готовая production-конфигурация с автоматической миграцией схемы, заполнением демо-данных и сохранением базы SQLite в именованном томе `orbita_sqlite_data`:

```bash
# Сборка образа и запуск контейнера в фоновом режиме
docker compose up --build -d

# Просмотр логов запуска и работы приложения
docker compose logs -f orbita

# Остановка и удаление контейнера (данные в volume сохраняются)
docker compose down
```

После запуска приложение будет доступно по адресу `http://localhost:3000`.

При необходимости можно переопределить переменные окружения (`JWT_SECRET`, `AI_API_KEY`, `AI_BASE_URL`) через файл `.env` в корне проекта перед запуском.

---

## Локальный запуск для разработки

```bash
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

## Демо-аккаунты

| Роль | Email | Пароль |
|------|-------|--------|
| Студент (М3203) | `alexey.sokolov@edu.orbita.ru` | `Student2026!` |
| Студентка (Э4102) | `maria.kuznetsova@edu.orbita.ru` | `Student2026!` |
| Студент (М3203) | `dmitry.orlov@edu.orbita.ru` | `Student2026!` |
| Преподаватель | `volkov.igor@edu.orbita.ru` | `Teacher2026!` |
| Деканат | `dekanat@edu.orbita.ru` | `Admin2026!` |
