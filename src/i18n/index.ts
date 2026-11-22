import { createContext, useContext } from 'react';
import { sq } from './sq';
import { en } from './en';

export type Language = 'sq' | 'en';

export const dictionaries = { sq, en } as const;

export type Translate = (key: keyof typeof sq, vars?: Record<string, string | number>) => string;
export type TranslateCount = (
  key: keyof typeof sq,
  count: number,
  vars?: Record<string, string | number>
) => string;

export const localeOf: Record<Language, string> = {
  sq: 'sq-AL',
  en: 'en-GB',
};

export interface I18nValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translate;
  tn: TranslateCount;
}

export const I18nContext = createContext<I18nValue | null>(null);

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nContext');
  return value;
}

export function translate(language: Language, key: keyof typeof sq, vars?: Record<string, string | number>) {
  const dictionary: Record<string, string> = dictionaries[language];
  const template = dictionary[key] ?? dictionaries.sq[key] ?? String(key);
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}

export function translateCount(
  language: Language,
  key: keyof typeof sq,
  count: number,
  vars?: Record<string, string | number>
) {
  const oneKey = `${key}_one` as keyof typeof sq;
  const dictionary: Record<string, string> = dictionaries[language];
  const useOne = count === 1 && oneKey in dictionary;
  return translate(language, useOne ? oneKey : key, { n: count, ...vars });
}
