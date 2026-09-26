/**
 * VFX 注册表（DESIGN.md 5.4 / 6.3）。
 * 拓展特效 = 加一个条目（emoji + css 类名，css 写在 theme.css 或组件样式），不改框架。
 * mod 的 PresentSpec.vfx 填这里的 key；未知 key 优雅降级为无特效。
 */
export interface VfxDef {
  /** 单位卡上应用的动画类 */
  cls: string;
  /** 右上角弹出的符号（可空） */
  emoji?: string;
}

export const VFX_REGISTRY: Record<string, VfxDef> = {
  hit: { cls: 'vfx-hit', emoji: '💢' },
  'crit-flash': { cls: 'vfx-crit', emoji: '💥' },
  miss: { cls: 'vfx-miss', emoji: '❓' },
  heal: { cls: 'vfx-heal', emoji: '💚' },
  buff: { cls: 'vfx-buff', emoji: '✨' },
  debuff: { cls: 'vfx-debuff', emoji: '🌀' },
  slash: { cls: '', emoji: '⚔️' },
  fireball: { cls: '', emoji: '🔥' },
  frost: { cls: '', emoji: '❄️' },
  poison: { cls: '', emoji: '🧪' },
  stun: { cls: '', emoji: '💫' },
  meteor: { cls: '', emoji: '☄️' },
  ko: { cls: 'vfx-ko', emoji: '☠️' },
  revive: { cls: 'vfx-revive', emoji: '🔥' },
  'aura-gold': { cls: 'vfx-buff', emoji: '🌟' },
  stage: { cls: 'vfx-stage' },
};

export function getVfx(id: string): VfxDef | undefined {
  return VFX_REGISTRY[id];
}
