/**
 * 名字校验（拒绝制）：不合法直接报错，绝不静默转换。
 * 规则（DESIGN.md 5.1）：
 * - 取首尾空格后校验
 * - 长度 1~16 个 Unicode 码点
 * - 只允许：半角英文字母（大小写敏感）、半角数字、CJK 汉字
 * - 禁止：换行、空格、任何符号、全角英文/数字
 */

export type NameValidation = { ok: true; name: string } | { ok: false; reason: string };

export const NAME_MAX_LEN = 16;

const ASCII_ALNUM = /^[A-Za-z0-9]$/;
const HAN = /\p{Script=Han}/u;

export function validateName(input: string): NameValidation {
  const name = input.trim();
  if (name.length === 0) {
    return { ok: false, reason: '名字不能为空' };
  }
  const chars = [...name];
  if (chars.length > NAME_MAX_LEN) {
    return { ok: false, reason: `名字最长 ${NAME_MAX_LEN} 个字符` };
  }
  for (const ch of chars) {
    if (ASCII_ALNUM.test(ch)) continue;
    if (HAN.test(ch)) continue;
    if (/\s/.test(ch)) {
      return { ok: false, reason: '名字中间不能有空格或换行' };
    }
    return { ok: false, reason: `「${ch}」不是合法字符：只允许英文、数字（半角）和中文` };
  }
  return { ok: true, name };
}
