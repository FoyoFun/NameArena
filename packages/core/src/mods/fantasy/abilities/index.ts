import type { SkillDef } from '../types';
import { defineSkill } from './define';

// 职业（v2 起 11 职业全部就位）
import knightOath from './knight-oath';
import knightThrust from './knight-thrust';
import warriorBloodthirst from './warrior-bloodthirst';
import warriorBloodstrike from './warrior-bloodstrike';
import swordsmanRiposte from './swordsman-riposte';
import swordsmanSlash from './swordsman-slash';
import grapplerCombo from './grappler-combo';
import grapplerBarrage from './grappler-barrage';
import assassinInstinct from './assassin-instinct';
import assassinVenom from './assassin-venom';
import hunterMark from './hunter-mark';
import hunterCall from './hunter-call';
import bardSong from './bard-song';
import bardHymn from './bard-hymn';
import dancerSteps from './dancer-steps';
import dancerInspire from './dancer-inspire';
import blackmageSwelling from './blackmage-swelling';
import blackmageFlare from './blackmage-flare';
import apothecaryPharmacy from './apothecary-pharmacy';
import apothecaryElixir from './apothecary-elixir';
import whitemageGrace from './whitemage-grace';
import whitemageSmite from './whitemage-smite';

// 技能池
import poolPoisonStrike from './pool-poison-strike';
import poolRend from './pool-rend';
import poolVampiricFang from './pool-vampiric-fang';
import poolScorch from './pool-scorch';
import poolGlaciate from './pool-glaciate';
import poolHealLight from './pool-heal-light';
import poolBlessing from './pool-blessing';
import poolRejuvenation from './pool-rejuvenation';
import poolSkullCracker from './pool-skull-cracker';
import poolDoubleStrike from './pool-double-strike';
import poolSwiftChant from './pool-swift-chant';
import poolPhoenixWill from './pool-phoenix-will';

// 召唤物与副本
import houndBite from './hound-bite';
import { COPY_SKILLS } from './copies';

/**
 * 技能注册表：一个技能一个文件（沿 normal 惯例）。
 * 新增技能 = 新建文件 + 在下面列表加一行。
 */
const ALL: SkillDef[] = [
  // 职业
  knightOath,
  knightThrust,
  warriorBloodthirst,
  warriorBloodstrike,
  swordsmanRiposte,
  swordsmanSlash,
  grapplerCombo,
  grapplerBarrage,
  assassinInstinct,
  assassinVenom,
  hunterMark,
  hunterCall,
  bardSong,
  bardHymn,
  dancerSteps,
  dancerInspire,
  blackmageSwelling,
  blackmageFlare,
  apothecaryPharmacy,
  apothecaryElixir,
  whitemageGrace,
  whitemageSmite,
  // 技能池
  poolPoisonStrike,
  poolRend,
  poolVampiricFang,
  poolScorch,
  poolGlaciate,
  poolHealLight,
  poolBlessing,
  poolRejuvenation,
  poolSkullCracker,
  poolDoubleStrike,
  poolSwiftChant,
  poolPhoenixWill,
  // 召唤物
  houndBite,
  // 职业技能副本
  ...COPY_SKILLS,
];

export const SKILL_LIST: SkillDef[] = ALL;
export const SKILL_MAP = new Map(ALL.map((s) => [s.id, s]));
/** 抽取池：weight > 0（职业技能与宠物技能 weight=0 自动排除） */
export const SKILL_POOL: SkillDef[] = ALL.filter((s) => s.weight > 0);

export function getSkill(id: string): SkillDef | undefined {
  return SKILL_MAP.get(id);
}

export { defineSkill };
