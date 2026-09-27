import type { BossDef } from '../types';

/**
 * PVE Boss 数据（DESIGN.md 7.9）。固定六维 + 固定能力组，数值用 scripts/sim 校准。
 * 新增 Boss = 这里加一行。
 */
export const BOSSES: BossDef[] = [
  {
    id: 'slime-king',
    name: '史莱姆之王',
    title: '普通',
    base: { str: 62, wis: 40, vit: 70, spr: 50, agi: 45, luk: 50 },
    abilityIds: ['basic-attack', 'poison-blade', 'meteor-swarm', 'thorns', 'faith-of-power'],
    personalityId: 'steady',
    desc: '一只吃了太多冒险者的史莱姆。黏糊糊，但不好惹。',
  },
  {
    id: 'stone-golem',
    name: '岩石巨像',
    title: '困难',
    base: { str: 82, wis: 30, vit: 96, spr: 70, agi: 38, luk: 40 },
    abilityIds: ['basic-attack', 'stun-hammer', 'heavy-slash', 'thorns', 'rock-solid'],
    personalityId: 'steady',
    desc: '上古遗迹的守卫者。一锤下去，把你拍成饼。',
  },
  {
    id: 'void-devourer',
    name: '虚空吞噬者',
    title: '地狱',
    base: { str: 96, wis: 106, vit: 102, spr: 95, agi: 88, luk: 92 },
    abilityIds: ['basic-attack', 'fireball', 'meteor-swarm', 'double-action', 'life-steal', 'phoenix', 'keen-eye'],
    personalityId: 'aggressive',
    desc: '从世界裂缝里爬出来的东西。建议六个人一起上，再多也不嫌多。',
  },
];

export const BOSS_MAP = new Map(BOSSES.map((b) => [b.id, b]));
