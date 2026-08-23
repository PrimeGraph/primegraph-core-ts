#!/bin/sh
# Release @primegraph/core to GitHub Packages.
#
# Usage: sh scripts/release.sh <semver>       e.g. sh scripts/release.sh 1.4.0
#
# The argument is a bare semver with no leading "v"; the git tag gets the "v".
# Every check that can fail runs before anything is mutated, so an already
# released version stops the script instead of half-publishing it.
#
# Requires NODE_AUTH_TOKEN, an npmjs.com automation token for the primegraph org.

set -eu

usage() {
  echo "Usage: sh scripts/release.sh <semver>   (bare semver, no leading 'v')" >&2
  exit 1
}

[ "$#" -eq 1 ] || usage
VERSION="$1"

SEMVER_RE='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$'
if ! printf '%s' "$VERSION" | grep -Eq "$SEMVER_RE"; then
  echo "release: '$VERSION' is not a bare semver (expected 1.4.0, not v1.4.0)" >&2
  exit 1
fi
TAG="v$VERSION"

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO_ROOT"

# --- preflight --------------------------------------------------------------

DEFAULT_BRANCH=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##' || true)
[ -n "$DEFAULT_BRANCH" ] || DEFAULT_BRANCH=main

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$DEFAULT_BRANCH" ]; then
  echo "release: on branch '$CURRENT_BRANCH', releases are cut from '$DEFAULT_BRANCH' only" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "release: the working tree is dirty, commit or stash first" >&2
  git status --short >&2
  exit 1
fi

if git rev-parse --verify --quiet "refs/tags/$TAG" >/dev/null; then
  echo "release: tag $TAG already exists locally, nothing was changed" >&2
  exit 1
fi

if [ -n "$(git ls-remote --tags origin "refs/tags/$TAG")" ]; then
  echo "release: tag $TAG already exists on origin, nothing was changed" >&2
  exit 1
fi

git fetch --quiet origin "$DEFAULT_BRANCH"
if [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$DEFAULT_BRANCH")" ]; then
  echo "release: HEAD and origin/$DEFAULT_BRANCH differ, pull or push first" >&2
  exit 1
fi

if [ -z "${NODE_AUTH_TOKEN:-}" ]; then
  echo "release: NODE_AUTH_TOKEN is not set, npm publish would fail after tagging" >&2
  exit 1
fi

# --- version, build ---------------------------------------------------------

echo "release: preparing $TAG"
npm ci
npm version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null
npm run build

# --- commit, tag, push ------------------------------------------------------

git add package.json package-lock.json
git commit -m "chore(release): $TAG"
git tag -a "$TAG" -m "$TAG"
git push origin "$DEFAULT_BRANCH"
git push origin "$TAG"

# --- publish ----------------------------------------------------------------

# The token is written to a throwaway npm config instead of a committed .npmrc
# so no credential ever reaches the working tree.
NPMRC=$(mktemp)
trap 'rm -f "$NPMRC"' EXIT INT TERM
chmod 600 "$NPMRC"
{
  echo "@primegraph:registry=https://registry.npmjs.org"
  echo "//registry.npmjs.org/:_authToken=$NODE_AUTH_TOKEN"
} > "$NPMRC"

if ! NPM_CONFIG_USERCONFIG="$NPMRC" npm publish; then
  echo "release: $TAG is committed, tagged and pushed but npm publish failed" >&2
  echo "release: fix the cause and re-run only the publish, do not re-run this script" >&2
  exit 1
fi

echo "release: published @primegraph/core $VERSION ($TAG)"
