import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceRecordingResult = {
  uri: string;
  mimeType: string;
  name: string;
};

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<any>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        try {
          recordingRef.current.stopAndUnloadAsync();
        } catch {
          // Ignored
        }
        recordingRef.current = null;
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const { Audio } = require('expo-av');
      if (!Audio) {
        setError('Módulo de áudio indisponível neste dispositivo.');
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Permissão de microfone negada. Conceda permissão nas configurações do celular.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status: any) => {
          if (status.canRecord && status.isRecording) {
            setDuration(Math.floor(status.durationMillis / 1000));
          }
        },
        500
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setDuration(0);
    } catch (err: any) {
      console.warn('Erro ao iniciar gravação de áudio:', err);
      setError('Não foi possível iniciar a gravação de áudio.');
      setIsRecording(false);
      recordingRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<VoiceRecordingResult | null> => {
    if (!recordingRef.current) {
      setIsRecording(false);
      return null;
    }

    try {
      const recording = recordingRef.current;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      setIsRecording(false);

      if (!uri) {
        setError('Arquivo de áudio não gerado.');
        return null;
      }

      return {
        uri,
        mimeType: 'audio/m4a',
        name: 'voice.m4a',
      };
    } catch (err) {
      console.warn('Erro ao finalizar gravação de áudio:', err);
      setError('Falha ao processar o áudio gravado.');
      setIsRecording(false);
      recordingRef.current = null;
      return null;
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    if (!recordingRef.current) {
      setIsRecording(false);
      setDuration(0);
      return;
    }

    try {
      const recording = recordingRef.current;
      await recording.stopAndUnloadAsync();
    } catch {
      // Ignored
    }
    recordingRef.current = null;
    setIsRecording(false);
    setDuration(0);
  }, []);

  return {
    isRecording,
    duration,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
