import { type OriginDecision, type Touch, decideOrigin } from "./attribution.ts";

export const DEFAULT_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;

type DeviceState = {
  firstOpenAt: Date;
  touches: Map<string, Touch>;
  decision: OriginDecision | null;
};

export class OriginTracker {
  private readonly devices = new Map<string, DeviceState>();

  constructor(private readonly validityMs: number = DEFAULT_VALIDITY_MS) {}

  recordTouch(deviceId: string, touch: Touch): void {
    const state = this.devices.get(deviceId);
    const at = new Date(touch.occurredAt);
    if (!state) {
      this.devices.set(deviceId, {
        firstOpenAt: at,
        touches: new Map([[touch.clickId, touch]]),
        decision: null,
      });
      return;
    }
    if (state.decision) return;
    if (!state.touches.has(touch.clickId)) {
      state.touches.set(touch.clickId, touch);
      if (at.getTime() < state.firstOpenAt.getTime()) state.firstOpenAt = at;
    }
  }

  resolveSignup(deviceId: string, signupAt: Date): OriginDecision {
    const state = this.devices.get(deviceId);
    if (!state) {
      return decideOrigin({
        deviceId,
        firstOpenAt: signupAt,
        signupAt,
        validityMs: this.validityMs,
        touches: [],
      });
    }
    if (state.decision) return state.decision;

    const decision = decideOrigin({
      deviceId,
      firstOpenAt: state.firstOpenAt,
      signupAt,
      validityMs: this.validityMs,
      touches: [...state.touches.values()],
    });
    state.decision = decision;
    return decision;
  }

  decisionFor(deviceId: string): OriginDecision | null {
    return this.devices.get(deviceId)?.decision ?? null;
  }
}
