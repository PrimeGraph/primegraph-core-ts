# primegraph-core-ts

`@primegraph/core` — the shared cross-package vocabulary for PrimeGraph generated TypeScript packages.

## Why this package exists

The PrimeGraph compiler generates one package per graph bucket. Each generated package used to carry
its own private copy of a runtime, so a type declared in that runtime existed once per package. When
one generated package handed a value to another — a model field, a thrown error — the two copies were
different nominal types and the code broke: it failed to compile in Go and Swift, and in Kotlin a
`catch` silently failed to match.

This package holds the vocabulary that crosses package boundaries, so a graph has exactly one nominal
type per concept no matter how many generated packages it spans.

Per-bundle machinery — Firebase, HTTP transport, server helpers — stays inside the generated packages
and does **not** belong here.

There are five of these, one per target language:
`primegraph-core-ts`, `primegraph-core-go`, `primegraph-core-swift`, `primegraph-core-py`,
`primegraph-core-kt`.

## What is in

| Export                | What it is                                                                 |
| --------------------- | -------------------------------------------------------------------------- |
| `DslError<TPayload>`  | The one nominal type in the TypeScript runtime: `{ code, payload }`, raised by `raise` and by every helper that reports a failure. |
| `coerceError`         | Projects any caught value onto the catch binding `{ code, payload }`.        |
| `transportErrorCode`  | Names a raw SDK failure in the DSL code space, `null` when nothing names it. |
| `defaultErrorMessage` | The declared text of an error code.                                          |
| `issueExpectation`    | Turns a schema-validation issue into the constraint the declaration stated.  |
| `HttpAuth`, `HttpRequest<TBody>`, `HttpTextResponse` | The shape of one outbound HTTP call and of what it returned. |
| `AdminOptions`        | How a generated package is told which Firebase project to talk to.           |

### Recognition is by brand, not by class identity

`coerceError` used to decide with `instanceof DslError`. It no longer does — not as the thing that
decides. A graph can hold a second copy of the class (a package that still ships its own emitted
runtime, an npm nesting, a version skew), and `instanceof` answers `false` across that boundary. There
is no compile error, because TypeScript is structurally typed and unifies the two copies without a
word, and there is no throw: the error simply degrades to `{ code: 'INTERNAL_ERROR' }` and its typed
payload is lost.

What decides now is the brand `name === 'DslError'` plus the `{ code, payload }` shape. `instanceof`
is kept as the fast path only. `src/dsl-error.test.ts` pins this with an error raised through a
*separate* class that carries the same brand.

## What is out, on purpose

The expression helpers, `validateSchema`, `validateWrite`, `wireShape`, `parseResponse`,
`requireHandle`, `firestoreDecode`, `mapValues`, `exists`, `timeTimestamp`, the `fetch`
implementation, and the whole Firebase client / admin surface stay inside the generated packages.
Twenty-three of them throw `DslError` and will import it from here.

Third-party dependencies are zero and stay zero: `zod` belongs to `validateSchema`, which is out.
`issueExpectation` reads its issue as `unknown` for exactly that reason.

There is no `Runtime.File`: the file carrier in TypeScript is the DOM global `File`.

## Module format

The build is **CommonJS**, and `"type": "module"` must never be added to `package.json`.

The generated frontend packages are ESM and the generated backend packages are CommonJS. A single CJS
build is importable from both. A dual CJS+ESM build is not: a graph that pulls the ESM copy through
one package and the CJS copy through another ends up with two copies of the same class, which is
precisely the duplicate-nominal-type problem this package exists to remove.

## Layout

```
src/index.ts              public surface
src/dsl-error.ts          DslError, coerceError, transportErrorCode, defaultErrorMessage
src/issue-expectation.ts  issueExpectation
src/http.ts               HttpAuth, HttpRequest, HttpTextResponse
src/admin-options.ts      AdminOptions
src/*.test.ts             tests, co-located with the code they cover
test/esm-interop.test.mjs the ESM-imports-CommonJS check, which has to be a real ESM file
tsconfig.json             CommonJS build settings; excludes the tests from dist/
tsconfig.test.json        the same settings, tests included, built to dist-test/
.githooks/                Conventional Commits hook, dependency-free POSIX shell
scripts/setup.sh          one-time clone setup
scripts/release.sh        the release procedure
```

## Setup

A fresh clone has to be pointed at the repository's own hooks once:

```sh
git config core.hooksPath .githooks
```

`sh scripts/setup.sh` (or `npm run setup`) does that for you.

The hook rejects any commit message that is not a Conventional Commit: `type(scope)!: subject`, one of
`build chore ci docs feat fix perf refactor revert style test`, header at most 100 characters, no
trailing period.

## Build and test

```sh
npm ci
npm run build      # dist/, CommonJS + .d.ts, tests excluded
npm test           # builds, then runs the node:test suites
npm run typecheck  # tsc --noEmit under strict, tests included
```

The test runner is Node's own (`node:test` + `node:assert/strict`), so testing adds no dependency.
The suites in `src/` are compiled to `dist-test/` and run from there; `test/esm-interop.test.mjs`
runs as-is, because its job is to be genuine ESM importing the built CommonJS package by name.

## Releasing

```sh
NODE_AUTH_TOKEN=<github token with write:packages> sh scripts/release.sh 1.4.0
```

The argument is a bare semver — no leading `v`; the tag gets one. The script refuses to run on a dirty
tree, off the default branch, or when the tag already exists, and it does all of those checks before it
changes anything. It then bumps `package.json`, builds, commits `chore(release): v1.4.0`, tags, pushes
the branch and the tag, and runs `npm publish` against `https://npm.pkg.github.com`.

The publish token is written to a throwaway npm config file, never to a committed `.npmrc`.
