import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useCallback, useRef, useState } from 'react';
import { Alert, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { buildMapPdfHtml } from './mapPdfExport';

export function useMapPdfExport(
  eventId: string,
  captureTarget: React.RefObject<View | null>,
  getLines: () => string[],
  onError: (message: string) => void,
) {
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);
  const lastExportAt = useRef(0);
  const showRecentAlert = useCallback(() => Alert.alert(
    'Exportação recente',
    'O mapa já foi exportado recentemente. Aguarde cerca de 10 segundos antes de tentar novamente.',
    [{ text: 'OK' }],
  ), []);

  const exportPdf = useCallback(async () => {
    if (exportingRef.current || Date.now() - lastExportAt.current < 10_000) {
      showRecentAlert();
      return;
    }
    if (!captureTarget.current) {
      onError('O mapa ainda não está pronto para exportação.');
      return;
    }
    exportingRef.current = true;
    setExporting(true);
    try {
      const image = await captureRef(captureTarget, { format: 'png', quality: 1, result: 'base64' });
      const pdf = await Print.printToFileAsync({ html: buildMapPdfHtml(eventId, image, getLines()) });
      if (!await Sharing.isAvailableAsync()) {
        onError('Compartilhamento não disponível neste dispositivo.');
        return;
      }
      await Sharing.shareAsync(pdf.uri, { mimeType: 'application/pdf', dialogTitle: 'Exportar mapa em PDF' });
      lastExportAt.current = Date.now();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.toLowerCase().includes('another share request is being processed')) {
        lastExportAt.current = Date.now();
        showRecentAlert();
      } else {
        onError(message || 'Falha ao exportar PDF do mapa.');
      }
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }, [captureTarget, eventId, getLines, onError, showRecentAlert]);

  return { exporting, exportPdf };
}
