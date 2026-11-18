#!/usr/bin/env bash
# Probe the built Milburn dashboard, including its deep links, the data
# files from this checkout and the images and fonts in the served page.
# Usage: scripts/smoke-built-site.sh [site URL]
# Extra curl arguments can be passed in SMOKE_CURL_ARGS.
set -euo pipefail

SITE="${1:-http://127.0.0.1:3000/uk/milburn-review}"
SITE="${SITE%/}"
read -r -a EXTRA <<<"${SMOKE_CURL_ARGS:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_FILES=(
  milburn_measures.json
  milburn_summary.json
  milburn_review_figures.json
  milburn_benchmarks.json
  milburn_scenarios.json
  milburn_household_presets.json
  milburn_neet.json
  milburn_entry_path.json
)
# Read the same run catalogue and required file names as the app. A
# not-computable measure has no output files to serve.
run_files=$(cd "$ROOT" && bun -e '
  import { readFileSync } from "node:fs";
  import { BUILD_RECORD_FILE, LOCAL_TABLES, MEASURES_FILE, RUNS_DIR, parseMeasuresFile } from "./src/utils/milburn/localBuild.js";
  const catalogue = parseMeasuresFile(JSON.parse(readFileSync("public/data/" + MEASURES_FILE)));
  if (!catalogue?.computable.length) throw new Error("No computable Milburn measures");
  for (const run of catalogue.computable) {
    for (const file of [BUILD_RECORD_FILE, ...Object.values(LOCAL_TABLES)]) {
      console.log(RUNS_DIR + "/" + run.id + "/" + file);
    }
  }
')
while IFS= read -r file; do
  DATA_FILES+=("$file")
done <<< "$run_files"

TABS=(
  "" "?tab=dashboard" "?tab=household" "?tab=policies" "?tab=methodology"
  "?tab=dashboard&sub=age" "?tab=dashboard&sub=poverty"
  "?tab=dashboard&sub=finances" "?tab=dashboard&sub=scenarios"
  "?tab=dashboard&sub=benchmarks"
)

failures=0
status() {
  curl --silent --show-error --output "$2" --write-out '%{http_code}' \
    --max-time 60 ${EXTRA[@]+"${EXTRA[@]}"} "$1" || echo "000"
}
body=$(mktemp)
trap 'rm -f "$body"' EXIT

for tab in "${TABS[@]}"; do
  url="$SITE$tab"
  code=$(status "$url" "$body")
  if [ "$code" != 200 ]; then
    echo "FAIL $url: HTTP $code"
    failures=$((failures + 1))
  elif ! grep -Fq "<title>Milburn review: young people and work</title>" "$body"; then
    echo "FAIL $url: the page title is missing"
    failures=$((failures + 1))
  else
    echo "ok   $url"
  fi
done

for file in "${DATA_FILES[@]}"; do
  url="$SITE/data/$file"
  code=$(status "$url" "$body")
  if [ "$code" != 200 ] || [ ! -s "$body" ]; then
    echo "FAIL $url: HTTP $code or empty response"
    failures=$((failures + 1))
  elif ! cmp -s "$ROOT/public/data/$file" "$body"; then
    echo "FAIL $url: response differs from the dashboard data in this checkout"
    failures=$((failures + 1))
  else
    echo "ok   $url"
  fi
done

# Every image and font the page links (its logos, the Inter font), from its
# own HTML: each under the base path, and answering 200. A static import
# whose URL lost the base path would ask policyengine.org for /_next/...,
# which is not this site's, and 404.
ORIGIN=$(printf '%s' "$SITE" | sed -E 's#^(https?://[^/]+).*#\1#')
BASE_PATH="${SITE#"$ORIGIN"}"
page=$(mktemp)
trap 'rm -f "$body" "$page"' EXIT
status "$SITE" "$page" >/dev/null
media=0
while IFS= read -r path; do
  [ -n "$path" ] || continue
  media=$((media + 1))
  path="${path//&amp;/&}"
  case "$path" in
    "$BASE_PATH"/_next/*) ;;
    *)
      echo "FAIL $path: not under the base path $BASE_PATH"
      failures=$((failures + 1))
      continue
      ;;
  esac
  code=$(status "$ORIGIN$path" "$body")
  if [ "$code" != 200 ] || [ ! -s "$body" ]; then
    echo "FAIL $ORIGIN$path: HTTP $code"
    failures=$((failures + 1))
  else
    echo "ok   $ORIGIN$path"
  fi
done < <(grep -oE '(src|href)="[^"]*/_next/static/media/[^"]*"' "$page" | sed -E 's/^(src|href)="//; s/"$//' | sort -u)
if [ "$media" -eq 0 ]; then
  echo "FAIL $SITE: no images or fonts found in the page"
  failures=$((failures + 1))
fi

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed."
  exit 1
fi
echo "${#TABS[@]} page URLs, ${#DATA_FILES[@]} data files and $media images and fonts answer 200."
