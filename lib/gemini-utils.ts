/**
 * Sanitizes and validates Gemini model identifiers.
 * 
 * Rules:
 * 1. Strip redundant "models/" prefixes (SDK usually handles this).
 * 2. Preserve "tunedModels/" prefix for fine-tuned models.
 * 3. Handle double prefixes like "models/models/".
 * 4. Default to a stable fallback if invalid or empty.
 */
export function sanitizeModelName(modelName: string | null | undefined): string {
  const DEFAULT_MODEL = "gemini-1.5-flash";
  
  if (!modelName) return DEFAULT_MODEL;

  let sanitized = modelName.trim();

  // If it's a tuned model, we MUST keep the tunedModels/ prefix
  if (sanitized.startsWith("tunedModels/")) {
    return sanitized;
  }

  // Remove redundant "models/" prefixes
  // We use a regex to strip all occurrences of "models/" at the start
  sanitized = sanitized.replace(/^(models\/)+/, "");

  // If after sanitization it's empty, use default
  if (!sanitized) return DEFAULT_MODEL;

  return sanitized;
}

export const STABLE_FALLBACK_MODEL = "gemini-1.5-flash";
