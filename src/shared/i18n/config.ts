export const DEFAULT_LOCALE = "zh-CN";
export const LOCALE_COOKIE_NAME = "uniid_locale";
export const SUPPORTED_LOCALES = ["zh-CN", "en-US"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type TranslationValues = Record<string, string | number | boolean | null | undefined>;

export function normalizeLocale(input?: string | null): SupportedLocale {
  const value = input?.trim().toLowerCase();
  if (!value) return DEFAULT_LOCALE;
  if (value === "zh-cn" || value === "zh" || value.startsWith("zh-")) return "zh-CN";
  if (value === "en-us" || value === "en" || value.startsWith("en-")) return "en-US";
  return DEFAULT_LOCALE;
}

export function isSupportedLocale(input: string): input is SupportedLocale {
  return SUPPORTED_LOCALES.includes(input as SupportedLocale);
}