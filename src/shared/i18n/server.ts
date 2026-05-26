import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "@/shared/prisma";
import { getCurrentUserSession, SESSION_COOKIE_NAME } from "@/shared/iam/session-store";
import { verifyUserSessionToken } from "@/shared/iam/jwt";
import { createI18n } from "./core";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, normalizeLocale, type SupportedLocale } from "./config";

async function findUserLocale(userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { locale: true, deletedAt: true }
  });
  if (!user || user.deletedAt) return null;
  return user.locale ?? null;
}

function parseAcceptLanguage(input?: string | null): string | null {
  if (!input) return null;
  const items = input
    .split(",")
    .map((part) => {
      const [tag, qPart] = part.trim().split(";");
      const quality = qPart?.startsWith("q=") ? Number(qPart.slice(2)) : 1;
      return { tag, quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((item) => item.tag)
    .sort((left, right) => right.quality - left.quality);

  return items[0]?.tag ?? null;
}

async function resolveLocaleFromSessionCookie(token?: string | null): Promise<string | null> {
  if (!token) return null;
  try {
    const payload = await verifyUserSessionToken(token);
    return await findUserLocale(payload.sub);
  } catch {
    return null;
  }
}

export async function resolveCurrentLocale(): Promise<SupportedLocale> {
  const session = await getCurrentUserSession();
  const accountLocale = await findUserLocale(session?.userId);
  if (accountLocale) return normalizeLocale(accountLocale);

  const localeCookie = cookies().get(LOCALE_COOKIE_NAME)?.value;
  if (localeCookie) return normalizeLocale(localeCookie);

  const accepted = parseAcceptLanguage(headers().get("accept-language"));
  return normalizeLocale(accepted ?? DEFAULT_LOCALE);
}

export async function resolveRequestLocale(
  req: NextRequest,
  opts?: { userId?: string | null }
): Promise<SupportedLocale> {
  const accountLocale = await findUserLocale(opts?.userId ?? null);
  if (accountLocale) return normalizeLocale(accountLocale);

  const sessionLocale = await resolveLocaleFromSessionCookie(req.cookies.get(SESSION_COOKIE_NAME)?.value ?? null);
  if (sessionLocale) return normalizeLocale(sessionLocale);

  const localeCookie = req.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (localeCookie) return normalizeLocale(localeCookie);

  return normalizeLocale(parseAcceptLanguage(req.headers.get("accept-language")) ?? DEFAULT_LOCALE);
}

export async function getServerI18n(opts?: { req?: NextRequest; userId?: string | null }) {
  const locale = opts?.req
    ? await resolveRequestLocale(opts.req, { userId: opts.userId })
    : await resolveCurrentLocale();
  return createI18n(locale);
}

export function setLocaleCookie(locale: string) {
  cookies().set(LOCALE_COOKIE_NAME, locale, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
}