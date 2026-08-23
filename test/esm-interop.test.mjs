/**
 * The module-format claim this package rests on, checked rather than asserted.
 *
 * The build is CommonJS on purpose: the generated frontend packages are ESM and
 * the generated backend packages are CommonJS, and one CJS build is importable
 * from both. That is only worth anything if an ESM consumer gets NAMED imports
 * and the SAME class object a CommonJS consumer gets — two copies of `DslError`
 * in one graph is the failure this package exists to remove.
 *
 * The file is `.mjs` so Node loads it as ESM inside a CommonJS package, and it
 * imports `@primegraph/core` by name — a package self-reference through the
 * `exports` field, i.e. the same specifier a generated package writes.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import { coerceError, defaultErrorMessage, DslError, transportErrorCode } from '@primegraph/core';
import * as namespace from '@primegraph/core';

const require = createRequire(import.meta.url);
const cjs = require('@primegraph/core');

describe('ESM consumer of the CommonJS build', () => {
  it('named-imports every export', () => {
    assert.equal(typeof DslError, 'function');
    assert.equal(typeof coerceError, 'function');
    assert.equal(typeof defaultErrorMessage, 'function');
    assert.equal(typeof transportErrorCode, 'function');
  });

  it('holds instanceof for an instance built on the ESM side', () => {
    const error = new DslError('not-found', { id: 'u1' });

    assert.ok(error instanceof DslError);
    assert.ok(error instanceof Error);
    assert.equal(error.name, 'DslError');
  });

  it('gets the very same class object the CommonJS consumer gets', () => {
    assert.equal(DslError, cjs.DslError);
    assert.equal(DslError, namespace.DslError);
    assert.ok(new DslError('aborted', null) instanceof cjs.DslError);
    assert.ok(new cjs.DslError('aborted', null) instanceof DslError);
  });

  it('recognises an error raised on one side and coerced on the other', () => {
    const raised = new DslError('permission-denied', { reason: 'not an owner' });

    assert.deepEqual(cjs.coerceError(raised, { reason: '' }), {
      code: 'permission-denied',
      payload: { reason: 'not an owner' },
    });
    assert.deepEqual(coerceError(new cjs.DslError('cancelled', 'stopped'), ''), {
      code: 'cancelled',
      payload: 'stopped',
    });
  });

  it('recognises a foreign branded error across the boundary too', () => {
    const foreign = { name: 'DslError', code: 'already-exists', payload: 'taken' };

    assert.deepEqual(coerceError(foreign, ''), { code: 'already-exists', payload: 'taken' });
  });
});
