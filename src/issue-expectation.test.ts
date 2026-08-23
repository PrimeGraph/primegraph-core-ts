import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { issueExpectation } from './issue-expectation.js';

describe('issueExpectation', () => {
  it('names a lower bound by the keyword the declaration used', () => {
    assert.equal(
      issueExpectation({ code: 'too_small', origin: 'string', minimum: 3, inclusive: true }),
      'minLength 3',
    );
    assert.equal(
      issueExpectation({ code: 'too_small', origin: 'array', minimum: 2, inclusive: true }),
      'minItems 2',
    );
    assert.equal(
      issueExpectation({ code: 'too_small', origin: 'set', minimum: 1, inclusive: true }),
      'minItems 1',
    );
    assert.equal(
      issueExpectation({ code: 'too_small', origin: 'number', minimum: 5, inclusive: true }),
      'minimum 5',
    );
    assert.equal(
      issueExpectation({ code: 'too_small', origin: 'number', minimum: 5, inclusive: false }),
      'exclusiveMinimum 5',
    );
  });

  it('names an upper bound by the keyword the declaration used', () => {
    assert.equal(
      issueExpectation({ code: 'too_big', origin: 'string', maximum: 10, inclusive: true }),
      'maxLength 10',
    );
    assert.equal(
      issueExpectation({ code: 'too_big', origin: 'array', maximum: 4, inclusive: true }),
      'maxItems 4',
    );
    assert.equal(
      issueExpectation({ code: 'too_big', origin: 'int', maximum: 9, inclusive: false }),
      'exclusiveMaximum 9',
    );
    assert.equal(
      issueExpectation({ code: 'too_big', origin: 'int', maximum: 9, inclusive: true }),
      'maximum 9',
    );
  });

  it('names a format by its OpenAPI spelling', () => {
    assert.equal(issueExpectation({ code: 'invalid_format', format: 'email' }), 'format email');
    assert.equal(issueExpectation({ code: 'invalid_format', format: 'uuid' }), 'format uuid');
    assert.equal(
      issueExpectation({ code: 'invalid_format', format: 'datetime' }),
      'format date-time',
    );
  });

  it('names a pattern by the source the declaration wrote, not the stringified RegExp', () => {
    assert.equal(
      issueExpectation({ code: 'invalid_format', format: 'regex', pattern: '/^a.*z$/u' }),
      'pattern ^a.*z$',
    );
    assert.equal(
      issueExpectation({ code: 'invalid_format', format: 'regex', pattern: '^[a-z]+$' }),
      'pattern ^[a-z]+$',
    );
  });

  it('names a multiple-of constraint', () => {
    assert.equal(issueExpectation({ code: 'not_multiple_of', divisor: 5 }), 'multipleOf 5');
  });

  it('lists the declared members of an enumeration, strings quoted', () => {
    assert.equal(
      issueExpectation({ code: 'invalid_value', values: ['draft', 'live'] }),
      'one of ["draft", "live"]',
    );
    assert.equal(issueExpectation({ code: 'invalid_value', values: [1, 2] }), 'one of [1, 2]');
    assert.equal(issueExpectation({ code: 'invalid_value' }), 'a declared value');
  });

  it('names the structural constraints', () => {
    assert.equal(issueExpectation({ code: 'unrecognized_keys' }), 'no additional properties');
    assert.equal(issueExpectation({ code: 'invalid_union' }), 'any of the declared variants');
  });

  it('falls back to the expected type, then to a generic wording', () => {
    assert.equal(issueExpectation({ code: 'invalid_type', expected: 'string' }), 'string');
    assert.equal(issueExpectation({ code: 'custom' }), 'a valid value');
    assert.equal(issueExpectation({}), 'a valid value');
  });
});
