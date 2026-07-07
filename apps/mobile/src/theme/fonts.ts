import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { PlayfairDisplay_400Regular, PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';

export const fontConfig = {
  'Manrope': Manrope_400Regular,
  'Manrope-Medium': Manrope_500Medium,
  'Manrope-SemiBold': Manrope_600SemiBold,
  'Manrope-Bold': Manrope_700Bold,
  'Manrope-ExtraBold': Manrope_800ExtraBold,
  'PlayfairDisplay': PlayfairDisplay_400Regular,
  'PlayfairDisplay-Medium': PlayfairDisplay_500Medium,
  'PlayfairDisplay-SemiBold': PlayfairDisplay_600SemiBold,
  'PlayfairDisplay-Bold': PlayfairDisplay_700Bold,
} as const;

export function useAppFonts() {
  return useFonts(fontConfig);
}

export const typography = {
  fontFamily: {
    sans: 'Manrope',
    sansMedium: 'Manrope-Medium',
    sansSemiBold: 'Manrope-SemiBold',
    sansBold: 'Manrope-Bold',
    sansExtraBold: 'Manrope-ExtraBold',
    display: 'PlayfairDisplay',
    displayMedium: 'PlayfairDisplay-Medium',
    displaySemiBold: 'PlayfairDisplay-SemiBold',
    displayBold: 'PlayfairDisplay-Bold',
  },
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },
} as const;
