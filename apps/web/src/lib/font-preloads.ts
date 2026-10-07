import dinkie9 from '../assets/fonts/pixel/dinkie-9-core.woff2?url';
import dinkie7 from '../assets/fonts/pixel/dinkie-7-core.woff2?url';
import code from '../assets/fonts/pixel/DinkieBitmap-9pxCode.woff2?url';
import redAlert from '../assets/fonts/pixel/cc-red-alert-inet.ttf?url';
import pressStart from '../assets/fonts/pixel/press-start-k.ttf?url';
import type { FontPreview } from './font-preview';

export function fontPreloads(style: FontPreview, language: string, display: boolean) {
  const chinese = language.startsWith('zh');
  const fonts: { href: string; type: string }[] = [];
  if (style === 'terminal' || style === 'soft') {
    fonts.push({ href: code, type: 'font/woff2' });
    if (chinese) fonts.push({ href: dinkie9, type: 'font/woff2' });
  }
  if (style === 'arcade') {
    fonts.push({ href: redAlert, type: 'font/ttf' });
    if (chinese) fonts.push({ href: dinkie9, type: 'font/woff2' });
    if (display) fonts.push(chinese
      ? { href: dinkie7, type: 'font/woff2' }
      : { href: pressStart, type: 'font/ttf' });
  }
  return fonts;
}
