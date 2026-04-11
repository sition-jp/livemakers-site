"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function SubscribeForm({ locale }: { locale: "en" | "ja" }) {
  const t = useTranslations("subscribe");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "pending" | "already" | "error"
  >("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        body: JSON.stringify({ email, locale }),
        headers: { "content-type": "application/json" },
      });
      const body = await res.json();
      if (body.status === "pending_confirmation") setStatus("pending");
      else if (body.status === "already_subscribed") setStatus("already");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md">
      <label
        htmlFor="email"
        className="mb-2 block text-[10px] tracking-label text-text-tertiary"
      >
        {t("emailLabel")}
      </label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("emailPlaceholder")}
        disabled={status === "submitting" || status === "pending"}
        className="w-full border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-pillar-overview focus:outline-none"
      />
      <button
        type="submit"
        disabled={status === "submitting" || status === "pending"}
        className="mt-4 w-full border border-pillar-overview bg-pillar-overview px-6 py-3 text-xs tracking-label text-bg-primary hover:bg-transparent hover:text-pillar-overview disabled:opacity-50"
      >
        {t("submit")}
      </button>

      {status === "pending" && (
        <p className="mt-4 text-center text-sm text-status-up">{t("pending")}</p>
      )}
      {status === "already" && (
        <p className="mt-4 text-center text-sm text-text-secondary">
          {t("alreadySubscribed")}
        </p>
      )}
      {status === "error" && (
        <p className="mt-4 text-center text-sm text-status-down">{t("error")}</p>
      )}
      <p className="mt-6 text-center text-[10px] tracking-label text-text-tertiary">
        {t("privacyNote")}
      </p>
    </form>
  );
}
