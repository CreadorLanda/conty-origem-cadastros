export type Channel = "campaign" | "referral" | "community" | "organic";

export type Touch = {
  clickId: string;
  channel: Channel;
  occurredAt: string;
  creatorId?: string;
  source?: string;
  campaign?: string;
};

export type TouchOutcome = "won" | "after_signup" | "outside_window" | "superseded";

export type EvaluatedTouch = Touch & {
  outcome: TouchOutcome;
  reason: string;
};

export type Origin = {
  channel: Channel;
  creatorId: string | null;
  reason: string;
};

export type OriginDecision = {
  deviceId: string;
  firstOpenAt: string;
  windowEndsAt: string;
  signupAt: string;
  origin: Origin;
  touches: EvaluatedTouch[];
};

const CHANNEL_PRIORITY: Record<Channel, number> = {
  campaign: 3,
  referral: 2,
  community: 1,
  organic: 0,
};

const REASON: Record<TouchOutcome, string> = {
  won: "venceu: toque mais recente dentro da janela",
  after_signup: "perdeu: ocorreu depois do cadastro",
  outside_window: "perdeu: fora da janela de validade",
  superseded: "perdeu: um toque mais recente venceu",
};

export function decideOrigin(input: {
  deviceId: string;
  firstOpenAt: Date;
  signupAt: Date;
  validityMs: number;
  touches: Touch[];
}): OriginDecision {
  const windowEnds = new Date(input.firstOpenAt.getTime() + input.validityMs);
  const windowStart = input.firstOpenAt.getTime();
  const signup = input.signupAt.getTime();

  const candidates: Touch[] = [];
  const evaluated: EvaluatedTouch[] = [];

  for (const touch of input.touches) {
    const at = new Date(touch.occurredAt).getTime();
    if (at > signup) {
      evaluated.push({ ...touch, outcome: "after_signup", reason: REASON.after_signup });
    } else if (at < windowStart || at > windowEnds.getTime()) {
      evaluated.push({ ...touch, outcome: "outside_window", reason: REASON.outside_window });
    } else {
      candidates.push(touch);
    }
  }

  const winner = pickWinner(candidates);
  for (const touch of candidates) {
    const isWinner = winner !== null && touch.clickId === winner.clickId;
    evaluated.push({
      ...touch,
      outcome: isWinner ? "won" : "superseded",
      reason: isWinner ? REASON.won : REASON.superseded,
    });
  }

  evaluated.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

  const origin: Origin = winner
    ? { channel: winner.channel, creatorId: winner.creatorId ?? null, reason: REASON.won }
    : { channel: "organic", creatorId: null, reason: originlessReason(input.touches.length, evaluated) };

  return {
    deviceId: input.deviceId,
    firstOpenAt: input.firstOpenAt.toISOString(),
    windowEndsAt: windowEnds.toISOString(),
    signupAt: input.signupAt.toISOString(),
    origin,
    touches: evaluated,
  };
}

function pickWinner(candidates: Touch[]): Touch | null {
  let winner: Touch | null = null;
  for (const touch of candidates) {
    if (winner === null) {
      winner = touch;
      continue;
    }
    const current = new Date(touch.occurredAt).getTime();
    const best = new Date(winner.occurredAt).getTime();
    if (current > best || (current === best && CHANNEL_PRIORITY[touch.channel] > CHANNEL_PRIORITY[winner.channel])) {
      winner = touch;
    }
  }
  return winner;
}

function originlessReason(totalTouches: number, evaluated: EvaluatedTouch[]): string {
  if (totalTouches === 0) return "orgânico: nenhum toque registrado antes do cadastro";
  if (evaluated.some((touch) => touch.outcome === "after_signup")) {
    return "orgânico: todos os toques são posteriores ao cadastro ou estão fora da janela";
  }
  return "orgânico: nenhum toque dentro da janela de validade";
}
