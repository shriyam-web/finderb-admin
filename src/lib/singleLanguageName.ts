/** A single stray character from another script does not count as a second language. */
const MIXED_SCRIPT_MIN = 2;

export const NAME_SINGLE_LANGUAGE_HINT =
  "Write the name in one language only. Hindi and English together, or any mix of languages, will not be saved.";

export const NAME_MIXED_LANGUAGE_ERROR =
  "This name uses more than one language. Rewrite the whole name in a single language.";

function nameScript(code: number): string | null {
  if (
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a) ||
    (code >= 0xc0 && code <= 0x24f)
  ) {
    return "latin";
  }
  if (code >= 0x0900 && code <= 0x097f) {
    if (code >= 0x0964 && code <= 0x096f) return null;
    return "devanagari";
  }
  if (code >= 0x0980 && code <= 0x09ff) return "bengali";
  if (code >= 0x0a00 && code <= 0x0a7f) return "gurmukhi";
  if (code >= 0x0a80 && code <= 0x0aff) return "gujarati";
  if (code >= 0x0b00 && code <= 0x0b7f) return "oriya";
  if (code >= 0x0b80 && code <= 0x0bff) return "tamil";
  if (code >= 0x0c00 && code <= 0x0c7f) return "telugu";
  if (code >= 0x0c80 && code <= 0x0cff) return "kannada";
  if (code >= 0x0d00 && code <= 0x0d7f) return "malayalam";
  if (
    (code >= 0x0600 && code <= 0x06ff) ||
    (code >= 0x0750 && code <= 0x077f) ||
    (code >= 0x08a0 && code <= 0x08ff)
  ) {
    if (code >= 0x0660 && code <= 0x0669) return null;
    return "arabic";
  }
  if (code >= 0x0e00 && code <= 0x0e7f) return "thai";
  if (code >= 0x0400 && code <= 0x04ff) return "cyrillic";
  if (code >= 0x0590 && code <= 0x05ff) return "hebrew";
  if (code >= 0x4e00 && code <= 0x9fff) return "cjk";
  if (code >= 0x3040 && code <= 0x30ff) return "japanese";
  if (code >= 0xac00 && code <= 0xd7af) return "hangul";
  return null;
}

/** Null when the name is empty or uses a single writing system. */
export function mixedNameLanguageError(text: string): string | null {
  const counts = new Map<string, number>();
  const plain = String(text || "");
  for (let index = 0; index < plain.length; ) {
    const code = plain.codePointAt(index) ?? 0;
    index += code > 0xffff ? 2 : 1;
    const script = nameScript(code);
    if (!script) continue;
    counts.set(script, (counts.get(script) || 0) + 1);
  }
  let used = 0;
  for (const count of counts.values()) {
    if (count >= MIXED_SCRIPT_MIN) used += 1;
  }
  return used > 1 ? NAME_MIXED_LANGUAGE_ERROR : null;
}
