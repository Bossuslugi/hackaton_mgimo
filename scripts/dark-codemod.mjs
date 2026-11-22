#!/usr/bin/env node
/**
 * Obsidian Dark codemod — specs/02_DESIGN_SYSTEM.md §2.6.
 *
 * Для каждого светлого цветового класса (bg-white, text-slate-600, border-slate-200, hover:bg-slate-50 …)
 * добавляет парный `dark:`-класс по таблице токенов. Идемпотентен: если в той же строке классов уже есть
 * `dark:<варианты><свойство>-<цвет>`, токен пропускается — ручные dark-переопределения имеют приоритет.
 *
 *   node scripts/dark-codemod.mjs            # применить ко всем src/app/**, src/components/** (кроме src/app/api)
 *   node scripts/dark-codemod.mjs --check    # только показать, какие файлы изменились бы (exit 1, если есть)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const TARGETS = ['src/app', 'src/components'];
// src/components/pitch — презентация /pitch: всегда Obsidian Dark с явными цветами (и в PDF), бланк справки на ней намеренно светлый
const SKIP = [join('src', 'app', 'api'), join('src', 'components', 'pitch')];
const CHECK = process.argv.includes('--check');

/** prop-группа → (цвет → dark-цвет). null — не трогать. */
const BG = {
  white: '[#12141A]',
  'slate-50': 'zinc-900',
  'slate-100': 'zinc-800',
  'slate-200': 'zinc-700',
  'slate-300': 'zinc-600',
  'slate-400': 'zinc-500',
  'slate-500': 'zinc-400',
  'slate-800': 'zinc-200',
  'slate-900': 'zinc-100',
  'blue-50': 'blue-500/10',
  'blue-100': 'blue-500/20',
  'blue-600': 'blue-500',
  'blue-700': 'blue-600',
  'emerald-50': 'emerald-950/60',
  'emerald-100': 'emerald-900/50',
  'amber-50': 'amber-950/60',
  'amber-100': 'amber-900/50',
  'red-50': 'red-950/60',
  'red-100': 'red-900/50',
  'red-200': 'red-800/60',
  'amber-200': 'amber-800/60',
  'emerald-200': 'emerald-800/60',
};
const TEXT = {
  'slate-950': 'zinc-50',
  'slate-900': 'zinc-50',
  'slate-800': 'zinc-100',
  'slate-700': 'zinc-300',
  'slate-600': 'zinc-400',
  'slate-500': 'zinc-400',
  'slate-400': 'zinc-500',
  'slate-300': 'zinc-600',
  'blue-600': 'blue-400',
  'blue-700': 'blue-400',
  'blue-800': 'blue-300',
  'emerald-600': 'emerald-400',
  'emerald-700': 'emerald-300',
  'emerald-800': 'emerald-200',
  'amber-600': 'amber-400',
  'amber-700': 'amber-300',
  'amber-800': 'amber-200',
  'red-600': 'red-400',
  'red-700': 'red-300',
  'red-800': 'red-200',
};
const BORDER = {
  white: 'zinc-900',
  'slate-100': 'zinc-800',
  'slate-200': 'zinc-800',
  'slate-300': 'zinc-700',
  'slate-400': 'zinc-600',
  'slate-900': 'zinc-100',
  'blue-200': 'blue-500/30',
  'blue-300': 'blue-500/50',
  'blue-600': 'blue-500',
  'blue-700': 'blue-400',
  'emerald-200': 'emerald-800/60',
  'emerald-300': 'emerald-700/60',
  'amber-200': 'amber-800/60',
  'amber-300': 'amber-700/60',
  'red-200': 'red-800/60',
  'red-300': 'red-700/60',
};
const MAPS = {
  bg: BG,
  text: TEXT,
  placeholder: TEXT,
  fill: TEXT,
  stroke: TEXT,
  border: BORDER,
  divide: BORDER,
  ring: BORDER,
  outline: BORDER,
};

const COLOR = '(white|black|(?:slate|blue|emerald|amber|red)-\\d{2,3})';
const TOKEN = new RegExp(
  `(?<![\\w:/\\[-])((?:[a-z0-9-]+(?:\\[[^\\]\\s'"\`]+\\])?:)*)(bg|text|placeholder|fill|stroke|border|divide|ring|outline)-((?:[trblxyse]-)?)${COLOR}(\\/\\d+)?(?![\\w-])`,
  'g',
);

