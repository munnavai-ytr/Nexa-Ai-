/**
 * Sanitizes and validates Gemini model identifiers.
 * 
 * Rules:
 * 1. Strip redundant "models/" prefixes.
 * 2. Preserve "tunedModels/" prefix for fine-tuned models.
 * 3. Handle double prefixes.
 * 4. Use official, stable aliases (e.g. gemini-1.5-flash).
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

  // Handle common misspellings or legacy placeholders
  if (sanitized.includes("3.7") || sanitized.includes("3.1")) {
    sanitized = sanitized.replace("3.7", "2.0").replace("3.1", "1.5");
  }

  // If after sanitization it's empty, use default
  if (!sanitized) return DEFAULT_MODEL;

  return sanitized;
}

export const STABLE_FALLBACK_MODEL = "gemini-1.5-flash";
export const PRO_FALLBACK_MODEL = "gemini-1.5-pro";
export const FLASH_LITE_FALLBACK = "gemini-2.0-flash-lite-preview-02-05";
