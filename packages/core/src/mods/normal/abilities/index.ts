import type { AbilityDef } from '../types';
import { defineAbility } from './define';

import basicAttack from './basic-attack';
import heavySlash from './heavy-slash';
import fireball from './fireball';
import frostArrow from './frost-arrow';
import poisonBlade from './poison-blade';
import stunHammer from './stun-hammer';
import meteorSwarm from './meteor-swarm';
import healWave from './heal-wave';
import warCry from './war-cry';

import faithOfPower from './faith-of-power';
import rockSolid from './rock-solid';
import swiftFooted from './swift-footed';
import keenEye from './keen-eye';
import berserk from './berserk';
import lifeSteal from './life-steal';
import thorns from './thorns';
import doubleAction from './double-action';
import hpOvercharge from './hp-overcharge';
import phoenix from './phoenix';

import agileDodge from './agile-dodge';
import wildInstinct from './wild-instinct';
import lightFeather from './light-feather';
import pureHeart from './pure-heart';
import stillMountain from './still-mountain';
import desperateStand from './desperate-stand';
import bruteForce from './brute-force';
import arcaneMaster from './arcane-master';
import ironWall from './iron-wall';
import mindBarrier from './mind-barrier';
import godspeed from './godspeed';
import destinyChild from './destiny-child';
import zhongyong from './zhongyong';
import straightFive from './straight-five';
import balancedSix from './balanced-six';

/**
 * 能力注册表：一个能力一个文件（DESIGN.md 7.5）。
 * 新增能力 = 新建文件 + 在下面的列表里加一行。
 */
const ALL: AbilityDef[] = [
  basicAttack,
  // 主动
  heavySlash,
  fireball,
  frostArrow,
  poisonBlade,
  stunHammer,
  meteorSwarm,
  healWave,
  warCry,
  // 被动
  faithOfPower,
  rockSolid,
  swiftFooted,
  keenEye,
  berserk,
  lifeSteal,
  thorns,
  // 机制系
  doubleAction,
  hpOvercharge,
  phoenix,
  // 条件能力（档位补偿/超凡）
  agileDodge,
  wildInstinct,
  lightFeather,
  pureHeart,
  stillMountain,
  desperateStand,
  bruteForce,
  arcaneMaster,
  ironWall,
  mindBarrier,
  godspeed,
  destinyChild,
  // 条件能力（图案彩蛋）
  zhongyong,
  straightFive,
  balancedSix,
];

export const ABILITY_LIST: AbilityDef[] = ALL;
export const ABILITY_MAP = new Map(ALL.map((a) => [a.id, a]));

export const BASIC_ATTACK_ID = 'basic-attack';

export function getAbility(id: string): AbilityDef | undefined {
  return ABILITY_MAP.get(id);
}

export { defineAbility };