function darkValue(prop, color, opacity) {
  const table = MAPS[prop];
  if (!table) return null;
  if (prop === 'bg' && color === 'white' && opacity) return 'zinc-950/85';
  if (prop === 'bg' && color === 'slate-900' && opacity) return `black/${Math.min(80, Number(opacity.slice(1)) + 20)}`;
  const v = table[color];
  if (!v) return null;
  if (opacity && !v.includes('/') && !v.startsWith('[')) return v + opacity;
  return v;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Если offset внутри вызова cn(…), вернуть границы всего вызова — это одна «строка классов». */
function cnRange(src, offset) {
  let i = src.lastIndexOf('cn(', offset);
  while (i !== -1) {
    let depth = 0;
    for (let j = i + 2; j < src.length; j++) {
      const ch = src[j];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          if (j > offset) return [i, j];
          break;
        }
      }
    }
    i = src.lastIndexOf('cn(', i - 1);
    if (i !== -1 && offset - i > 4000) return null;
  }
  return null;
}

/** Границы строкового литерала вокруг offset. */
function literalRange(src, offset) {
  const before = src.slice(0, offset);
  const start = Math.max(before.lastIndexOf("'"), before.lastIndexOf('"'), before.lastIndexOf('`'), before.lastIndexOf('{'));
  const rest = src.slice(offset);
  const endRel = rest.search(/['"`}]/);
  return [start + 1, endRel === -1 ? src.length : offset + endRel];
}

/**
 * Область поиска парного dark-класса: сам литерал + соседние литералы того же cn(…),
 * состоящие только из dark:-классов («dark-компаньон», как в ThemeToggle/CodeEditor).
 * Ветки тернарника (смесь светлых и тёмных классов) в область не входят.
 */
function scopeOf(src, offset) {
  const [a, b] = literalRange(src, offset);
  const own = src.slice(a, offset) + '\u0000' + src.slice(offset, b);
  const cn = cnRange(src, offset);
  if (!cn) return own;
  const companions = (src.slice(cn[0], cn[1]).match(/'[^'\n]*'/g) ?? [])
    .map((s) => s.slice(1, -1).trim())
    .filter((s) => s && s.split(/\s+/).every((t) => t.startsWith('dark:')));
  return [own, ...companions].join(' ');
}

const keyRe = (variants, prop, side) =>
  `dark:${esc(variants)}${prop}-${esc(side)}(?:white|black|zinc|slate|blue|emerald|amber|red|teal|transparent|\\[)`;

function transform(src) {
  let changed = false;
  const out = src.replace(TOKEN, (match, variants, prop, side, color, opacity, offset, whole) => {
    if (variants.includes('dark:') || variants.includes('print:')) return match;
    const dv = darkValue(prop, color, opacity);
    if (!dv) return match;
    const scope = scopeOf(whole, offset).replace(match, '');
    if (new RegExp(keyRe(variants, prop, side)).test(scope)) return match;
    changed = true;
    return `${match} dark:${variants}${prop}-${side}${dv}`;
  });
  return { out, changed };
}

/**
 * Убирает dark-класс, вставленный сразу после светлого, если в той же строке классов
 * уже есть ручной dark-класс того же свойства (ручной имеет приоритет).
 */
const INSERTED = new RegExp(
  `(?<![\\w:/\\[-])((?:[a-z0-9-]+(?:\\[[^\\]\\s'"\`]+\\])?:)*)(bg|text|placeholder|fill|stroke|border|divide|ring|outline)-((?:[trblxyse]-)?)${COLOR}(\\/\\d+)? dark:(\\1)(\\2)-(\\3)([\\w\\[\\]#/.-]+)`,
  'g',
);

function dedupe(src) {
  let changed = false;
  const out = src.replace(INSERTED, (match, variants, prop, side, _c, _o, _v2, _p2, _s2, _val, offset, whole) => {
    const lightEnd = match.indexOf(' dark:');
    const scope = scopeOf(whole, offset).replace(match, '');
    if (!new RegExp(keyRe(variants, prop, side)).test(scope)) return match;
    changed = true;
    return match.slice(0, lightEnd);
  });
  return { out, changed };
}

function walk(dir, acc) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.some((s) => relative(ROOT, p).startsWith(s))) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (p.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

const files = TARGETS.flatMap((t) => walk(join(ROOT, t), []));
const touched = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const d = dedupe(src);
  const t = transform(d.out);
  const out = t.out;
  const changed = d.changed || t.changed;
  if (changed) {
    touched.push(relative(ROOT, f).split(sep).join('/'));
    if (!CHECK) writeFileSync(f, out);
  }
}
console.log(`${CHECK ? 'Нужны dark-классы' : 'Обновлено'}: ${touched.length} файл(ов)`);
for (const t of touched) console.log('  ' + t);
if (CHECK && touched.length) process.exit(1);
