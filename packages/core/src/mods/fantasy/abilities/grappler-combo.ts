import { defineSkill } from './define';

/** 格斗家被动：连招系统——连击数每 Hit 攻击 +3%（上限 +60%），被闪避清零，跨行动累计（Q11/F11） */
export default defineSkill({
  id: 'grappler-combo',
  name: '连击心得',
  kind: 'passive',
  cost: 7,
  weight: 0,
  desc: '独特的连招系统：连击数每 Hit 使攻击 +3%（最高 +60%）；攻击被闪避时连击清零。',
  passive: {
    modifyDamageOut(ctx, self, amount) {
      const combo = (self.meta['combo'] as number | undefined) ?? 0;
      return amount * (1 + Math.min(0.6, combo * 0.03));
    },
  },
});
