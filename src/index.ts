/**
 * The public surface of `@primegraph/core`.
 *
 * Exported names are the names the generated packages already use, unchanged:
 * an emitter that stops emitting a declaration and starts importing it from here
 * rewrites an import, never a call site.
 */

export { coerceError, defaultErrorMessage, DslError, transportErrorCode } from './dsl-error.js';
export { issueExpectation } from './issue-expectation.js';
export type { HttpAuth, HttpRequest, HttpTextResponse } from './http.js';
export type { AdminOptions } from './admin-options.js';
