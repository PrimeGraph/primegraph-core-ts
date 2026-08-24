/**
 * The error vocabulary every generated TypeScript package shares.
 *
 * `DslError` is the only nominal type in the TypeScript runtime, and it is the
 * reason this package exists: while a generated package carried its own copy of
 * the class, a graph spanning several packages held several copies of it.
 * TypeScript is structurally typed, so `tsc` unified them without a word, and
 * the one place identity is actually tested — the recognition step in
 * `coerceError` — silently degraded a cross-package error to `INTERNAL_ERROR`.
 */

/**
 * The brand `DslError` stamps on every instance. Recognition reads this rather
 * than the class identity, so a second copy of the class in one graph cannot
 * make a raised error unrecognizable.
 */
const DSL_ERROR_NAME = 'DslError';

/**
 * The `{ code, payload }` a caught DSL error is projected onto — the same view
 * the other four cores name `DslErrorView<Payload>`. TypeScript is structurally
 * typed, so naming the shape binds no call site to the declaration; the name is
 * here so the five cores describe the concept with one word instead of four
 * plus an anonymous type.
 *
 * The members are mutable, exactly as the anonymous shape was: a `readonly`
 * here would reject an assignment that compiles today.
 */
export interface DslErrorView<TPayload> {
  code: string;
  payload: TPayload;
}

