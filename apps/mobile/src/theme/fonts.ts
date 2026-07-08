import { useFonts } from 'expo-font';

export function useAppFonts(): [boolean] {
  const [loaded] = useFonts({
    Manrope_400Regular: require('@expo-google-fonts/manrope/400Regular/Manrope_400Regular.ttf'),
    Manrope_500Medium: require('@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf'),
    Manrope_600SemiBold: require('@expo-google-fonts/manrope/600SemiBold/Manrope_600SemiBold.ttf'),
    Manrope_700Bold: require('@expo-google-fonts/manrope/700Bold/Manrope_700Bold.ttf'),
    Manrope_800ExtraBold: require('@expo-google-fonts/manrope/800ExtraBold/Manrope_800ExtraBold.ttf'),
    PlayfairDisplay_400Regular: require('@expo-google-fonts/playfair-display/400Regular/PlayfairDisplay_400Regular.ttf'),
  });

  return [loaded];
}

export const typography = {
  fontFamily: {
    sans: 'Manrope_400Regular',
    sansMedium: 'Manrope_500Medium',
    sansSemiBold: 'Manrope_600SemiBold',
    sansBold: 'Manrope_700Bold',
    sansExtraBold: 'Manrope_800ExtraBold',
    serif: 'PlayfairDisplay_400Regular',
  },
} as const;
