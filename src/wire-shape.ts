/**
 * Restores the JSON wire shape of a value that a platform decode has already
 * enriched. A Firestore read turns a `Timestamp` into a `Date`, but a model's
 * generated schema describes the payload as it arrives on the wire — a
 * `date-time` slot there is the ISO string the converter will parse. Putting
 * the value back into that shape is what lets a read boundary check against the
 * model's own exported schema instead of a re-inlined copy of it.
 *
 * This is what the other four cores keep as an instant codec: Go's `Date`
 * marshaller, Kotlin's `OffsetDateTimeSerializer` and `CalendarDaySerializer`,
 * Swift's `parseInstant` and canonical encoder. TypeScript needs no codec — a
 * `Date` writes its own ISO form — so the same concept lands as the one walk
 * that puts an enriched value back on the wire, and it lives here for the same
 * reason: one wire rendering per graph, not one per generated package.
 *
 * Only a plain object is descended into. A class instance — a `Timestamp`, a
 * `DocumentReference`, a generated model — is left as it is, because its own
 * decode owns its shape and a blind rebuild would strip it to a bag of fields.
 *
 * The converter that follows accepts either spelling, so the returned value
 * feeds it unchanged.
 */
export function wireShape(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => wireShape(item));
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = wireShape(item);
    }
    return out;
  }
  return value;
}
