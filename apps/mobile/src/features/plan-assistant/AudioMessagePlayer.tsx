import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHaptics } from '../../lib/haptics';
import { colors } from '../../theme/colors';

type AudioMessagePlayerProps = {
  src: string;
  autoPlay?: boolean;
  isUser?: boolean;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function AudioMessagePlayer({
  src,
  autoPlay = false,
  isUser = false,
}: AudioMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);

  const soundRef = useRef<any>(null);
  const videoPlayerRef = useRef<any>(null);
  const isUsingFallbackRef = useRef(false);
  const hasAutoPlayedRef = useRef(false);

  useEffect(() => {
    hasAutoPlayedRef.current = false;
  }, [src]);

  // Cleanup active audio/player
  const unloadCurrent = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch {
      // Ignored
    }
    try {
      if (videoPlayerRef.current) {
        videoPlayerRef.current.pause?.();
        videoPlayerRef.current = null;
      }
    } catch {
      // Ignored
    }
  }, []);

  // Initialize playback with expo-av (fallback to expo-video)
  useEffect(() => {
    if (!src) return;
    let isCancelled = false;

    async function initAudio() {
      await unloadCurrent();
      if (isCancelled) return;

      const shouldAuto = autoPlay && !hasAutoPlayedRef.current;
      if (shouldAuto) {
        hasAutoPlayedRef.current = true;
      }

      // 1. Try expo-av first
      try {
        const { Audio } = require('expo-av');
        if (Audio && Audio.Sound) {
          try {
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              playsInSilentModeIOS: true,
              staysActiveInBackground: false,
            });
          } catch {
            // Audio mode set is best-effort
          }

          const { sound, status } = await Audio.Sound.createAsync(
            { uri: src },
            { shouldPlay: shouldAuto },
            (playbackStatus: any) => {
              if (isCancelled || !playbackStatus.isLoaded) return;
              setIsPlaying(playbackStatus.isPlaying);
              setCurrentTime(playbackStatus.positionMillis / 1000);
              if (playbackStatus.durationMillis) {
                setDuration(playbackStatus.durationMillis / 1000);
              }
              if (playbackStatus.didJustFinish) {
                setIsPlaying(false);
                setCurrentTime(0);
              }
            }
          );

          if (isCancelled) {
            void sound.unloadAsync();
            return;
          }

          soundRef.current = sound;
          isUsingFallbackRef.current = false;
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying);
            if (status.durationMillis) {
              setDuration(status.durationMillis / 1000);
            }
          }
          return;
        }
      } catch (avErr) {
        console.warn('expo-av indisponível ou falhou, tentando fallback para expo-video:', avErr);
      }

      // 2. Fallback to expo-video
      try {
        const { createVideoPlayer } = require('expo-video');
        if (createVideoPlayer) {
          const player = createVideoPlayer(src);
          videoPlayerRef.current = player;
          isUsingFallbackRef.current = true;

          player.addListener('playingChange', ({ isPlaying: playing }: { isPlaying: boolean }) => {
            if (!isCancelled) setIsPlaying(playing);
          });
          player.addListener('timeUpdate', ({ currentTime: time }: { currentTime: number }) => {
            if (!isCancelled) setCurrentTime(time);
          });
          player.addListener('statusChange', ({ status: s }: any) => {
            if (!isCancelled && player.duration) {
              setDuration(player.duration);
            }
            if (s === 'readyToPlay' && shouldAuto) {
              player.play();
            }
          });

          if (shouldAuto) {
            player.play();
          }
        }
      } catch (videoErr) {
        console.warn('Fallback expo-video falhou:', videoErr);
      }
    }

    void initAudio();

    return () => {
      isCancelled = true;
      void unloadCurrent();
    };
  }, [src, autoPlay, unloadCurrent]);

  const togglePlay = async () => {
    void AppHaptics.light();
    try {
      if (soundRef.current && !isUsingFallbackRef.current) {
        if (isPlaying) {
          await soundRef.current.pauseAsync();
        } else {
          if (currentTime >= duration && duration > 0) {
            await soundRef.current.setPositionAsync(0);
          }
          await soundRef.current.playAsync();
        }
        return;
      }

      if (videoPlayerRef.current) {
        if (isPlaying) {
          videoPlayerRef.current.pause();
        } else {
          if (currentTime >= duration && duration > 0) {
            videoPlayerRef.current.currentTime = 0;
          }
          videoPlayerRef.current.play();
        }
      }
    } catch (err) {
      console.warn('Erro ao alternar reprodução de áudio:', err);
    }
  };

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const handleSeek = async (event: GestureResponderEvent) => {
    if (trackWidth <= 0 || duration <= 0) return;
    const locationX = Math.max(0, Math.min(event.nativeEvent.locationX, trackWidth));
    const seekSeconds = (locationX / trackWidth) * duration;
    setCurrentTime(seekSeconds);

    try {
      if (soundRef.current && !isUsingFallbackRef.current) {
        await soundRef.current.setPositionAsync(seekSeconds * 1000);
      } else if (videoPlayerRef.current) {
        videoPlayerRef.current.currentTime = seekSeconds;
      }
    } catch {
      // Ignored
    }
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const playLabel = isUser
    ? (isPlaying ? 'Pausar áudio enviado' : 'Reproduzir áudio enviado')
    : (isPlaying ? 'Pausar áudio da Plan IA' : 'Reproduzir áudio da Plan IA');

  return (
    <View style={[styles.container, isUser ? styles.containerUser : styles.containerBot]}>
      <Pressable
        style={[styles.playButton, isUser ? styles.playButtonUser : styles.playButtonBot]}
        onPress={togglePlay}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={playLabel}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={16}
          color={isUser ? colors.primaryStrong : '#FFFFFF'}
          style={!isPlaying ? { marginLeft: 2 } : undefined}
        />
      </Pressable>

      <View style={styles.trackArea}>
        <Pressable
          style={styles.trackTouch}
          onLayout={handleTrackLayout}
          onPress={handleSeek}
          accessibilityRole="adjustable"
          accessibilityLabel="Progresso do áudio"
        >
          <View style={[styles.trackBg, isUser ? styles.trackBgUser : styles.trackBgBot]}>
            <View
              style={[
                styles.trackFill,
                isUser ? styles.trackFillUser : styles.trackFillBot,
                { width: `${progressPercent}%` },
              ]}
            />
          </View>
        </Pressable>

        <View style={styles.timeRow}>
          <Text style={[styles.timeText, isUser ? styles.timeTextUser : styles.timeTextBot]}>
            {formatTime(currentTime)}
          </Text>
          <View style={styles.durationWrap}>
            <Ionicons
              name="volume-medium-outline"
              size={12}
              color={isUser ? 'rgba(255, 255, 255, 0.8)' : colors.mutedText}
            />
            <Text style={[styles.timeText, isUser ? styles.timeTextUser : styles.timeTextBot]}>
              {formatTime(duration)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 48,
  },
  containerUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  containerBot: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(222, 196, 121, 0.35)',
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonUser: {
    backgroundColor: '#FFFFFF',
  },
  playButtonBot: {
    backgroundColor: colors.primaryStrong,
  },
  trackArea: {
    flex: 1,
    gap: 4,
  },
  trackTouch: {
    paddingVertical: 6,
    justifyContent: 'center',
  },
  trackBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  trackBgUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  trackBgBot: {
    backgroundColor: 'rgba(15, 23, 42, 0.15)',
  },
  trackFill: {
    height: '100%',
    borderRadius: 2,
  },
  trackFillUser: {
    backgroundColor: '#FFFFFF',
  },
  trackFillBot: {
    backgroundColor: colors.primaryStrong,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  timeTextUser: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  timeTextBot: {
    color: colors.primaryStrong,
  },
  durationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
});
