#!/bin/bash
# Re-run Milburn national results into a staging folder outside the repo.
#
#   scripts/milburn_rerun_all.sh --dry-run            # show the plan, touch nothing
#   scripts/milburn_rerun_all.sh                      # every listed id, in registry order
#   scripts/milburn_rerun_all.sh ID [ID ...]          # these ids only (reserved ids must be named)
#   STAGE=~/milburn-runs/x scripts/milburn_rerun_all.sh ...
#
# It waits for the shared heavy-run lock (/tmp/pe-heavy.lock, one line:
# "<pid> <project> <job>"), takes it, runs one measure per process into
# $STAGE/<id>/, writes $STAGE/milburn_scenarios.json, and releases the lock.
# It never writes into public/data: it prints what to copy, and the summary
# command to run after copying (scripts/milburn_summary.py reads and writes
# public/data only, so it cannot be pointed at staging).
#
# Runs on the installed build (uk_budget_data.local_build: Microcosm build
# b891aa69 on policyengine-uk 2.179.2, certified in policyengine 6.20.3), with the Hugging Face token unset.
# A run takes about 6.5 to 9.5 minutes and about 23 GB (estimates).

set -u -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCK=/tmp/pe-heavy.lock
PROJECT=uk-milburn
JOB=rerun-all
YEARS="2027 2028 2029 2030 2031"
STAGE="${STAGE:-$HOME/milburn-runs/$(date +%Y%m%d)}"
BIN="$ROOT/.venv/bin"
DRY_RUN=0
IDS=()

for argument in "$@"; do
  case "$argument" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "Unknown option: $argument" >&2; exit 2 ;;
    *) IDS+=("$argument") ;;
  esac
done

cd "$ROOT" || exit 1
unset HUGGING_FACE_TOKEN HF_TOKEN HUGGINGFACE_HUB_TOKEN

registry() {  # "<listed ids>" then "<reserved ids>", one line each
  "$BIN/python" -c "
import warnings; warnings.simplefilter('ignore')
from uk_budget_data import reforms
print('IDS', *reforms.list_reform_ids())
print('RESERVED', *reforms.list_reserved_reform_ids())
" 2>/dev/null
}
REGISTRY="$(registry)" || { echo "Could not read the registry." >&2; exit 1; }
LISTED=($(echo "$REGISTRY" | sed -n 's/^IDS //p'))
RESERVED=($(echo "$REGISTRY" | sed -n 's/^RESERVED //p'))
[ "${#LISTED[@]}" -gt 0 ] || { echo "The registry lists no ids." >&2; exit 1; }
[ "${#IDS[@]}" -gt 0 ] || IDS=("${LISTED[@]}")
for id in "${IDS[@]}"; do
  case " ${LISTED[*]} ${RESERVED[*]} " in
    *" $id "*) ;;
    *) echo "Unknown measure id: $id" >&2; exit 2 ;;
  esac
done

holder() { [ -e "$LOCK" ] && cat "$LOCK"; }
holder_alive() {  # true when the lock names a process that is running
  local pid
  pid="$(cut -d' ' -f1 "$LOCK" 2>/dev/null)"
  case "$pid" in ''|*[!0-9]*) return 0 ;; esac   # unreadable: treat as held
  ps -p "$pid" >/dev/null 2>&1
}

echo "Milburn re-run"
echo "  repository : $ROOT ($(git rev-parse --short HEAD 2>/dev/null)$(git diff --quiet 2>/dev/null || echo ', uncommitted changes'))"
echo "  staging    : $STAGE"
echo "  years      : $YEARS"
echo "  lock       : $LOCK ($(holder || echo free))"
echo "  ids (${#IDS[@]}, in this order):"
for id in "${IDS[@]}"; do echo "    $id"; done
echo "  then       : $STAGE/milburn_scenarios.json (household-only)"
echo "  estimate   : about $(( ${#IDS[@]} * 8 )) minutes once the lock is free"

# Written by `generate` for every run but read nowhere on the page
# (src/utils/milburn/localBuild.js LOCAL_TABLES): left in staging, never
# copied into public/
# and the floor's private record (pipeline.FLAT_COUNTS_FILE and the rest)
UNREAD_TABLES=(income_curve.csv household_scatter_binned.csv obr_comparison.csv "*.private.csv" "*.private")

copy_plan() {
  local excludes=""
  for file in "${UNREAD_TABLES[@]}"; do excludes="$excludes --exclude=$file"; done
  echo
  echo "Nothing was copied. After checking the staged folders, copy by hand:"
  for id in "${IDS[@]}"; do
    echo "  rsync -a --delete$excludes \"$STAGE/$id/\" \"$ROOT/public/data/milburn/$id/\""
  done
  echo "  cp \"$STAGE/milburn_scenarios.json\" \"$ROOT/public/data/milburn_scenarios.json\""
  echo "then (it reads the copied folders and writes public/data/milburn_summary.json):"
  echo "  python3 scripts/milburn_summary.py > \"$STAGE/summary-table.md\""
}

if [ "$DRY_RUN" = 1 ]; then
  echo
  echo "Dry run: would wait for the lock, write \"\$\$ $PROJECT $JOB\" to it, then for each id:"
  echo "  $BIN/uk-budget-data generate --skip-input-check --reforms <id> --years $YEARS --output-dir $STAGE/<id>"
  echo "and: $BIN/uk-budget-data milburn-scenarios --output $STAGE/milburn_scenarios.json"
  copy_plan
  exit 0
fi

"$BIN/python" -c "from uk_budget_data import local_build as b; b.check_engine(); b.check_dataset()" 2>/dev/null \
  || { echo "Engine or dataset is not the build's (see docs/milburn-local-run.md)." >&2; exit 1; }
mkdir -p "$STAGE"

# Take the lock: create it only if absent; remove it only when its holder
# is a readable pid that is no longer running.
until ( set -o noclobber; echo "$$ $PROJECT $JOB" > "$LOCK" ) 2>/dev/null; do
  if ! holder_alive; then
    echo "Removing stale lock: $(holder)"
    rm -f "$LOCK"
    continue
  fi
  echo "$(date +%H:%M) waiting for $LOCK ($(holder))"
  sleep 30
done
trap 'grep -q "^$$ " "$LOCK" 2>/dev/null && rm -f "$LOCK"' EXIT
trap 'exit 130' INT TERM
echo "$(date +%H:%M) lock taken: $(holder)"

FAILED=""
for id in "${IDS[@]}"; do
  rm -rf "${STAGE:?}/$id"            # never reuse an earlier attempt's model_build.json
  echo "$(date +%H:%M) $id"
  if /usr/bin/time -l "$BIN/uk-budget-data" generate --skip-input-check \
       --reforms "$id" --years $YEARS --output-dir "$STAGE/$id" \
       > "$STAGE/$id.log" 2>&1 && [ -f "$STAGE/$id/model_build.json" ]; then
    grep -E "real|maximum resident|peak memory" "$STAGE/$id.log" | sed 's/^/    /'
  else
    echo "    FAILED: see $STAGE/$id.log" >&2
    FAILED="$id"
    break
  fi
done

if [ -z "$FAILED" ]; then
  "$BIN/uk-budget-data" milburn-scenarios --output "$STAGE/milburn_scenarios.json" \
    > "$STAGE/milburn_scenarios.log" 2>&1 || FAILED=milburn-scenarios
fi

rm -f "$LOCK"; trap - EXIT
echo "$(date +%H:%M) lock released"
if [ -n "$FAILED" ]; then
  echo "Stopped at $FAILED; nothing to copy from it." >&2
  exit 1
fi
copy_plan
