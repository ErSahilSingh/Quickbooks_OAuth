import crypto from "crypto";

const pending = new Map();
const TTL_MS = 10 * 60 * 1000;

export function issueState() {
  const state = crypto.randomBytes(24).toString("hex");
  pending.set(state, Date.now());
  return state;
}

export function verifyAndConsumeState(state) {
  if (!state || typeof state !== "string") return false;
  const t = pending.get(state);
  if (t == null) return false;
  pending.delete(state);
  return Date.now() - t <= TTL_MS;
}
