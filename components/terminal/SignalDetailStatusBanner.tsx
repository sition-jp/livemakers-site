/**
 * SignalDetailStatusBanner — non-active state header with optional
 * "View latest version" CTA for superseded signals (v0.2 Finding 7).
 *
 * Returns null for status="active" — the caller need not branch.
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Signal } from "@/lib/signals";

interface Props {
  signal: Signal;
  locale: "en" | "ja";
  latestId: string | null;
}

export function SignalDetailStatusBanner({ signal, locale, latestId }: Props) {
  const t = useTranslations("signals.detail.status_banner");

  if (signal.status === "active") return null;

  const time = (signal as Signal & { updated_at?: string }).updated_at ?? signal.created_at;
  const timeShort = (() => {
    try {
      return new Intl.DateTimeFormat(locale, {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(time));
    } catch {
      return time;
    }
  })();

  if (signal.status === "superseded") {
    const accent = "bg-amber-50 dark:bg-amber-950/30 border-amber-500 text-amber-900 dark:text-amber-100";
    if (latestId) {
      return (
        <div className={`rounded border-l-4 px-4 py-2 text-sm ${accent}`}>
          {t("superseded", { time: timeShort })}{" "}
          <Link href={`/${locale}/signals/${latestId}`} className="underline font-medium">
            {t("view_latest")} →
          </Link>
        </div>
      );
    }
    return (
      <div className={`rounded border-l-4 px-4 py-2 text-sm ${accent}`}>
        {t("superseded", { time: timeShort })}
      </div>
    );
  }

  if (signal.status === "invalidated") {
    return (
      <div className="rounded border-l-4 border-gray-400 bg-gray-50 dark:bg-gray-900/30 px-4 py-2 text-sm">
        {t("invalidated", { time: timeShort })}
      </div>
    );
  }

  if (signal.status === "expired") {
    return (
      <div className="rounded border-l-4 border-gray-400 bg-gray-50 dark:bg-gray-900/30 px-4 py-2 text-sm">
        {t("expired")}
      </div>
    );
  }

  return null;
}
