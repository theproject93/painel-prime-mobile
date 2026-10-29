import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { AppHaptics } from '../../../lib/haptics';

export interface NativeScannerViewProps {
  active?: boolean;
  onScan: (data: string) => void;
  torchEnabled?: boolean;
  onTorchToggle?: (enabled: boolean) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_FRAME_SIZE = Math.min(SCREEN_WIDTH * 0.72, 280);

export function NativeScannerView({
  active = true,
  onScan,
  torchEnabled: externalTorch,
  onTorchToggle,
}: NativeScannerViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [internalTorch, setInternalTorch] = useState(false);

  const torch = externalTorch !== undefined ? externalTorch : internalTorch;

  const lastScannedDataRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  const toggleTorch = useCallback(() => {
    void AppHaptics.selection();
    const nextTorch = !torch;
    if (onTorchToggle) {
      onTorchToggle(nextTorch);
    } else {
      setInternalTorch(nextTorch);
    }
  }, [torch, onTorchToggle]);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (!active) return;

      const data = result.data?.trim();
      if (!data) return;

      const now = Date.now();
      const isDuplicateRecent =
        data === lastScannedDataRef.current &&
        now - lastScannedTimeRef.current < 2500;

      if (isDuplicateRecent) {
        return;
      }

      lastScannedDataRef.current = data;
      lastScannedTimeRef.current = now;

      // Feedback tátil sutil ao registrar a leitura
      void AppHaptics.light();
      onScan(data);
    },
    [active, onScan],
  );

  // 1. Estado de carregamento da permissão
  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#023C69" />
        <Text style={styles.permissionSubtitle}>Inicializando câmera...</Text>
      </View>
    );
  }

  // 2. Permissão não concedida
  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.permissionIconCircle}>
          <Ionicons name="camera-outline" size={48} color="#023C69" />
        </View>
        <Text style={styles.permissionTitle}>Acesso à Câmera Necessário</Text>
        <Text style={styles.permissionSubtitle}>
          O Painel Prime precisa de acesso à câmera para ler os QR Codes dos convidados na Portaria.
        </Text>
        <Pressable
          style={styles.permissionButton}
          onPress={() => void requestPermission()}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.permissionButtonText}>Permitir Câmera</Text>
        </Pressable>
      </View>
    );
  }

  // 3. Câmera ativa com retículo e máscara de mira
  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={active ? handleBarcodeScanned : undefined}
      >
        {/* Máscara de foco escurecida com visor central transparente */}
        <View style={styles.overlay}>
          {/* Top Mask com Botão da Lanterna */}
          <View style={styles.maskTop}>
            <Pressable
              style={[styles.torchButton, torch && styles.torchButtonActive]}
              onPress={toggleTorch}
              accessibilityLabel={torch ? 'Desligar Lanterna' : 'Ligar Lanterna'}
            >
              <Ionicons
                name={torch ? 'flash' : 'flash-off-outline'}
                size={22}
                color={torch ? '#023C69' : '#FFFFFF'}
              />
              <Text
                style={[
                  styles.torchButtonText,
                  torch && styles.torchButtonTextActive,
                ]}
              >
                {torch ? 'Lanterna Ligada' : 'Lanterna'}
              </Text>
            </Pressable>
          </View>

          {/* Linha Central com Viewfinder (Retículo) */}
          <View style={styles.maskCenterRow}>
            <View style={styles.maskSide} />

            <View style={styles.viewfinder}>
              {/* 4 Cantos Visuais do Scanner */}
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />

              {/* Linha de Leitura Laser Vermelha/Dourada */}
              <View style={styles.scanLaser} />
            </View>

            <View style={styles.maskSide} />
          </View>

          {/* Bottom Mask com Instruções */}
          <View style={styles.maskBottom}>
            <View style={styles.instructionBadge}>
              <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
              <Text style={styles.instructionText}>
                Aponte para o QR Code do convidado
              </Text>
            </View>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  permissionIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#023C69',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 12,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
  },
  maskTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 48,
    paddingRight: 20,
  },
  torchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    gap: 6,
  },
  torchButtonActive: {
    backgroundColor: '#FDE047',
    borderColor: '#EAB308',
  },
  torchButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  torchButtonTextActive: {
    color: '#023C69',
  },
  maskCenterRow: {
    flexDirection: 'row',
    height: SCAN_FRAME_SIZE,
  },
  maskSide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  viewfinder: {
    width: SCAN_FRAME_SIZE,
    height: SCAN_FRAME_SIZE,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#38BDF8',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderTopLeftRadius: 10,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderTopRightRadius: 10,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderBottomLeftRadius: 10,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: 10,
  },
  scanLaser: {
    width: SCAN_FRAME_SIZE - 20,
    height: 2,
    backgroundColor: 'rgba(56, 189, 248, 0.85)',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 3,
  },
  maskBottom: {
    flex: 1.2,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    paddingTop: 24,
  },
  instructionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 8,
  },
  instructionText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
});
