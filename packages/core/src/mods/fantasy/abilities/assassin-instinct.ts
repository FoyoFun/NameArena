import { defineSkill } from './define';
import { favor } from '../rules/combat';

const CHANCE = 0.4;

/** 刺客被动：概率使仇恨值越低的敌人越容易被选为目标（反仇恨索敌，F12） */
export default defineSkill({
  id: 'assassin-instinct',
  name: '猎杀直觉',
  kind: 'passive',
  cost: 6,
  weight: 0,
  desc: `每次索敌时，${Math.round(CHANCE * 100)}% 概率无视仇恨、直取敌方仇恨最低的目标。`,
  passive: {
    useInverseTargeting(ctx, self) {
      return ctx.rng.chance(favor(ctx, self, CHANCE));
    },
  },
});
