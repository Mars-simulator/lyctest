import type { IncomingMessage, ServerResponse } from 'node:http';

/** 纯 JSON API 不加载任何资源，CSP 可以收紧到最严格 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function isHttps(req: IncomingMessage): boolean {
  const forwardedProto = req.headers['x-forwarded-proto'];
  return forwardedProto === 'https' || (req.socket as { encrypted?: boolean }).encrypted === true;
}

/**
 * 安全响应头中间件（等价于 helmet 的核心项，零依赖实现）。
 * @see https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Content-Security-Policy
 */
export function securityHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): void {
  // 禁止浏览器猜测 MIME 类型：即使响应体被注入也不会被当成脚本执行
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // 禁止被 iframe 嵌套，防点击劫持
  res.setHeader('X-Frame-Options', 'DENY');
  // 内容安全策略：禁止加载任何外部资源、禁止嵌套、禁止表单提交
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  // 不把完整 URL 作为 Referer 泄露给第三方
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  // 关闭用不到的浏览器能力
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  // HSTS 仅在 HTTPS 下有意义，避免明文环境误下发导致后续无法访问
  if (isHttps(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}
