import { defineSkill } from './define';

/**
 * 猎人主动（F51）：一场对局只能召唤一次；已召唤过后技能退化为一次 0.9 倍的亲自打击。
 * 另受通用限制：自己的猎犬还活着时无法再召（同种召唤物场上唯一）。
 */
export default defineSkill({
  id: 'hunter-call',
  name: '呼唤猎犬',
  kind: 'active',
  label: 'common',
  cost: 8,
  weight: 0,
  desc: '召唤一头猎犬参战（每场限一次）。猎犬无视仇恨，永远攻击易伤最多的敌人。已召唤过后，此技能改为对敌人猛烈一击（0.9 倍伤害）。',
  vfx: 'buff',
  active: {
    target: 'self',
    summonFallback: { scale: 0.9 },
    effects: [{ type: 'summon', pet: 'hound' }],
  },
});
