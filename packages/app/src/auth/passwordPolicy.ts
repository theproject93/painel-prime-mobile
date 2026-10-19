/**
 * Política unificada de senhas e proteção contra senhas fracas ou vazadas.
 */

const COMMON_WEAK_PASSWORDS = new Set([
  '1234567890',
  '1234567890a',
  '1234567890aA',
  'password123',
  'Password123',
  'Password123!',
  'Password1234',
  'Password12345',
  'senha123456',
  'Senha123456',
  'Senha123456!',
  'painelprime123',
  'PainelPrime123',
  'admin123456',
  'Admin123456',
  'qwertyuiop1',
  'Qwertyuiop1',
  'brasil2026!',
  'Brasil2026',
  'Brasil2026!',
]);

/**
 * Valida os requisitos de força da senha:
 * - Pelo menos 10 caracteres
 * - Pelo menos uma letra minúscula
 * - Pelo menos uma letra maiúscula
 * - Pelo menos um número
 * - Não pode constar na lista de senhas fracas comuns
 */
export function validateStrongPassword(password: string): string | null {
  if (!password || password.length < 10) {
    return 'Use uma senha com pelo menos 10 caracteres.';
  }

  const normalized = password.toLowerCase().trim();
  if (COMMON_WEAK_PASSWORDS.has(password) || COMMON_WEAK_PASSWORDS.has(normalized)) {
    return 'Essa senha é muito comum e insegura. Escolha uma senha mais forte e exclusiva.';
  }

  if (!/[a-z]/.test(password)) {
    return 'Sua senha precisa ter pelo menos uma letra minúscula.';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Sua senha precisa ter pelo menos uma letra maiúscula.';
  }

  if (!/\d/.test(password)) {
    return 'Sua senha precisa ter pelo menos um número.';
  }

  return null;
}

/**
 * Alias retrocompatível com validateSignupPassword
 */
export const validateSignupPassword = validateStrongPassword;

/**
 * Verifica se a senha já foi exposta em violações de dados conhecidas
 * utilizando a API k-Anonymity do Have I Been Pwned (Pwned Passwords).
 * Retorna true se a senha foi encontrada em vazamentos, false caso contrário.
 */
export async function checkPwnedPassword(password: string): Promise<boolean> {
  if (!password || typeof crypto === 'undefined' || !crypto.subtle) {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return false;
    }

    const text = await response.text();
    const regex = new RegExp(`^${suffix}:`, 'm');
    return regex.test(text);
  } catch {
    // Fail-open gracioso se a rede estiver offline ou a API externa indisponível
    return false;
  }
}
