/**
 * Sanitizes and validates Gemini model identifiers.
 * 
 * Rules:
 * 1. Strip redundant "models/" prefixes.
 * 2. Preserve "tunedModels/" prefix for fine-tuned models.
 * 3. Use official, stable names.
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
  sanitized = sanitized.replace(/^(models\/)+/, "");

  // If after sanitization it's empty, use default
  if (!sanitized) return DEFAULT_MODEL;

  return sanitized;
}

export const STABLE_FALLBACK_MODEL = "gemini-1.5-flash-latest";
export const PRO_FALLBACK_MODEL = "gemini-1.5-pro-latest";
export const FLASH_20_STABLE = "gemini-2.0-flash";
