import bcrypt from 'bcryptjs';

const COST = 10;

/** bcrypt-хеш случайной строки — чтобы время ответа не выдавало, существует ли email. */
let dummyHash: string | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync(crypto.randomUUID(), COST));

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);

export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(plain, getDummyHash());
    return false;
  }
  return bcrypt.compare(plain, hash);
}
