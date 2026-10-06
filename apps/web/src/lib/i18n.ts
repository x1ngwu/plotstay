import type { Locale } from '@plotstay/contracts';
const en = {
  home: 'Browse', sample: 'Fictional sample content', stays: 'Stays', experiences: 'Experiences',
  notes: 'Fictional visitor notes', empty: 'No published content yet.',
  fallback: 'This content is currently shown in its original language.',
  notFound: 'This page could not be found.', unavailable: 'Content is temporarily unavailable. Please try again.',
  night: 'night', person: 'person', minutes: 'minutes', facilities: 'Facilities', rules: 'Things to know', itinerary: 'Itinerary',
  about: 'Stays and experiences in fictional worlds. All journeys and prices are fictional.',
  uiFallback: 'The interface is currently shown in English.',
};
type Messages = typeof en;
const dictionaries: Record<string, Messages> = {
  en,
  'zh-CN': {
    home: '浏览', sample: '虚构占位内容', stays: '住宿', experiences: '活动', notes: '虚构游客手记', empty: '暂无已发布内容。',
    fallback: '此内容暂以原文展示。', notFound: '未找到此页面。', unavailable: '内容暂时无法读取，请稍后重试。',
    night: '晚', person: '人', minutes: '分钟', facilities: '设施', rules: '须知', itinerary: '行程',
    about: '在虚构世界中寻找住宿与活动。所有旅行和价格均为虚构。',
    uiFallback: '界面暂以英语展示。',
  },
};
// Language availability comes from the API. New locales can use English UI until a dictionary is supplied.
export const messages = (locale: string): Messages => dictionaries[locale] ?? en;
export const hasDictionary = (locale: string) => Object.hasOwn(dictionaries, locale);
export const uiLocale = (locale: string) => hasDictionary(locale) ? locale : 'en';
export const bilingual = (locale: string) => (zh: string, en: string) => uiLocale(locale) === 'zh-CN' ? zh : en;
export function languagePath(url: URL, locale: Locale) {
  const segments = url.pathname.split('/');
  segments[1] = locale.pathPrefix;
  return segments.join('/').replace(/\/+$/, '') + url.search;
}
