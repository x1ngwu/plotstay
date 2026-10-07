export const CHINESE_FONT_COOKIE = 'plotstay-zh-font';
export type PixelFontStyle = 'terminal' | 'arcade';

export function chineseFontPreference(value?: string): PixelFontStyle | undefined {
  return value === 'terminal' || value === 'arcade' ? value : undefined;
}

export function defaultFontStyle(languageTag: string): PixelFontStyle {
  return languageTag.toLowerCase().split('-')[0] === 'zh' ? 'terminal' : 'arcade';
}

export function fontStyleForLocale(languageTag: string, preference?: string): PixelFontStyle {
  return defaultFontStyle(languageTag) === 'terminal'
    ? chineseFontPreference(preference) ?? 'terminal'
    : 'arcade';
}
