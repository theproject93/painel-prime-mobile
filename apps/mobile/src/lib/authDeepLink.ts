/**
 * Validação de segurança para deep links de autenticação e verificação de telefone (OTP).
 * Impede injeção de links forjados, phishing ou envio automático de OTPs a partir de fontes não autorizadas.
 */

function isAllowedPath(path: string): boolean {
  const normalized = path.toLowerCase().replace(/\/+$/u, '') || '/';
  return normalized === '/signup' || normalized === '/cadastro' || normalized === '/login'
    || normalized === '/auth' || normalized.startsWith('/auth/');
}

export function isAllowedAuthDeepLink(urlStr: string | null | undefined): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const trimmed = urlStr.trim();
    if (!trimmed) return false;

    // Deep links HTTPS oficiais do produto
    if (trimmed.startsWith('https://')) {
      const parsed = new URL(trimmed);
      if (parsed.username || parsed.password || parsed.port) return false;
      const host = parsed.hostname.toLowerCase();
      const isAllowedHost =
        host === 'painelprime.com.br' ||
        host === 'app.painelprime.com.br' ||
        host === 'www.painelprime.com.br' ||
        host === 'www.app.painelprime.com.br';
      if (!isAllowedHost) return false;

      return isAllowedPath(parsed.pathname);
    }

    // Custom scheme nativo do app: painelprime://
    if (trimmed.startsWith('painelprime://')) {
      const parsed = new URL(trimmed);
      const host = (parsed.hostname || '').toLowerCase();
      const path = parsed.pathname || '';

      return !parsed.username && !parsed.password && !parsed.port && (
        host === 'signup' ||
        host === 'cadastro' ||
        host === 'auth' ||
        host === 'aceitar-convite' ||
        isAllowedPath(path)
      );
    }

    return false;
  } catch {
    return false;
  }
}
