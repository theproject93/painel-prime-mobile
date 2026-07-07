import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Dimensions } from 'react-native';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type CineIntroAnimationProps = {
  onComplete: () => void;
};

export function CineIntroAnimation({ onComplete }: CineIntroAnimationProps) {
  // Beams sweep animations
  const beam1TranslateX = useRef(new Animated.Value(-SCREEN_WIDTH)).current;
  const beam2TranslateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const beamsOpacity = useRef(new Animated.Value(0.8)).current;

  // Wordmark and Glow
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.75)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  // Particle sparkle animations
  const particleScale = useRef(new Animated.Value(0)).current;
  const particleOpacity = useRef(new Animated.Value(0)).current;

  // Global screen fade out
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Beams translation
    Animated.parallel([
      Animated.timing(beam1TranslateX, {
        toValue: SCREEN_WIDTH,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(beam2TranslateX, {
        toValue: -SCREEN_WIDTH,
        duration: 1200,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Reveal logo and particles when beams cross (at around 700ms)
    Animated.sequence([
      Animated.delay(650),
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(particleOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(particleScale, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 3. Fade out beams after crossing
    Animated.sequence([
      Animated.delay(1000),
      Animated.timing(beamsOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // 4. Global transition to the app - driven by a master sequence for robust timing
    const masterSequence = Animated.sequence([
      Animated.delay(2300),
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]);

    masterSequence.start(() => {
      onComplete();
    });

    return () => {
      beam1TranslateX.stopAnimation();
      beam2TranslateX.stopAnimation();
      beamsOpacity.stopAnimation();
      logoOpacity.stopAnimation();
      logoScale.stopAnimation();
      glowOpacity.stopAnimation();
      particleOpacity.stopAnimation();
      particleScale.stopAnimation();
      screenOpacity.stopAnimation();
    };
  }, [onComplete]);

  // Particles coordinates
  const particles = [
    { x: -50, y: -50 },
    { x: 50, y: -60 },
    { x: -70, y: 30 },
    { x: 60, y: 40 },
    { x: -20, y: -80 },
    { x: 20, y: 70 },
    { x: -80, y: -20 },
    { x: 80, y: -30 },
  ];

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      {/* Golden diagonal beam 1 */}
      <Animated.View
        style={[
          styles.beam,
          styles.beam1,
          {
            transform: [
              { translateX: beam1TranslateX },
              { rotate: '45deg' },
            ],
            opacity: beamsOpacity,
          },
        ]}
      />

      {/* Golden diagonal beam 2 */}
      <Animated.View
        style={[
          styles.beam,
          styles.beam2,
          {
            transform: [
              { translateX: beam2TranslateX },
              { rotate: '-45deg' },
            ],
            opacity: beamsOpacity,
          },
        ]}
      />

      {/* Golden particles burst */}
      <View style={styles.particlesContainer}>
        {particles.map((p, idx) => {
          const translateX = particleScale.interpolate({
            inputRange: [0, 1],
            outputRange: [0, p.x],
          });
          const translateY = particleScale.interpolate({
            inputRange: [0, 1],
            outputRange: [0, p.y],
          });
          return (
            <Animated.View
              key={idx}
              style={[
                styles.particle,
                {
                  transform: [{ translateX }, { translateY }],
                  opacity: particleOpacity,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Ambient Gold Glow behind text */}
      <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />

      {/* Branded text reveal */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Text style={styles.titleText}>PAINEL PRIME</Text>
        <Text style={styles.subtitleText}>EXCLUSIVE</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000', // True Black
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
  beam: {
    position: 'absolute',
    width: 8,
    height: SCREEN_HEIGHT * 2,
    backgroundColor: '#C9A54D', // Gold Accent
    shadowColor: '#C9A54D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 25,
    elevation: 15,
  },
  beam1: {
    left: SCREEN_WIDTH / 2 - 4,
    top: -SCREEN_HEIGHT * 0.5,
  },
  beam2: {
    left: SCREEN_WIDTH / 2 - 4,
    top: -SCREEN_HEIGHT * 0.5,
  },
  glow: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#C9A54D',
    opacity: 0.3,
    transform: [{ scale: 1.5 }],
    // Blur filter on iOS, shadow/opacity on Android
    shadowColor: '#C9A54D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 50,
    elevation: 20,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 8,
    color: '#FFFFFF',
    textShadowColor: '#C9A54D',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  subtitleText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 6,
    color: '#C9A54D',
    marginTop: 6,
    textShadowColor: '#C9A54D',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  particlesContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C9A54D',
    shadowColor: '#C9A54D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 3,
  },
});
