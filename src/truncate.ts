import { SourcePreview } from "./types";

export function clampNumber(value: unknown, defaultValue: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultValue;
  }
  const integer = Math.trunc(value);
  return Math.min(max, Math.max(min, integer));
}

export function truncateText(text: string, maxChars: number): SourcePreview {
  const safeMax = Math.max(0, Math.trunc(maxChars));
  const totalChars = Array.from(text).length;

  if (totalChars <= safeMax) {
    return { text, truncated: false, totalChars };
  }

  return {
    text: Array.from(text).slice(0, safeMax).join(""),
    truncated: true,
    totalChars
  };
}
