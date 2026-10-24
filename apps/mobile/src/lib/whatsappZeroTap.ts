import { AppState, DeviceEventEmitter, NativeModules, Platform } from 'react-native';

interface WhatsAppZeroTapNativeModule {
  startHandshake?: () => Promise<string | null>;
  consumePendingCode?: () => Promise<string | null>;
}

function getNativeModule(): WhatsAppZeroTapNativeModule | null {
  if (Platform.OS !== 'android') return null;
  const mod = NativeModules?.WhatsAppZeroTap as WhatsAppZeroTapNativeModule | undefined;
  return mod ?? null;
}

/**
 * Inicia o handshake oficial (`com.whatsapp.otp.OTP_REQUESTED`) com o WhatsApp
 * e WhatsApp Business antes do disparo do modelo `ZERO_TAP` na Meta.
 */
export async function startWhatsAppZeroTapHandshake(): Promise<string | null> {
  const mod = getNativeModule();
  if (!mod?.startHandshake) return null;
  try {
    return await mod.startHandshake();
  } catch {
    return null;
  }
}

/**
 * Consome eventual código OTP recebido em segundo plano via Zero-Tap / One-Tap.
 */
export async function consumePendingWhatsAppOtp(): Promise<string | null> {
  const mod = getNativeModule();
  if (!mod?.consumePendingCode) return null;
  try {
    const raw = await mod.consumePendingCode();
    if (!raw) return null;
    const digits = String(raw).replace(/\D/g, '');
    return digits.length === 6 ? digits : null;
  } catch {
    return null;
  }
}

/**
 * Escuta códigos OTP de 6 dígitos entregues automaticamente pelo WhatsApp Zero-Tap
 * ou pelo retorno do botão One-Tap ("Inserir código") no Android.
 */
export function subscribeWhatsAppZeroTapOtp(onCode: (code: string) => void): () => void {
  if (Platform.OS !== 'android') {
    return () => {};
  }

  const handleRawCode = (raw: unknown) => {
    const digits = typeof raw === 'string' ? raw.replace(/\D/g, '') : '';
    if (digits.length === 6) {
      onCode(digits);
    }
  };

  const eventSub = DeviceEventEmitter.addListener('WhatsAppZeroTapOtp', handleRawCode);

  const checkPending = () => {
    void consumePendingWhatsAppOtp().then((code) => {
      if (code) onCode(code);
    });
  };

  checkPending();

  const appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      checkPending();
    }
  });

  return () => {
    eventSub.remove();
    appStateSub.remove();
  };
}
