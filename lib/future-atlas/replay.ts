import type { ForecastEvent } from "@/lib/future-atlas/schema";

export type ForecastRuntimeState = {
  forecastId: string;
  endorsementStatus: "active" | "withdrawn";
  resolutionStatus: "open" | "true" | "false" | "indeterminate" | "void";
  resolvedByEventId: string | null;
  supersededByForecastId: string | null;
  history: ForecastEvent[];
};

type ResolutionEvent = Extract<ForecastEvent, { type: "resolution" | "resolution_correction" }>;

const isResolutionEvent = (event: ForecastEvent): event is ResolutionEvent =>
  event.type === "resolution" || event.type === "resolution_correction";

const belongsToForecast = (event: ForecastEvent, forecastId: string): boolean =>
  "forecastId" in event && event.forecastId === forecastId;

const assertAcyclic = (eventsById: Map<string, ResolutionEvent>) => {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (eventId: string) => {
    if (visited.has(eventId)) return;
    if (visiting.has(eventId)) throw new Error("resolution correction chain is cyclic");

    visiting.add(eventId);
    const event = eventsById.get(eventId);
    if (event?.type === "resolution_correction") visit(event.supersedesEventId);
    visiting.delete(eventId);
    visited.add(eventId);
  };

  for (const eventId of eventsById.keys()) visit(eventId);
};

export function replayForecast(forecastId: string, events: ForecastEvent[]): ForecastRuntimeState {
  const history = events;
  const forecastEvents = events.filter((event) => belongsToForecast(event, forecastId));
  const resolutionEvents = forecastEvents.filter(isResolutionEvent);
  const directResolutions = resolutionEvents.filter((event) => event.type === "resolution");

  if (directResolutions.length > 1) {
    throw new Error(`forecast ${forecastId} is already resolved`);
  }

  const resolutionEventsById = new Map<string, ResolutionEvent>();
  const resolutionEventOrder = new Map<string, number>();
  for (const [index, event] of resolutionEvents.entries()) {
    if (resolutionEventsById.has(event.eventId)) {
      throw new Error(`duplicate resolution event id: ${event.eventId}`);
    }
    resolutionEventsById.set(event.eventId, event);
    resolutionEventOrder.set(event.eventId, index);
  }

  for (const event of resolutionEvents) {
    if (event.type !== "resolution_correction") continue;

    const superseded = resolutionEventsById.get(event.supersedesEventId);
    if (!superseded) {
      throw new Error("resolution correction must supersede an existing resolution or resolution correction event");
    }
  }

  assertAcyclic(resolutionEventsById);

  const supersededEventIds = new Set<string>();
  for (const [index, event] of resolutionEvents.entries()) {
    if (event.type !== "resolution_correction") continue;

    if ((resolutionEventOrder.get(event.supersedesEventId) ?? index) >= index) {
      throw new Error("resolution correction must supersede an existing resolution or resolution correction event");
    }
    if (supersededEventIds.has(event.supersedesEventId)) {
      throw new Error("resolution correction chain must have one current end");
    }
    supersededEventIds.add(event.supersedesEventId);
  }

  const currentResolution = resolutionEvents.filter((event) => !supersededEventIds.has(event.eventId));
  if (currentResolution.length > 1) {
    throw new Error("resolution correction chain must have one current end");
  }

  let endorsementStatus: ForecastRuntimeState["endorsementStatus"] = "active";
  let supersededByForecastId: string | null = null;

  for (const event of forecastEvents) {
    if (event.type === "endorsement_withdrawn") {
      if (endorsementStatus === "withdrawn") {
        throw new Error(`forecast ${forecastId} is already withdrawn`);
      }
      endorsementStatus = "withdrawn";
    }
    if (event.type === "update" && event.supersededByForecastId !== undefined) {
      supersededByForecastId = event.supersededByForecastId;
    }
  }

  const resolvedBy = currentResolution[0] ?? null;

  return {
    forecastId,
    endorsementStatus,
    resolutionStatus: resolvedBy?.resolutionStatus ?? "open",
    resolvedByEventId: resolvedBy?.eventId ?? null,
    supersededByForecastId,
    history,
  };
}
