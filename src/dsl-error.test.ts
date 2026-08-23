import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { coerceError, defaultErrorMessage, DslError, transportErrorCode } from './dsl-error.js';

/** Runs `fn` with `console.error` captured, and returns what it was handed. */
function withCapturedLog<T>(fn: () => T): { result: T; logged: unknown[][] } {
  const original = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]): void => {
    logged.push(args);
  };
  try {
    return { result: fn(), logged };
  } finally {
    console.error = original;
  }
}

/**
 * A second, independent copy of the class — what a graph actually holds when one
 * package still ships its own emitted runtime, or when npm nests two versions of
 * this one. It is not `DslError`, and `instanceof DslError` is false for it.
 */
class ForeignDslError<TPayload> extends Error {
  override readonly name = 'DslError' as const;
  constructor(public readonly code: string, public readonly payload: TPayload) {
    super(code);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

describe('DslError', () => {
  it('carries the code and the typed payload it was raised with', () => {
    const error = new DslError('VALIDATION_FAILED', { path: 'input.email', expected: 'format email' });

    assert.equal(error.code, 'VALIDATION_FAILED');
    assert.deepEqual(error.payload, { path: 'input.email', expected: 'format email' });
  });

  it('brands every instance with the name recognition reads', () => {
    assert.equal(new DslError('not-found', 'gone').name, 'DslError');
  });

  it('is an Error whose message is the code', () => {
    const error = new DslError('internal', 0);

    assert.ok(error instanceof Error);
    assert.equal(error.message, 'internal');
    assert.equal(typeof error.stack, 'string');
  });

  it('answers instanceof for a native instance', () => {
    assert.ok(new DslError('aborted', null) instanceof DslError);
  });

  it('keeps instanceof working through a subclass', () => {
    class Specific extends DslError<string> {}

    const error = new Specific('cancelled', 'stopped');

    assert.ok(error instanceof Specific);
    assert.ok(error instanceof DslError);
  });

  it('accepts a payload whose declared default is undefined', () => {
    const error = new DslError<string | undefined>('unknown', undefined);

    assert.equal(error.payload, undefined);
    assert.ok('payload' in error);
  });
});

describe('coerceError', () => {
  it('passes a native DslError through untouched and logs nothing', () => {
    const { result, logged } = withCapturedLog(() =>
      coerceError(new DslError('not-found', { id: 'u1' }), { id: '' }),
    );

    assert.deepEqual(result, { code: 'not-found', payload: { id: 'u1' } });
    assert.equal(logged.length, 0);
  });

  it('recognises a FOREIGN error carrying the brand and the shape', () => {
    // The whole point of the package: this object comes from a second copy of
    // the class, so `instanceof DslError` is false for it. Recognition by brand
    // is what keeps its code and payload instead of degrading to INTERNAL_ERROR.
    const foreign = new ForeignDslError('permission-denied', { reason: 'not an owner' });

    assert.equal(foreign instanceof DslError, false);

    const { result, logged } = withCapturedLog(() => coerceError(foreign, { reason: '' }));

    assert.deepEqual(result, { code: 'permission-denied', payload: { reason: 'not an owner' } });
    assert.equal(logged.length, 0);
  });

  it('recognises a branded plain object that never went through any class', () => {
    const foreign = { name: 'DslError', code: 'already-exists', payload: 'taken' };

    const { result, logged } = withCapturedLog(() => coerceError(foreign, ''));

    assert.deepEqual(result, { code: 'already-exists', payload: 'taken' });
    assert.equal(logged.length, 0);
  });

  it('recognises a branded value whose payload is undefined', () => {
    const foreign = { name: 'DslError', code: 'cancelled', payload: undefined };

    const { result } = withCapturedLog(() => coerceError(foreign, 'fallback'));

    assert.deepEqual(result, { code: 'cancelled', payload: undefined });
  });

  it('rejects a near miss: the brand without a payload slot', () => {
    const { result } = withCapturedLog(() => coerceError({ name: 'DslError', code: 'x' }, 'default'));

    assert.deepEqual(result, { code: 'INTERNAL_ERROR', payload: 'default' });
  });

  it('rejects a near miss: the brand with a non-string code', () => {
    const { result } = withCapturedLog(() =>
      coerceError({ name: 'DslError', code: 7, payload: 'p' }, 'default'),
    );

    // 7 is still a gRPC status, so the transport table names it — but not the
    // brand path, which requires a string code.
    assert.deepEqual(result, { code: 'permission-denied', payload: 'default' });
  });

  it('rejects a near miss: the DslError shape without the brand', () => {
    const { result } = withCapturedLog(() =>
      coerceError({ name: 'Error', code: 'not-found', payload: 'p' }, 'default'),
    );

    assert.deepEqual(result, { code: 'not-found', payload: 'default' });
  });

  it('coerces a plain Error to INTERNAL_ERROR and logs it', () => {
    const { result, logged } = withCapturedLog(() => coerceError(new Error('boom'), { ok: false }));

    assert.deepEqual(result, { code: 'INTERNAL_ERROR', payload: { ok: false } });
    assert.equal(logged.length, 1);
    assert.equal(logged[0]?.[0], '[dsl] error coerced to INTERNAL_ERROR:');
  });

  it('coerces a value that is not an object at all', () => {
    for (const thrown of [undefined, null, 'boom', 42]) {
      const { result } = withCapturedLog(() => coerceError(thrown, 0));

      assert.deepEqual(result, { code: 'INTERNAL_ERROR', payload: 0 });
    }
  });

  it('names a gRPC-shaped SDK failure in the DSL code space', () => {
    const sdkError = Object.assign(new Error('NOT_FOUND: no such document'), { code: 5 });

    const { result } = withCapturedLog(() => coerceError(sdkError, 'default'));

    assert.deepEqual(result, { code: 'not-found', payload: 'default' });
  });

  it('names a namespaced auth failure through the alias table', () => {
    const sdkError = Object.assign(new Error('no user'), { code: 'auth/user-not-found' });

    const { result } = withCapturedLog(() => coerceError(sdkError, 'default'));

    assert.deepEqual(result, { code: 'not-found', payload: 'default' });
  });

  it('names the bare 409 CONFLICT firebase-admin raises', () => {
    const sdkError = Object.assign(new Error('conflict'), { code: 'CONFLICT' });

    const { result } = withCapturedLog(() => coerceError(sdkError, 'default'));

    assert.deepEqual(result, { code: 'aborted', payload: 'default' });
  });

  it('fills an empty text payload with the default message of the code', () => {
    const sdkError = Object.assign(new Error('gone'), { code: 5 });

    const { result } = withCapturedLog(() => coerceError(sdkError, ''));

    assert.deepEqual(result, { code: 'not-found', payload: 'Resource not found' });
  });

  it('leaves a non-empty text payload alone', () => {
    const { result } = withCapturedLog(() => coerceError(new Error('boom'), 'declared default'));

    assert.deepEqual(result, { code: 'INTERNAL_ERROR', payload: 'declared default' });
  });
});

describe('transportErrorCode', () => {
  const NUMERIC: readonly (readonly [number, string])[] = [
    [1, 'cancelled'],
    [2, 'unknown'],
    [3, 'invalid-argument'],
    [4, 'deadline-exceeded'],
    [5, 'not-found'],
    [6, 'already-exists'],
    [7, 'permission-denied'],
    [8, 'resource-exhausted'],
    [9, 'failed-precondition'],
    [10, 'aborted'],
    [11, 'out-of-range'],
    [12, 'unknown'],
    [13, 'internal'],
    [14, 'unavailable'],
    [15, 'data-loss'],
    [16, 'unauthenticated'],
  ];

  it('names every gRPC status a JS SDK reports numerically', () => {
    for (const [status, code] of NUMERIC) {
      assert.equal(transportErrorCode({ code: status }), code, 'status ' + status);
    }
  });

  it('answers null for a status number nothing names', () => {
    assert.equal(transportErrorCode({ code: 0 }), null);
    assert.equal(transportErrorCode({ code: 99 }), null);
  });

  it('reads a string code, strips the namespace and normalises the spelling', () => {
    assert.equal(transportErrorCode({ code: 'not-found' }), 'not-found');
    assert.equal(transportErrorCode({ code: 'functions/not-found' }), 'not-found');
    assert.equal(transportErrorCode({ code: 'ALREADY_EXISTS' }), 'already-exists');
    assert.equal(transportErrorCode({ code: 'storage/unauthenticated' }), 'unauthenticated');
  });

  it('applies every alias of an SDK spelling that differs from the status', () => {
    const aliases: Readonly<Record<string, string>> = {
      'auth/user-not-found': 'not-found',
      'auth/email-already-exists': 'already-exists',
      'auth/uid-already-exists': 'already-exists',
      'auth/phone-number-already-exists': 'already-exists',
      'auth/insufficient-permission': 'permission-denied',
      CONFLICT: 'aborted',
      conflict: 'aborted',
    };

    for (const [raw, named] of Object.entries(aliases)) {
      assert.equal(transportErrorCode({ code: raw }), named, raw);
    }
  });

  it('answers null when nothing names the code', () => {
    assert.equal(transportErrorCode({ code: 'no-such-thing' }), null);
    assert.equal(transportErrorCode({ code: true }), null);
    assert.equal(transportErrorCode({}), null);
    assert.equal(transportErrorCode(new Error('boom')), null);
    assert.equal(transportErrorCode(null), null);
    assert.equal(transportErrorCode(undefined), null);
    assert.equal(transportErrorCode('not-found'), null);
  });
});

describe('defaultErrorMessage', () => {
  const MESSAGES: Readonly<Record<string, string>> = {
    AUTH_REQUIRED: 'Authorization required',
    VALIDATION_FAILED: 'Request validation failed',
    INTERNAL_ERROR: 'Internal server error',
    NOT_FOUND: 'Resource not found',
    METHOD_NOT_ALLOWED: 'Method not allowed',
    FORBIDDEN: 'Access forbidden',
    NO_RESPONSE: 'Block did not produce a response',
    'invalid-argument': 'Invalid argument',
    'failed-precondition': 'Failed precondition',
    'out-of-range': 'Value out of range',
    unauthenticated: 'Authorization required',
    'permission-denied': 'Access forbidden',
    'not-found': 'Resource not found',
    'already-exists': 'Resource already exists',
    'resource-exhausted': 'Resource exhausted',
    cancelled: 'Request cancelled',
    'data-loss': 'Data loss',
    unknown: 'Unknown error',
    internal: 'Internal server error',
    unavailable: 'Service unavailable',
    'deadline-exceeded': 'Deadline exceeded',
    aborted: 'Operation aborted',
    UNSUPPORTED_MEDIA_TYPE: 'Unsupported media type',
    UTF8_DECODE_FAILED: 'Input is not valid UTF-8',
    BASE64_DECODE_FAILED: 'Input is not valid base64',
    HEX_DECODE_FAILED: 'Input is not valid hex',
    URL_DECODE_FAILED: 'Input is not valid percent-encoded text',
    ENUM_VALUE_NOT_A_MEMBER: 'Value is not a member of the enumeration',
    JSON_PARSE_FAILED: 'Input is not valid JSON',
    DECIMAL_PARSE_FAILED: 'Input is not a decimal number',
    DURATION_PARSE_FAILED: 'Input is not a valid duration',
    TIME_PARSE_FAILED: 'Input does not match the expected time format',
  };

  it('answers the declared text of every known code', () => {
    for (const [code, message] of Object.entries(MESSAGES)) {
      assert.equal(defaultErrorMessage(code), message, code);
    }
  });

  it('falls back to the internal-error text for a code it does not know', () => {
    assert.equal(defaultErrorMessage('NO_SUCH_CODE'), 'Internal server error');
    assert.equal(defaultErrorMessage(''), 'Internal server error');
  });

  it('does not answer from the object prototype', () => {
    assert.equal(defaultErrorMessage('toString'), 'Internal server error');
    assert.equal(defaultErrorMessage('constructor'), 'Internal server error');
  });
});
