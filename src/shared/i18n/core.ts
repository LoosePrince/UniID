import type { ErrorCode } from "@/shared/errors/codes";
import { ErrorCodes } from "@/shared/errors/codes";
import { DEFAULT_LOCALE, type SupportedLocale, type TranslationValues } from "./config";
import { messages, type MessageDictionary } from "./messages";

export type I18nShape = {
  locale: SupportedLocale;
  messages: MessageDictionary;
  t: (key: string, values?: TranslationValues) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: number | string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (value: number | string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (value: number | string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatBytes: (value: number, options?: { decimals?: number }) => string;
};

function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    return value == null ? "" : String(value);
  });
}

function toDate(value: number | string | Date): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    return new Date(value < 1_000_000_000_000 ? value * 1000 : value);
  }
  return new Date(value);
}

export function getMessages(locale: SupportedLocale): MessageDictionary {
  return messages[locale] ?? messages[DEFAULT_LOCALE];
}

export function translate(locale: SupportedLocale, key: string, values?: TranslationValues): string {
  const dictionary = getMessages(locale);
  const fallback = messages[DEFAULT_LOCALE];
  return interpolate(dictionary[key] ?? fallback[key] ?? key, values);
}

export function createI18n(locale: SupportedLocale): I18nShape {
  const dictionary = getMessages(locale);

  return {
    locale,
    messages: dictionary,
    t: (key, values) => interpolate(dictionary[key] ?? messages[DEFAULT_LOCALE][key] ?? key, values),
    formatNumber: (value, options) => new Intl.NumberFormat(locale, options).format(value),
    formatDate: (value, options) =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        ...(options ?? {})
      }).format(toDate(value)),
    formatDateTime: (value, options) =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        ...(options ?? {})
      }).format(toDate(value)),
    formatTime: (value, options) =>
      new Intl.DateTimeFormat(locale, {
        timeStyle: "medium",
        ...(options ?? {})
      }).format(toDate(value)),
    formatBytes: (value, options) => {
      if (!Number.isFinite(value)) return "—";
      if (value === 0) return `0 ${locale === "zh-CN" ? "字节" : "B"}`;
      const units = locale === "zh-CN" ? ["字节", "KB", "MB", "GB", "TB"] : ["B", "KB", "MB", "GB", "TB"];
      const decimals = options?.decimals ?? 1;
      const exponent = Math.min(Math.floor(Math.log(Math.abs(value)) / Math.log(1024)), units.length - 1);
      const size = value / 1024 ** exponent;
      return `${new Intl.NumberFormat(locale, {
        minimumFractionDigits: exponent === 0 ? 0 : 0,
        maximumFractionDigits: exponent === 0 ? 0 : decimals
      }).format(size)} ${units[exponent]}`;
    }
  };
}

export function getErrorMessage(locale: SupportedLocale, code: string): string {
  return resolveErrorMessage(locale, code);
}

export function localizeMessage(locale: SupportedLocale, message: string): string {
  const localized = translate(locale, message);
  return localized !== message ? localized : message;
}

export function resolveErrorMessage(
  locale: SupportedLocale,
  code: ErrorCode | string,
  override?: string
): string {
  if (override) return localizeMessage(locale, override);
  const key = `error.${code}`;
  const localized = translate(locale, key);
  if (localized !== key) return localized;
  const fallback = ErrorCodes[code as ErrorCode]?.message;
  return fallback ?? key;
}