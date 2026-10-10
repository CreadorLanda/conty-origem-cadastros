import { Hono } from "hono";
import type { Channel, Touch } from "./attribution.ts";
import type { OriginTracker } from "./tracker.ts";

const CHANNELS: Channel[] = ["campaign", "referral", "community", "organic"];

export function createApp(tracker: OriginTracker) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/devices/:id/touches", async (c) => {
    const body = await c.req.json().catch(() => null);
    const touch = parseTouch(body);
    if (!touch) return c.json({ error: "toque inválido" }, 400);
    tracker.recordTouch(c.req.param("id"), touch);
    return c.json({ ok: true }, 201);
  });

  app.post("/devices/:id/signup", async (c) => {
    const body = await c.req.json().catch(() => null);
    const signupAt = parseDate((body as { signupAt?: unknown } | null)?.signupAt) ?? new Date();
    return c.json(tracker.resolveSignup(c.req.param("id"), signupAt));
  });

  app.get("/devices/:id/origin", (c) => {
    const decision = tracker.decisionFor(c.req.param("id"));
    if (!decision) return c.json({ error: "cadastro ainda não resolvido" }, 404);
    return c.json(decision);
  });

  return app;
}

function parseTouch(body: unknown): Touch | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const clickId = typeof raw.clickId === "string" ? raw.clickId : "";
  const channel = typeof raw.channel === "string" ? raw.channel : "";
  const occurredAt = typeof raw.occurredAt === "string" ? raw.occurredAt : "";
  if (!clickId || !CHANNELS.includes(channel as Channel) || !isValidDate(occurredAt)) return null;
  const touch: Touch = { clickId, channel: channel as Channel, occurredAt };
  if (typeof raw.creatorId === "string") touch.creatorId = raw.creatorId;
  if (typeof raw.source === "string") touch.source = raw.source;
  if (typeof raw.campaign === "string") touch.campaign = raw.campaign;
  return touch;
}

function parseDate(value: unknown): Date | null {
  return typeof value === "string" && isValidDate(value) ? new Date(value) : null;
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}
