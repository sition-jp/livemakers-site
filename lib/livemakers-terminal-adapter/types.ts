import { z } from "zod";

export const TerminalAdapterPacketStatusSchema = z.enum([
  "ready",
  "degraded",
  "unavailable",
  "blocked",
]);

export const TerminalAdapterModuleStatusSchema = z.enum([
  "ready",
  "degraded",
  "unavailable",
  "blocked",
]);

export const TerminalAdapterDisplaySurfaceSchema = z.enum([
  "market_state_header",
  "live_data_strip",
  "what_happened",
  "leading_indicators",
  "scenario_radar",
  "featured_brief",
  "source_ledger",
  "boundary_note",
]);

export const TerminalAdapterDataFamilySchema = z.enum([
  "market",
  "crypto_onchain",
  "macro_liquidity",
  "policy_regulatory",
  "ai_capital_cycle",
  "internal_sde_state",
  "editorial",
  "other",
]);

export const TerminalAdapterContentKindSchema = z.enum([
  "raw_data",
  "reviewed_data",
  "editorial_interpretation",
  "scenario",
  "watch_item",
]);

export const TerminalAdapterPublicDisplaySafetySchema = z.enum([
  "approved",
  "needs_review",
  "internal_only",
  "blocked",
]);

export const TerminalAdapterFreshnessTierSchema = z.enum([
  "live",
  "fresh",
  "stale",
  "very_stale",
  "unknown",
  "unavailable",
]);

export const TerminalAdapterNullPolicySchema = z.enum([
  "unavailable_not_zero",
  "zero_is_valid",
  "hide_module",
  "show_degraded",
]);

export const TerminalAdapterSourceKindSchema = z.enum([
  "primary",
  "official",
  "exchange",
  "aggregator",
  "internal_review",
  "editorial",
  "fixture",
]);

export const TerminalAdapterSourceVisibilitySchema = z.enum([
  "public",
  "internal_path",
  "private",
  "mock",
]);

export const TerminalAdapterSourceConfidenceSchema = z.enum([
  "primary",
  "high",
  "medium",
  "low",
  "unverified",
  "internal_only",
  "mock",
]);

export const TerminalAdapterUnavailableReasonSchema = z.enum([
  "missing_source",
  "stale_source",
  "parse_error",
  "safety_block",
  "not_reviewed",
]);

export const TerminalAdapterSafetySchema = z.object({
  prohibited_couplings_checked: z.object({
    trading_signal: z.boolean(),
    order_instruction: z.boolean(),
    paper_live: z.boolean(),
    at_feedback: z.boolean(),
    secrets: z.boolean(),
  }),
  public_display_safety: TerminalAdapterPublicDisplaySafetySchema,
  blocking_reason: z.string().nullable(),
});

export const TerminalAdapterSourceSchema = z.object({
  source_id: z.string().min(1),
  source_name: z.string().min(1),
  source_kind: TerminalAdapterSourceKindSchema,
  source_url_or_path: z.string().nullable(),
  source_visibility: TerminalAdapterSourceVisibilitySchema,
  source_confidence: TerminalAdapterSourceConfidenceSchema,
  generated_at: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  freshness_tier: TerminalAdapterFreshnessTierSchema,
  limitations_en: z.string().min(1),
  limitations_ja: z.string().min(1),
  public_display_allowed: z.boolean(),
});

export const TerminalAdapterModuleSchema = z.object({
  module_id: z.string().min(1),
  display_surface: TerminalAdapterDisplaySurfaceSchema,
  data_family: TerminalAdapterDataFamilySchema,
  content_kind: TerminalAdapterContentKindSchema,
  module_status: TerminalAdapterModuleStatusSchema,
  public_display_safety: TerminalAdapterPublicDisplaySafetySchema,
  source_refs: z.array(z.string().min(1)),
  generated_at: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  freshness_tier: TerminalAdapterFreshnessTierSchema,
  source_confidence: TerminalAdapterSourceConfidenceSchema,
  null_policy: TerminalAdapterNullPolicySchema,
  value_policy: z.object({
    may_show_numeric_value: z.boolean(),
    may_show_directional_language: z.boolean(),
    may_show_advice_language: z.boolean(),
  }),
  unavailable: z.object({
    display_label_en: z.string().min(1),
    display_label_ja: z.string().min(1),
    reason: TerminalAdapterUnavailableReasonSchema,
  }),
  payload: z.record(z.unknown()),
});

