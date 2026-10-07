export const fontPreviews = [
  { id: 'original', label: '原版', note: '调整前字体', description: '文泉驿正文与 Courier 辅助信息，作为比较基准。' },
  { id: 'soft', label: 'A · 轻像素', note: '只换标题', description: '标题使用丁卯 9px，英文搭配丁卯 Code；正文沿用调整前字体。' },
  { id: 'terminal', label: 'B · 细点阵', note: '中文默认', description: '标题与中文正文统一使用丁卯 9px，英文与数字搭配丁卯 Code。' },
  { id: 'arcade', label: 'C · 街机感', note: '英文默认 / 中文可选', description: '英文大标题用 Press Start K，中文标题用丁卯 7px；正文为 C&C Red Alert 与丁卯 9px。' },
] as const;

export type FontPreview = typeof fontPreviews[number]['id'];

export function getFontPreview(value: string | null): FontPreview | undefined {
  return fontPreviews.find(item => item.id === value)?.id;
}
