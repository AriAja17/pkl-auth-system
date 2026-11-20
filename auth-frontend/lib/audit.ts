const SENSITIVE = /password|token|secret|authorization|credential|apikey/i;

/** Defensive client-side display helper. Backend redaction remains authoritative. */
export function safeJson(value: unknown): string {
  const clean = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(clean);
    if (input !== null && typeof input === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(input as Record<string, unknown>)) {
        if (SENSITIVE.test(key)) continue;
        result[key] = clean(nested);
      }
      return result;
    }
    return input;
  };
  return JSON.stringify(clean(value), null, 2);
}
