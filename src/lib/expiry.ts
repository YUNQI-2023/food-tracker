import { addDays, differenceInDays, isBefore } from "date-fns";

export type ExpiryStatus = "fresh" | "expiring_soon" | "expired" | "consumed" | "unknown";

/** Explains how the expiry date was determined */
export type ExpirySource = "explicit" | "opened_rule" | "estimated_unopened" | "shelf_life" | "none";

interface ExpiryInput {
  expiryDate?: Date | null;
  estimatedExpiryDate?: Date | null;
  openedDate?: Date | null;
  purchaseDate: Date;
  shelfLifeDays?: number | null;
  openedShelfLifeDays?: number | null;
  status?: string;
}

const EXPIRING_SOON_DAYS = 7;

/** Calculate the effective expiry date with source explanation */
export function getEffectiveExpiryDateWithSource(input: ExpiryInput): {
  date: Date | null;
  source: ExpirySource;
} {
  // 1. Explicit expiry date takes highest priority
  if (input.expiryDate) {
    // But if item is opened and opened shelf life gives earlier date, use that
    if (input.openedDate && input.openedShelfLifeDays) {
      const openedExpiry = addDays(input.openedDate, input.openedShelfLifeDays);
      if (isBefore(openedExpiry, input.expiryDate)) {
        return { date: openedExpiry, source: "opened_rule" };
      }
    }
    return { date: input.expiryDate, source: "explicit" };
  }

  // 2. If opened and openedShelfLifeDays exists, use that
  if (input.openedDate && input.openedShelfLifeDays) {
    return {
      date: addDays(input.openedDate, input.openedShelfLifeDays),
      source: "opened_rule",
    };
  }

  // 3. If estimated expiry is set (e.g. from import)
  if (input.estimatedExpiryDate) {
    return { date: input.estimatedExpiryDate, source: "estimated_unopened" };
  }

  // 4. Fallback: purchase date + shelf life
  if (input.shelfLifeDays) {
    return {
      date: addDays(input.purchaseDate, input.shelfLifeDays),
      source: "shelf_life",
    };
  }

  return { date: null, source: "none" };
}

/** Calculate the effective expiry date based on business rules */
export function getEffectiveExpiryDate(input: ExpiryInput): Date | null {
  return getEffectiveExpiryDateWithSource(input).date;
}

/** Determine the current status of an inventory item */
export function computeExpiryStatus(input: ExpiryInput): ExpiryStatus {
  if (input.status === "consumed") return "consumed";

  const effectiveExpiry = getEffectiveExpiryDate(input);
  if (!effectiveExpiry) return "unknown";

  const now = new Date();

  if (isBefore(effectiveExpiry, now)) {
    return "expired";
  }

  const days = differenceInDays(effectiveExpiry, now);
  if (days <= EXPIRING_SOON_DAYS) {
    return "expiring_soon";
  }

  return "fresh";
}

/** Get days until expiry, negative means already expired */
export function daysUntilExpiry(input: ExpiryInput): number | null {
  const effectiveExpiry = getEffectiveExpiryDate(input);
  if (!effectiveExpiry) return null;
  return differenceInDays(effectiveExpiry, new Date());
}

/** Format expiry status for display */
export function formatExpiryStatus(status: ExpiryStatus): string {
  switch (status) {
    case "fresh": return "Fresh";
    case "expiring_soon": return "Expiring Soon";
    case "expired": return "Expired";
    case "consumed": return "Consumed";
    case "unknown": return "No Expiry Info";
  }
}

/** Get badge color class for status */
export function statusColor(status: ExpiryStatus): string {
  switch (status) {
    case "fresh": return "bg-green-100 text-green-800";
    case "expiring_soon": return "bg-amber-100 text-amber-800";
    case "expired": return "bg-red-100 text-red-800";
    case "consumed": return "bg-gray-100 text-gray-600";
    case "unknown": return "bg-gray-100 text-gray-600";
  }
}

/** Human-readable expiry source label */
export function expirySourceLabel(source: ExpirySource): string {
  switch (source) {
    case "explicit": return "Package date";
    case "opened_rule": return "Opened rule";
    case "estimated_unopened": return "Estimated";
    case "shelf_life": return "Shelf life";
    case "none": return "";
  }
}
