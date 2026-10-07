import { defineSkill } from './define';
import type { SkillDef } from '../types';
import knightOath from './knight-oath';
import warriorBloodthirst from './warrior-bloodthirst';
import assassinInstinct from './assassin-instinct';
import blackmageSwelling from './blackmage-swelling';
import apothecaryPharmacy from './apothecary-pharmacy';
import whitemageGrace from './whitemage-grace';
import swordsmanRiposte from './swordsman-riposte';
import grapplerCombo from './grappler-combo';
import hunterMark from './hunter-mark';
import bardSong from './bard-song';
import dancerSteps from './dancer-steps';
import poolHealLight from './pool-heal-light';
import poolVampiricFang from './pool-vampiric-fang';
import poolSkullCracker from './pool-skull-cracker';
import swordsmanSlash from './swordsman-slash';
import grapplerBarrage from './grappler-barrage';
import hunterCall from './hunter-call';
import bardHymn from './bard-hymn';
import dancerInspire from './dancer-inspire';

/**
 * 职业技能副本（DESIGN-FANTASY.md §3.4）：与职业技能同效果但不同 id，
 * 可与职业技能叠加持有、分别判定（主人裁定：可能反击/触发两次）。
 * v2 起全部 11 职业的被动与主动均有副本入池。
 */
function copyOf(orig: SkillDef): SkillDef {
  return defineSkill({ ...orig, id: `${orig.id}-copy`, name: `${orig.name}·抄本`, weight: 1, desc: `${orig.desc}（可与同名职业技能叠加判定）` });
}

const PASSIVE_ORIGINS = [
  knightOath,
  warriorBloodthirst,
  assassinInstinct,
  blackmageSwelling,
  apothecaryPharmacy,
  whitemageGrace,
  swordsmanRiposte,
  grapplerCombo,
  hunterMark,
  bardSong,
  dancerSteps,
];
const ACTIVE_ORIGINS = [poolHealLight, poolVampiricFang, poolSkullCracker, swordsmanSlash, grapplerBarrage, hunterCall, bardHymn, dancerInspire];

export const COPY_SKILLS: SkillDef[] = [...PASSIVE_ORIGINS, ...ACTIVE_ORIGINS].map(copyOf);
