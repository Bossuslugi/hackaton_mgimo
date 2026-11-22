FROM node:20-alpine

WORKDIR /app

# Системные зависимости для движка Prisma 6 в Alpine
RUN apk add --no-cache openssl libc6-compat

# Установка зависимостей (включая devDependencies: prisma, tsx, typescript для сборки и старта)
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Копирование исходного кода и генерация Prisma Client
COPY . .
RUN npx prisma generate

# Сборка production-бандла Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Директория для постоянного хранения базы SQLite
RUN mkdir -p /app/data

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx prisma/seed.ts && npm run start"]
