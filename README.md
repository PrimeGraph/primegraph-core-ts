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

## Status

Scaffolding only. No shared declarations have been migrated yet; `src/index.ts` exports a single
placeholder so the build has something to compile.

## Module format

The build is **CommonJS**, and `"type": "module"` must never be added to `package.json`.

The generated frontend packages are ESM and the generated backend packages are CommonJS. A single CJS
build is importable from both. A dual CJS+ESM build is not: a graph that pulls the ESM copy through
one package and the CJS copy through another ends up with two copies of the same class, which is
precisely the duplicate-nominal-type problem this package exists to remove.

## Layout

```
src/index.ts        public surface
tsconfig.json       CommonJS build settings
.githooks/          Conventional Commits hook, dependency-free POSIX shell
scripts/setup.sh    one-time clone setup
scripts/release.sh  the release procedure
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

## Build

```sh
npm ci
npm run build
```

## Releasing

```sh
NODE_AUTH_TOKEN=<github token with write:packages> sh scripts/release.sh 1.4.0
```

The argument is a bare semver — no leading `v`; the tag gets one. The script refuses to run on a dirty
tree, off the default branch, or when the tag already exists, and it does all of those checks before it
changes anything. It then bumps `package.json`, builds, commits `chore(release): v1.4.0`, tags, pushes
the branch and the tag, and runs `npm publish` against `https://npm.pkg.github.com`.

The publish token is written to a throwaway npm config file, never to a committed `.npmrc`.
