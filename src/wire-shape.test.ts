import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { wireShape } from './wire-shape.js';

describe('wireShape', () => {
  it('writes a Date as the ISO instant a schema declares', () => {
    assert.equal(wireShape(new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 678))), '2026-01-02T03:04:05.678Z');
  });

  it('leaves every scalar exactly as it is', () => {
    assert.equal(wireShape('text'), 'text');
    assert.equal(wireShape(42), 42);
    assert.equal(wireShape(true), true);
    assert.equal(wireShape(null), null);
    assert.equal(wireShape(undefined), undefined);
  });

  it('descends into a list', () => {
    assert.deepEqual(wireShape([new Date(0), 'a', 1]), ['1970-01-01T00:00:00.000Z', 'a', 1]);
  });

  it('descends into a plain object at any depth', () => {
    const input = { at: new Date(0), nested: { list: [{ at: new Date(0) }] } };

    assert.deepEqual(wireShape(input), {
      at: '1970-01-01T00:00:00.000Z',
      nested: { list: [{ at: '1970-01-01T00:00:00.000Z' }] },
    });
  });

  it('does not mutate the value it was given', () => {
    const at = new Date(0);
    const input = { at };

    wireShape(input);

    assert.equal(input.at, at);
  });

  it('leaves a class instance alone — its own decode owns its shape', () => {
    // A Firestore Timestamp, a DocumentReference and a generated model all
    // arrive as class instances. Rebuilding one from its entries would strip it
    // to a bag of fields and lose the methods the boundary after this reads.
    class Timestamp {
      constructor(public readonly seconds: number) {}
      toDate(): Date {
        return new Date(this.seconds * 1000);
      }
    }
    const stamp = new Timestamp(0);

    assert.equal(wireShape(stamp), stamp);
  });

  it('leaves an object with a null prototype alone', () => {
    const bare = Object.create(null) as Record<string, unknown>;
    bare['at'] = new Date(0);

    assert.equal(wireShape(bare), bare);
  });
});
