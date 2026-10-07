import { defineSkill } from './define';

/** 猎人主动：召唤一头猎犬（不占队伍人数、受 24 上限；猎犬永远优先攻击易伤最多的敌人） */
export default defineSkill({
  id: 'hunter-call',
  name: '呼唤猎犬',
  kind: 'active',
  label: 'common',
  cost: 8,
  weight: 0,
  desc: '召唤一头猎犬参战（场上满 24 单位时召唤失败）。猎犬无视仇恨，永远攻击易伤最多的敌人。',
  vfx: 'buff',
  active: {
    target: 'self',
    effects: [{ type: 'summon', pet: 'hound' }],
  },
});