function hasRenderablePayloadValue(payload: Record<string, unknown>): boolean {
  return Object.keys(payload).length > 0;
}

function rendersMissingNumericAsZero(payload: Record<string, unknown>): boolean {
  return (
    payload.numeric_value_missing === true &&
    (payload.value_display === "0" || payload.value_display === 0)
  );
}

export const TerminalAdapterPacketSchema = z
  .object({
    schema_version: z.literal("livemakers_terminal_adapter_packet_v0.1"),
    packet_id: z.string().min(1),
    generated_at: z.string().min(1),
    reviewed_at: z.string().nullable(),
    as_of_jst: z.string().nullable(),
    locale_ready: z.object({
      en: z.boolean(),
      ja: z.boolean(),
    }),
    packet_status: TerminalAdapterPacketStatusSchema,
    modules: z.array(TerminalAdapterModuleSchema),
    source_ledger: z.array(TerminalAdapterSourceSchema),
    safety: TerminalAdapterSafetySchema,
  })
  .superRefine((packet, ctx) => {
    const sourceIds = new Set(
      packet.source_ledger.map((source) => source.source_id),
    );

    for (const [sourceIndex, source] of packet.source_ledger.entries()) {
      if (
        source.source_visibility === "private" &&
        source.public_display_allowed
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "private sources cannot be public-display allowed",
          path: ["source_ledger", sourceIndex, "public_display_allowed"],
        });
      }
    }

    const couplingChecks = packet.safety.prohibited_couplings_checked;
    for (const [key, value] of Object.entries(couplingChecks)) {
      if (value !== true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "all prohibited coupling checks must be true",
          path: ["safety", "prohibited_couplings_checked", key],
        });
      }
    }

    for (const [moduleIndex, module] of packet.modules.entries()) {
      for (const [refIndex, sourceRef] of module.source_refs.entries()) {
        if (!sourceIds.has(sourceRef)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `source_ref does not resolve: ${sourceRef}`,
            path: ["modules", moduleIndex, "source_refs", refIndex],
          });
        }
      }

      if (
        ["editorial_interpretation", "scenario", "watch_item"].includes(
          module.content_kind,
        ) &&
        module.reviewed_at == null
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "editorial, scenario, and watch-item modules require reviewed_at",
          path: ["modules", moduleIndex, "reviewed_at"],
        });
      }

      if (
        module.public_display_safety === "approved" &&
        ["unverified", "internal_only"].includes(module.source_confidence)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "unverified or internal-only modules cannot be approved for public display",
          path: ["modules", moduleIndex, "public_display_safety"],
        });
      }

      if (module.value_policy.may_show_advice_language !== false) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "terminal adapter modules may not allow advice language",
          path: ["modules", moduleIndex, "value_policy", "may_show_advice_language"],
        });
      }

      if (
        module.public_display_safety === "blocked" &&
        hasRenderablePayloadValue(module.payload)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "blocked modules must not contain renderable payload values",
          path: ["modules", moduleIndex, "payload"],
        });
      }

      if (
        module.null_policy === "unavailable_not_zero" &&
        rendersMissingNumericAsZero(module.payload)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "missing numeric values must not render as zero under unavailable_not_zero",
          path: ["modules", moduleIndex, "payload", "value_display"],
        });
      }
    }

    if (
      packet.packet_status === "ready" &&
      packet.modules.some((module) =>
        ["blocked", "unavailable"].includes(module.module_status),
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ready packets cannot contain blocked or unavailable modules",
        path: ["modules"],
      });
    }

    if (
      packet.packet_status === "blocked" &&
      packet.modules.some((module) => module.module_status === "ready")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "blocked packets cannot contain renderable ready modules",
        path: ["modules"],
      });
    }
  });

export type TerminalAdapterPacket = z.infer<typeof TerminalAdapterPacketSchema>;
export type TerminalAdapterModule = z.infer<typeof TerminalAdapterModuleSchema>;
export type TerminalAdapterSource = z.infer<typeof TerminalAdapterSourceSchema>;
export type TerminalAdapterSafety = z.infer<typeof TerminalAdapterSafetySchema>;
