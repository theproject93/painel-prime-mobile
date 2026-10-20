export function mapAuthErrorMessage(error: unknown): string {
  try {
    if (!error) {
      return 'Ocorreu um erro inesperado. Tente novamente.';
    }

    let rawMsg = '';
    let code = '';

    try {
      if (typeof error === 'string') {
        rawMsg = error.toLowerCase();
      } else if (error instanceof Error) {
        rawMsg = (error.message || '').toLowerCase();
      } else if (typeof error === 'object' && error !== null) {
        const potentialMsg = (error as { message?: unknown }).message;
        if (typeof potentialMsg === 'string') {
          rawMsg = potentialMsg.toLowerCase();
        } else if (typeof potentialMsg === 'number' || typeof potentialMsg === 'boolean') {
          rawMsg = String(potentialMsg).toLowerCase();
        } else {
          rawMsg = Object.prototype.toString.call(error).toLowerCase();
        }
      } else {
        rawMsg = String(error).toLowerCase();
      }
    } catch {
      rawMsg = '';
    }

    try {
      if (typeof error === 'object' && error !== null) {
        const potentialCode = (error as { code?: unknown }).code;
        if (typeof potentialCode === 'string') {
          code = potentialCode.toLowerCase();
        } else if (typeof potentialCode === 'number') {
          code = String(potentialCode).toLowerCase();
        }
      }
    } catch {
      code = '';
    }

    // 1. Falhas de Rede e Infraestrutura
    if (
      rawMsg.includes('network request failed') ||
      rawMsg.includes('failed to fetch') ||
      rawMsg.includes('networkerror') ||
      rawMsg.includes('abort') ||
      rawMsg.includes('econnrefused') ||
      rawMsg.includes('timeout') ||
      rawMsg.includes('internet_disconnected')
    ) {
      return 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.';
    }

    // 2. Erros de Credenciais
    if (
      code === 'invalid_credentials' ||
      code === 'invalid_grant' ||
      rawMsg.includes('invalid credentials') ||
      rawMsg.includes('invalid login credentials') ||
      rawMsg.includes('invalid_credentials') ||
      rawMsg.includes('invalid grant') ||
      rawMsg.includes('invalid password') ||
      rawMsg.includes('e-mail ou senha')
    ) {
      return 'E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.';
    }

    // 3. E-mail Não Confirmado
    if (
      code === 'email_not_confirmed' ||
      rawMsg.includes('email not confirmed') ||
      rawMsg.includes('email_not_confirmed') ||
      rawMsg.includes('unconfirmed')
    ) {
      return 'Seu e-mail ainda não foi confirmado. Verifique a caixa de entrada para ativar sua conta.';
    }

    // 4. Usuário Já Cadastrado
    if (
      code === 'user_already_exists' ||
      rawMsg.includes('user already registered') ||
      rawMsg.includes('user already exists') ||
      rawMsg.includes('user_already_exists') ||
      rawMsg.includes('already exists')
    ) {
      return 'Já existe uma conta com este e-mail. Toque em "Entrar" para acessar ou recupere sua senha.';
    }

    // 5. Rate Limit
    if (
      code === 'over_request_rate_limit' ||
      code === 'over_email_send_rate_limit' ||
      rawMsg.includes('rate limit') ||
      rawMsg.includes('over_request_rate_limit') ||
      rawMsg.includes('over_email_send_rate_limit') ||
      rawMsg.includes('too many requests')
    ) {
      return 'Muitas tentativas em pouco tempo. Por segurança, aguarde um minuto antes de tentar novamente.';
    }

    // 6. Senha Fraca
    if (
      code === 'weak_password' ||
      rawMsg.includes('weak_password') ||
      rawMsg.includes('password should be') ||
      rawMsg.includes('least 6 characters') ||
      rawMsg.includes('least 10 characters') ||
      rawMsg.includes('signup requires a valid password')
    ) {
      return 'A senha deve conter no mínimo 10 caracteres, combinando maiúsculas, minúsculas e números.';
    }

    // 7. E-mail Inválido
    if (
      code === 'email_address_invalid' ||
      rawMsg.includes('unable to validate email') ||
      rawMsg.includes('email_address_invalid') ||
      rawMsg.includes('invalid email') ||
      rawMsg.includes('provide either an email')
    ) {
      return 'Por favor, informe um endereço de e-mail válido.';
    }

    // 8. Token / Código de Recuperação expirado ou inválido
    if (
      code === 'otp_expired' ||
      rawMsg.includes('token has expired') ||
      rawMsg.includes('otp expired') ||
      rawMsg.includes('invalid token')
    ) {
      return 'O link de confirmação expirou ou é inválido. Solicite um novo link de recuperação.';
    }

    // 9. Cadastro desabilitado
    if (
      code === 'signup_disabled' ||
      rawMsg.includes('signups not allowed') ||
      rawMsg.includes('signup_disabled')
    ) {
      return 'O cadastro de novos usuários está temporariamente indisponível.';
    }

    // Fallback seguro e acolhedor
    return 'Não foi possível validar suas informações no momento. Tente novamente em instantes.';
  } catch {
    return 'Ocorreu um erro inesperado. Tente novamente.';
  }
}
