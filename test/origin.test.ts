import { describe, expect, it } from "vitest";
import type { Touch } from "../src/attribution.ts";
import { OriginTracker } from "../src/tracker.ts";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function touch(partial: Partial<Touch> & Pick<Touch, "clickId" | "channel" | "occurredAt">): Touch {
  return partial;
}

describe("origem do cadastro", () => {
  it("marca orgânico com motivo quando não há nenhum toque", () => {
    const tracker = new OriginTracker(DAY);
    const decision = tracker.resolveSignup("dev_1", new Date("2026-06-01T12:00:00.000Z"));
    expect(decision.origin.channel).toBe("organic");
    expect(decision.origin.creatorId).toBeNull();
    expect(decision.origin.reason).toContain("orgânico");
    expect(decision.touches).toHaveLength(0);
  });

  it("o mesmo clique não cria duas origens", () => {
    const tracker = new OriginTracker(DAY);
    const click = touch({ clickId: "c1", channel: "campaign", occurredAt: "2026-06-01T10:00:00.000Z", creatorId: "ana" });
    tracker.recordTouch("dev_1", click);
    tracker.recordTouch("dev_1", click);
    const decision = tracker.resolveSignup("dev_1", new Date("2026-06-01T12:00:00.000Z"));
    expect(decision.touches).toHaveLength(1);
    expect(decision.origin.creatorId).toBe("ana");
  });

  it("o toque mais recente dentro da janela vence entre dois links", () => {
    const tracker = new OriginTracker(DAY);
    tracker.recordTouch("dev_1", touch({ clickId: "c1", channel: "campaign", occurredAt: "2026-06-01T10:00:00.000Z", creatorId: "ana" }));
    tracker.recordTouch("dev_1", touch({ clickId: "c2", channel: "referral", occurredAt: "2026-06-01T11:00:00.000Z", creatorId: "bruno" }));
    const decision = tracker.resolveSignup("dev_1", new Date("2026-06-01T12:00:00.000Z"));
    expect(decision.origin).toMatchObject({ channel: "referral", creatorId: "bruno" });
    const winner = decision.touches.find((item) => item.outcome === "won");
    expect(winner?.clickId).toBe("c2");
  });

  it("no empate de horário vence o canal de maior prioridade", () => {
    const tracker = new OriginTracker(DAY);
    tracker.recordTouch("dev_1", touch({ clickId: "c1", channel: "referral", occurredAt: "2026-06-01T10:00:00.000Z", creatorId: "bruno" }));
    tracker.recordTouch("dev_1", touch({ clickId: "c2", channel: "campaign", occurredAt: "2026-06-01T10:00:00.000Z", creatorId: "ana" }));
    const decision = tracker.resolveSignup("dev_1", new Date("2026-06-01T12:00:00.000Z"));
    expect(decision.origin).toMatchObject({ channel: "campaign", creatorId: "ana" });
  });

  it("toque posterior ao cadastro não vence", () => {
    const tracker = new OriginTracker(DAY);
    tracker.recordTouch("dev_1", touch({ clickId: "c1", channel: "campaign", occurredAt: "2026-06-01T10:00:00.000Z", creatorId: "ana" }));
    tracker.recordTouch("dev_1", touch({ clickId: "c2", channel: "referral", occurredAt: "2026-06-01T13:00:00.000Z", creatorId: "bruno" }));
    const decision = tracker.resolveSignup("dev_1", new Date("2026-06-01T12:00:00.000Z"));
    expect(decision.origin.creatorId).toBe("ana");
    expect(decision.touches.find((item) => item.clickId === "c2")?.outcome).toBe("after_signup");
  });

  it("toque fora da janela de validade não vence", () => {
    const tracker = new OriginTracker(HOUR);
    tracker.recordTouch("dev_1", touch({ clickId: "c1", channel: "campaign", occurredAt: "2026-06-01T10:00:00.000Z", creatorId: "ana" }));
    tracker.recordTouch("dev_1", touch({ clickId: "c2", channel: "referral", occurredAt: "2026-06-01T11:30:00.000Z", creatorId: "bruno" }));
    const decision = tracker.resolveSignup("dev_1", new Date("2026-06-01T12:00:00.000Z"));
    expect(decision.origin.creatorId).toBe("ana");
    expect(decision.touches.find((item) => item.clickId === "c2")?.outcome).toBe("outside_window");
    expect(decision.windowEndsAt).toBe("2026-06-01T11:00:00.000Z");
  });

  it("congela a decisão: link aberto depois do cadastro não entra", () => {
    const tracker = new OriginTracker(DAY);
    tracker.recordTouch("dev_1", touch({ clickId: "c1", channel: "campaign", occurredAt: "2026-06-01T10:00:00.000Z", creatorId: "ana" }));
    const decision = tracker.resolveSignup("dev_1", new Date("2026-06-01T12:00:00.000Z"));
    tracker.recordTouch("dev_1", touch({ clickId: "c2", channel: "referral", occurredAt: "2026-06-01T11:00:00.000Z", creatorId: "bruno" }));
    expect(tracker.resolveSignup("dev_1", new Date("2026-06-01T12:00:00.000Z"))).toEqual(decision);
  });

  it("deixa auditar por que cada toque venceu ou perdeu", () => {
    const tracker = new OriginTracker(DAY);
    tracker.recordTouch("dev_1", touch({ clickId: "c1", channel: "campaign", occurredAt: "2026-06-01T10:00:00.000Z", creatorId: "ana" }));
    tracker.recordTouch("dev_1", touch({ clickId: "c2", channel: "referral", occurredAt: "2026-06-01T11:00:00.000Z", creatorId: "bruno" }));
    const decision = tracker.resolveSignup("dev_1", new Date("2026-06-01T12:00:00.000Z"));
    for (const item of decision.touches) {
      expect(item.reason.length).toBeGreaterThan(0);
    }
    expect(decision.touches.filter((item) => item.outcome === "won")).toHaveLength(1);
    expect(decision.touches.filter((item) => item.outcome === "superseded")).toHaveLength(1);
  });
});
