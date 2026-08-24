import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as core from './index.js';
import type {
  AdminOptions,
  DslErrorView,
  HttpAuth,
  HttpRequest,
  HttpTextResponse,
} from './index.js';

describe('public surface', () => {
  it('exports exactly the names the generated packages use', () => {
    assert.deepEqual(Object.keys(core).sort(), [
      'DslError',
      'coerceError',
      'defaultErrorMessage',
      'issueExpectation',
      'transportErrorCode',
      'wireShape',
    ]);
  });
});

describe('shared declarations', () => {
  it('types one HTTP request, auth included', () => {
    const auth: HttpAuth = { type: 'http', scheme: 'bearer', token: 't' };
    const request: HttpRequest<{ id: string }> = {
      url: 'https://example.test/v1/items',
      method: 'POST',
      headers: { Accept: 'application/json' },
      query: { dryRun: true },
      body: { id: 'i1' },
      auth,
      timeout: 5000,
    };

    assert.equal(request.auth?.token, 't');
    assert.equal(request.body?.id, 'i1');
  });

  it('types a request that declares nothing beyond the url and the method', () => {
    const request: HttpRequest<never> = { url: 'https://example.test', method: 'GET' };

    assert.equal(request.headers, undefined);
  });

  it('types one HTTP response as the text it arrived as', () => {
    const response: HttpTextResponse = { status: 204, body: '', headers: {} };

    assert.equal(response.status, 204);
  });

  it('names the {code, payload} view the other four cores already name', () => {
    // Structural, so `coerceError` fills it without a cast: the declaration is
    // there to give the concept the one word the five cores share.
    const view: DslErrorView<{ reason: string }> = core.coerceError(
      new core.DslError('not-found', { reason: 'gone' }),
      { reason: '' },
    );

    assert.equal(view.code, 'not-found');
    assert.equal(view.payload.reason, 'gone');
  });

  it('types the admin options a generated package is configured with', () => {
    const options: AdminOptions = { projectId: 'demo', databaseURL: null };

    assert.equal(options.projectId, 'demo');
    assert.equal(options.appName, undefined);
  });
});
