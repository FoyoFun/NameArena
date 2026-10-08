/**
 * 图标生成器（决策 #58）：从 game-icons.net 图标库提取选中图标，
 * 去掉黑色底块（`M0 0h512v512H0z`），白色填充改为继承（currentColor），
 * 输出 apps/web/src/icons.ts。
 *
 * 用法：node scripts/gen-icons.mjs <iconsRoot> [作者/图标名 ...]
 * iconsRoot 即下载包的 1x1 目录（含 lorc/ delapouite/ 等作者子目录）。
 * 不带图标名参数时输出 ICONS 清单里全部图标。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** 语义名 → [作者, 图标文件名]（icons.ts 里的键 = 语义名） */
const ICONS = {
  // 导航
  lab: ['delapouite', 'spell-book'],
  team: ['delapouite', 'meeple-group'],
  arena: ['sbed', 'arena'],
  swords: ['lorc', 'crossed-swords'],
  report: ['lorc', 'scroll-unfurled'],
  ladder: ['delapouite', 'podium-winner'],
  // 六维
  str: ['lorc', 'muscle-up'],
  vit: ['sbed', 'health-normal'],
  int: ['lorc', 'brain'],
  spr: ['lorc', 'psychic-waves'],
  agi: ['delapouite', 'running-shoe'],
  luk: ['lorc', 'clover'],
  // 职业
  knight: ['delapouite', 'black-knight-helm'],
  warrior: ['delapouite', 'chest-armor'],
  assassin: ['darkzaitzev', 'hooded-assassin'],
  blackmage: ['delapouite', 'wizard-face'],
  apothecary: ['darkzaitzev', 'apothecary'],
  whitemage: ['delapouite', 'holy-water'],
  swordsman: ['cathelineau', 'swordman'],
  grappler: ['lorc', 'fist'],
  hunter: ['carl-olsen', 'crossbow'],
  bard: ['delapouite', 'harp'],
  dancer: ['delapouite', 'ballerina-shoes'],
  // UI 通用
  play: ['guard13007', 'play-button'],
  pause: ['guard13007', 'pause-button'],
  skip: ['delapouite', 'player-next'],
  speed: ['delapouite', 'fast-forward-button'],
  sparkles: ['delapouite', 'sparkles'],
  dice: ['delapouite', 'dice-six-faces-six'],
  cog: ['lorc', 'cog'],
  user: ['delapouite', 'portrait'],
  heart: ['delapouite', 'heart-beats'],
  mp: ['lorc', 'bubbling-flask'],
  refresh: ['delapouite', 'clockwise-rotation'],
  copy: ['delapouite', 'paper-clip'],
  check: ['delapouite', 'check-mark'],
  cross: ['lorc', 'cross-mark'],
  skull: ['lorc', 'crowned-skull'],
  trophy: ['delapouite', 'laurels-trophy'],
  clash: ['lorc', 'sword-clash'],
  squad: ['lorc', 'dark-squad'],
  expand: ['delapouite', 'expand'],
  clock: ['delapouite', 'alarm-clock'],
  potion: ['lorc', 'potion-ball'],
  book: ['delapouite', 'book-pile'],
};

const root = process.argv[2];
if (!root || !existsSync(root)) {
  console.error('用法：node scripts/gen-icons.mjs <iconsRoot 即 1x1 目录>');
  process.exit(1);
}

const out = {};
let missing = [];
for (const [key, [author, name]] of Object.entries(ICONS)) {
  const file = join(root, author, `${name}.svg`);
  if (!existsSync(file)) {
    missing.push(`${key} <- ${author}/${name}.svg`);
    continue;
  }
  const svg = readFileSync(file, 'utf8');
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>[\s\S]*$/, '')
    .replace(/<path d="M0 0h512v512H0z"\/>/g, '') // 黑色底块
    .replace(/fill="#fff"/g, '') // 白色填充 → 继承 currentColor
    .replace(/\s+/g, ' ')
    .trim();
  out[key] = inner;
}

if (missing.length) {
  console.error('缺少图标：\n' + missing.join('\n'));
  process.exit(1);
}

const ts = `/* ============================================================
   图标数据（自动生成，勿手改）——scripts/gen-icons.mjs
   来源 game-icons.net（CC BY 3.0，作者见 download 包 license.txt），
   已去底块、填充继承 currentColor。用法：
   <GameIcon name="swords" :size="16" />
   ============================================================ */

export const ICONS: Record<string, string> = {
${Object.entries(out)
  .map(([k, v]) => `  '${k}': '${v.replaceAll("'", "\\'")}',`)
  .join('\n')}
};

export type IconName = keyof typeof ICONS & string;
`;

const target = new URL('../apps/web/src/icons.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:');
writeFileSync(target, ts);
console.log(`已生成 ${target}（${Object.keys(out).length} 个图标）`);
