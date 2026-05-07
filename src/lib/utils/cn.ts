import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compose Tailwind class names with conflict resolution.
 * Keep this the only sanctioned way to merge classes — it lets variants
 * and overrides stay readable without spreading conditional logic.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
