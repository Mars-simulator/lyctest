const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * 转义 HTML 特殊字符（纵深防御的辅助手段）。
 * 注意：XSS 的第一道防线是「输出编码 + CSP + nosniff」，
 * 纯 JSON API 里主要依赖客户端的输出编码，这里仅在必要时使用。
 */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => HTML_ENTITY_MAP[char] ?? char);
}

/**
 * 移除控制字符并去除首尾空白。
 * 用于防止日志注入、不可见字符绕过校验等问题。
 */
export function stripControlChars(input: string): string {
  let result = '';
  for (const char of input) {
    const code = char.codePointAt(0) ?? 0;
    // 保留可打印字符，剔除 C0/C1 控制字符
    if (code >= 0x20 && code !== 0x7f) {
      result += char;
    }
  }
  return result.trim();
}
