export function addCents(a: number, b: number): number {
  return Math.round(a + b);
}

export function subtractCents(a: number, b: number): number {
  return Math.round(a - b);
}

export function multiplyRate(cents: number, multiplier: number): number {
  return Math.round(cents * multiplier);
}

export function minutesToHours(minutes: number): number {
  return minutes / 60;
}

export function calculateTimeEntryCents(rateCentsPerHour: number, durationMinutes: number): number {
  return Math.round(rateCentsPerHour * (durationMinutes / 60));
}

export function calculatePieceRateCents(unitRateCents: number, quantity: number): number {
  return Math.round(unitRateCents * quantity);
}

export interface VarianceResult {
  varianceAmountCents: number;
  variancePercent: number;
  threshold: number;
  requiresReason: boolean;
}

export function varianceCheck(subtotalCents: number, finalAmountCents: number): VarianceResult {
  const diff = Math.abs(finalAmountCents - subtotalCents);
  const percentThreshold = Math.abs(subtotalCents) * 0.02;
  const absoluteThreshold = 2500; // $25.00
  const threshold = Math.max(percentThreshold, absoluteThreshold);
  const variancePercent = subtotalCents !== 0 ? (diff / Math.abs(subtotalCents)) * 100 : (diff > 0 ? 100 : 0);
  return {
    varianceAmountCents: diff,
    variancePercent,
    threshold,
    requiresReason: diff > threshold,
  };
}

export function formatCentsToUSD(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toFixed(2)}`;
}
