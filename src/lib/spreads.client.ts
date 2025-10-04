// src/lib/spreads.client.ts
import YAML from "yaml";

export type SpreadsConfig = any;

// Charge /public/config/tarot-spreads.yaml
export async function loadSpreadsConfigClient(): Promise<SpreadsConfig> {
  const res = await fetch("/config/tarot-spreads.yaml", { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} en chargeant /config/tarot-spreads.yaml`);
  const text = await res.text();
  return YAML.parse(text);
}