export class DslError<TPayload> extends Error {
  override readonly name = 'DslError' as const;
  constructor(public readonly code: string, public readonly payload: TPayload) {
    super(code);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// The gRPC status a JS SDK reports a transport failure with, named in the
// DSL code space. Firestore and the other google-cloud surfaces put the
// NUMERIC status on `.code` (6 is ALREADY_EXISTS); the callable, auth and
// storage surfaces put a string there, sometimes namespaced. Naming both
// lets a catch on err.code == 'already-exists' match whichever SDK failed,
// and answers it with the status its DSL code carries.
const TRANSPORT_ERROR_CODES: Readonly<Record<number, string>> = {
  1: 'cancelled',
  2: 'unknown',
  3: 'invalid-argument',
  4: 'deadline-exceeded',
  5: 'not-found',
  6: 'already-exists',
  7: 'permission-denied',
  8: 'resource-exhausted',
  9: 'failed-precondition',
  10: 'aborted',
  11: 'out-of-range',
  12: 'unknown',
  13: 'internal',
  14: 'unavailable',
  15: 'data-loss',
  16: 'unauthenticated',
};

const DSL_ERROR_CODES: ReadonlySet<string> = new Set([
  'invalid-argument',
  'failed-precondition',
  'out-of-range',
  'unauthenticated',
  'permission-denied',
  'not-found',
  'already-exists',
  'resource-exhausted',
  'cancelled',
  'data-loss',
  'unknown',
  'internal',
  'unavailable',
  'deadline-exceeded',
  'aborted',
]);

// The codes whose SDK spelling differs from the status they name: the
// auth failures the JS SDK words its own way, and CONFLICT, the bare
// 409 firebase-admin raises when the server said neither ABORTED nor
// ALREADY_EXISTS. The same failure carries the gRPC name itself on the
// other platforms, so the alias keeps one SDK call answering one DSL
// code everywhere.
const TRANSPORT_ERROR_ALIASES: Readonly<Record<string, string>> = {
  'user-not-found': 'not-found',
  'email-already-exists': 'already-exists',
  'uid-already-exists': 'already-exists',
  'phone-number-already-exists': 'already-exists',
  'insufficient-permission': 'permission-denied',
  conflict: 'aborted',
};

/**
 * A table read by an own key only. The keys come from a caught `unknown`, so a
 * lookup of `'constructor'` or `'toString'` would otherwise answer with a
 * function off `Object.prototype` where the signature promises a string.
 */
function lookup(table: Readonly<Record<string, string>>, key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

// The DSL code a raw SDK failure presents, null when nothing names it.
export function transportErrorCode(e: unknown): string | null {
  const raw = (e as { code?: unknown } | null | undefined)?.code;
  if (typeof raw === 'number') {
    return TRANSPORT_ERROR_CODES[raw] ?? null;
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const bare = raw.slice(raw.lastIndexOf('/') + 1).toLowerCase().replace(/_/gu, '-');
  const named = lookup(TRANSPORT_ERROR_ALIASES, bare) ?? bare;
  return DSL_ERROR_CODES.has(named) ? named : null;
}

// Default text of each error code. A coerced error has no message of its own —
// a foreign SDK's wording never reaches a client — so a text payload slot it
// leaves empty is filled from here, and the error view always carries a code
// AND a message.
const DSL_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'AUTH_REQUIRED': 'Authorization required',
  'VALIDATION_FAILED': 'Request validation failed',
  'INTERNAL_ERROR': 'Internal server error',
  'NOT_FOUND': 'Resource not found',
  'METHOD_NOT_ALLOWED': 'Method not allowed',
  'FORBIDDEN': 'Access forbidden',
  'NO_RESPONSE': 'Block did not produce a response',
  'invalid-argument': 'Invalid argument',
  'failed-precondition': 'Failed precondition',
  'out-of-range': 'Value out of range',
  'unauthenticated': 'Authorization required',
  'permission-denied': 'Access forbidden',
  'not-found': 'Resource not found',
  'already-exists': 'Resource already exists',
  'resource-exhausted': 'Resource exhausted',
  'cancelled': 'Request cancelled',
  'data-loss': 'Data loss',
  'unknown': 'Unknown error',
  'internal': 'Internal server error',
  'unavailable': 'Service unavailable',
  'deadline-exceeded': 'Deadline exceeded',
  'aborted': 'Operation aborted',
  'UNSUPPORTED_MEDIA_TYPE': 'Unsupported media type',
  'UTF8_DECODE_FAILED': 'Input is not valid UTF-8',
  'BASE64_DECODE_FAILED': 'Input is not valid base64',
  'HEX_DECODE_FAILED': 'Input is not valid hex',
  'URL_DECODE_FAILED': 'Input is not valid percent-encoded text',
  'ENUM_VALUE_NOT_A_MEMBER': 'Value is not a member of the enumeration',
  'JSON_PARSE_FAILED': 'Input is not valid JSON',
  'DECIMAL_PARSE_FAILED': 'Input is not a decimal number',
  'DURATION_PARSE_FAILED': 'Input is not a valid duration',
  'TIME_PARSE_FAILED': 'Input does not match the expected time format',
};

export function defaultErrorMessage(code: string): string {
  return lookup(DSL_ERROR_MESSAGES, code) ?? 'Internal server error';
}

function coercedPayload<T>(code: string, defaultPayload: T): T {
  if (typeof defaultPayload === 'string' && defaultPayload === '') {
    return defaultErrorMessage(code) as unknown as T;
  }
  return defaultPayload;
}

/**
 * The `{ code, payload }` a DSL-raised error carries, or null when the value is
 * not one.
 *
 * Recognition is by BRAND, not by module identity. `instanceof` is kept only as
 * the fast path: it answers `false` for an error raised through a second copy of
 * the class — an npm nesting, a version skew, a package that still ships its own
 * runtime — and a copy is exactly what a multi-package graph can hold. What
 * decides is the brand `name === 'DslError'` together with the `{ code, payload }`
 * shape, so an error crossing a package boundary keeps its code and its typed
 * payload instead of degrading to INTERNAL_ERROR with nothing raised and nothing
 * logged.
 */
function dslErrorView(e: unknown): DslErrorView<unknown> | null {
  if (e instanceof DslError) {
    return { code: e.code, payload: e.payload };
  }
  if (e === null || typeof e !== 'object') {
    return null;
  }
  const candidate = e as { name?: unknown; code?: unknown; payload?: unknown };
  if (candidate.name !== DSL_ERROR_NAME || typeof candidate.code !== 'string') {
    return null;
  }
  // `payload` is read by presence, not by value: a payload type whose default is
  // `undefined` is still a payload the raise site declared.
  if (!('payload' in candidate)) {
    return null;
  }
  return { code: candidate.code, payload: candidate.payload };
}

// Projects ANY caught error onto the catch binding `{ code, payload }`. A DSL
// raise yields its own code + typed payload. A transport/SDK failure (Firestore,
// Firebase callable, ...) is named in the DSL code space by transportErrorCode,
// so a `catch` on `err.code == '...'` matches. Anything else becomes
// 'INTERNAL_ERROR' with the default payload of the catch's declared type, so a
// broad `catch` always hands the body a well-shaped { code, payload } value.
//
// A foreign error carries no typed payload, so its own text would be lost here.
// It goes to the log instead of the returned view: the code is what a caller may
// put on the wire, the text stays server-side.
export function coerceError<T>(e: unknown, defaultPayload: T): DslErrorView<T> {
  const raised = dslErrorView(e);
  if (raised !== null) {
    return { code: raised.code, payload: raised.payload as T };
  }
  const code = transportErrorCode(e) ?? 'INTERNAL_ERROR';
  console.error('[dsl] error coerced to ' + code + ':', e);
  return { code, payload: coercedPayload(code, defaultPayload) };
}
