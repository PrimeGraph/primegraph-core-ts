/**
 * Turns a schema-validation issue into the expectation a consumer reads: the
 * bound, the pattern, the format, the member list — the constraint the
 * declaration stated, never the validation library's own issue code, which names
 * the library rather than the contract.
 *
 * The wording is the one every target language writes, so the same failing
 * declaration reads the same whichever language served it.
 *
 * The issue arrives as `unknown` on purpose: the shape is zod's, but nothing
 * here imports zod. `validateSchema` — which does — stays inside the generated
 * packages, and hands its issue straight through.
 */

const OPENAPI_FORMAT_NAME: Record<string, string> = { datetime: 'date-time' };

function boundKeyword(origin: unknown, low: boolean, inclusive: unknown): string {
  if (origin === 'string') {
    return low ? 'minLength' : 'maxLength';
  }
  if (origin === 'array' || origin === 'set') {
    return low ? 'minItems' : 'maxItems';
  }
  if (inclusive === false) {
    return low ? 'exclusiveMinimum' : 'exclusiveMaximum';
  }
  return low ? 'minimum' : 'maximum';
}

// A zod pattern arrives as a stringified RegExp; the declaration wrote the source.
function patternSource(pattern: string): string {
  const end = pattern.lastIndexOf('/');
  return pattern.startsWith('/') && end > 0 ? pattern.slice(1, end) : pattern;
}

function formatExpectation(issue: Record<string, unknown>): string {
  const format = String(issue['format']);
  if (format === 'regex') {
    return 'pattern ' + patternSource(String(issue['pattern']));
  }
  return 'format ' + (OPENAPI_FORMAT_NAME[format] ?? format);
}

function describeMember(value: unknown): string {
  return typeof value === 'string' ? '"' + value + '"' : String(value);
}

export function issueExpectation(raw: unknown): string {
  const issue = raw as Record<string, unknown>;
  const code = String(issue['code']);
  if (code === 'too_small') {
    return boundKeyword(issue['origin'], true, issue['inclusive']) + ' ' + String(issue['minimum']);
  }
  if (code === 'too_big') {
    return boundKeyword(issue['origin'], false, issue['inclusive']) + ' ' + String(issue['maximum']);
  }
  if (code === 'invalid_format') {
    return formatExpectation(issue);
  }
  if (code === 'not_multiple_of') {
    return 'multipleOf ' + String(issue['divisor']);
  }
  if (code === 'invalid_value') {
    const values = issue['values'];
    return Array.isArray(values)
      ? 'one of [' + values.map(describeMember).join(', ') + ']'
      : 'a declared value';
  }
  if (code === 'unrecognized_keys') {
    return 'no additional properties';
  }
  if (code === 'invalid_union') {
    return 'any of the declared variants';
  }
  const expected = issue['expected'];
  return expected === undefined ? 'a valid value' : String(expected);
}
