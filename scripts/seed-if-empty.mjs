import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const count = await prisma.user.count();
  if (count === 0) {
    console.log('⟳ База пуста — выполняем первичное заполнение демо-данными…');
    execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'prisma/seed.ts'], {
      stdio: 'inherit',
    });
  } else {
    console.log(`✓ В базе уже есть ${count} пользователей — сохраняем существующие данные.`);
  }
} finally {
  await prisma.$disconnect();
}
