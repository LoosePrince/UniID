"use client";

import * as React from "react";
import type { SupportedLocale } from "@/shared/i18n/config";
import { createI18n, type I18nShape } from "@/shared/i18n/core";

const I18nContext = React.createContext<I18nShape | null>(null);

export function I18nProvider({
  locale,
  children
}: {
  locale: SupportedLocale;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => createI18n(locale), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = React.useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
