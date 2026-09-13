#!/usr/bin/env bash
# Real-world parse-rate check.
#
# Clones pinned revisions of public circom codebases into $CORPUS_DIR
# (default: .corpus/, git-ignored) and runs `tree-sitter parse -q --stat` over every
# .circom file. A file counts as clean when its tree has no ERROR or MISSING
# node. Files listed in script/parse-corpus.exclude are skipped: each is a file
# the official circom compiler itself rejects at parse time, with the reason
# recorded next to it.
#
# Usage: script/parse-corpus.sh [--fetch-only] [--verbose]
# Needs: git, tree-sitter (CLI), a C compiler (tree-sitter builds the parser).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORPUS_DIR="${CORPUS_DIR:-$ROOT/.corpus}"
EXCLUDE_FILE="$ROOT/script/parse-corpus.exclude"
FETCH_ONLY=0
VERBOSE=0
for a in "$@"; do
  case "$a" in
    --fetch-only) FETCH_ONLY=1 ;;
    --verbose) VERBOSE=1 ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done

# name  url  revision
# Only circom 2 codebases: circom 1 code (tornado-core, darkforest circuits)
# is rejected wholesale by the current compiler, so it says nothing about
# this grammar. circom-witnesscalc's test_circuits are iden3's own compiler
# test circuits, including the circom 2.2 bus examples.
REPOS=(
  "circomlib            https://github.com/iden3/circomlib.git              35e54ea21da3e8762557234298dbb553c175ea8d"
  "zk-email-verify      https://github.com/zkemail/zk-email-verify.git      066c8742a5e60519597697e579333b703ffa6ad2"
  "circom-ecdsa         https://github.com/0xPARC/circom-ecdsa.git          d87eb7068cb35c951187093abe966275c1839ead"
  "semaphore            https://github.com/semaphore-protocol/semaphore.git 4dbc39b83a4066bf5084fd7f5d336202aad2f815"
  "maci                 https://github.com/privacy-scaling-explorations/maci.git 919c433d09aa776a05ca2d89a0074324d6199e91"
  "circomlib-ml         https://github.com/socathie/circomlib-ml.git        c82b3072d7946a76487a8c1be463fc407045391c"
  "circom-witnesscalc   https://github.com/iden3/circom-witnesscalc.git     d48eb7c97857d46b8a75c94ab96f769207263245"
  "iden3-circuits       https://github.com/iden3/circuits.git               360715607a240041f49eb46c543fc450051c4cb7"
  "circom-pairing       https://github.com/yi-sun/circom-pairing.git        107c316223a08ac577522c54edd81f0fc4c03130"
  "hash-circuits        https://github.com/bkomuves/hash-circuits.git       4ef64777cc9b78ba987fbace27e0be7348670296"
  "zk-kit.circom        https://github.com/privacy-scaling-explorations/zk-kit.circom.git b61b45701a2c176408e2f77999e7183984bc1a5b"
  "zk-regex             https://github.com/zkemail/zk-regex.git             4fb1bda1af71123f57f4877c29ebcb9004266fd8"
  "ed25519-circom       https://github.com/Electron-Labs/ed25519-circom.git 99490fc0b4ad14206a6f772baa73b0c64cf38146"
  "spartan-ecdsa        https://github.com/personaelabs/spartan-ecdsa.git   4bf236a1a556d450d8daff4451e79757858f6df1"
  "unirep               https://github.com/Unirep/Unirep.git                fe3a863f9613e1992ffd218fd1e38ea665866738"
)

mkdir -p "$CORPUS_DIR"
for entry in "${REPOS[@]}"; do
  read -r name url rev <<<"$entry"
  dir="$CORPUS_DIR/$name"
  if [ "$(git -C "$dir" rev-parse HEAD 2>/dev/null || true)" != "$rev" ]; then
    rm -rf "$dir"
    git init -q "$dir"
    git -C "$dir" fetch -q --depth 1 "$url" "$rev"
    git -C "$dir" -c advice.detachedHead=false checkout -q FETCH_HEAD
  fi
done
[ "$FETCH_ONLY" = 1 ] && exit 0

cd "$ROOT"
declare -A excluded=()
if [ -f "$EXCLUDE_FILE" ]; then
  while IFS= read -r line; do
    line="${line%%#*}"
    line="$(echo "$line" | xargs)"
    [ -n "$line" ] && excluded["$line"]=1
  done <"$EXCLUDE_FILE"
fi

printf '%-20s %6s %6s %8s %6s\n' repo files clean excluded fail
total_files=0 total_clean=0 total_excl=0 total_fail=0
failures=()
for entry in "${REPOS[@]}"; do
  read -r name _ _ <<<"$entry"
  files=0 excl=0
  todo=()
  while IFS= read -r -d '' f; do
    rel="${f#"$CORPUS_DIR"/}"
    files=$((files + 1))
    if [ -n "${excluded[$rel]:-}" ]; then excl=$((excl + 1)); else todo+=("$f"); fi
  done < <(find "$CORPUS_DIR/$name" -name '*.circom' -not -path '*/.git/*' -not -path '*/node_modules/*' -print0 | sort -z)
  fail=0
  if [ "${#todo[@]}" -gt 0 ]; then
    # -q prints one line per file whose tree has an ERROR or MISSING node:
    # "<path><padding>\tParse: ... (ERROR [r, c] - [r, c])"
    while IFS= read -r line; do
      path="${line%%$'\t'*}"
      path="${path%"${path##*[! ]}"}"
      fail=$((fail + 1))
      failures+=("${path#"$CORPUS_DIR"/}")
    done < <(tree-sitter parse -q --stat "${todo[@]}" 2>&1 | grep -E $'\t''Parse:.*\((ERROR|MISSING)' || true)
  fi
  clean=$((files - excl - fail))
  printf '%-20s %6d %6d %8d %6d\n' "$name" "$files" "$clean" "$excl" "$fail"
  total_files=$((total_files + files)); total_clean=$((total_clean + clean))
  total_excl=$((total_excl + excl)); total_fail=$((total_fail + fail))
done
printf '%-20s %6d %6d %8d %6d\n' TOTAL "$total_files" "$total_clean" "$total_excl" "$total_fail"

# Excluded files must still be files the grammar rejects; if one starts
# parsing clean, the exclusion is stale (or the grammar grew too lenient).
for rel in "${!excluded[@]}"; do
  if [ ! -f "$CORPUS_DIR/$rel" ]; then
    echo "stale exclusion (file not found): $rel"; exit 1
  fi
  out="$(tree-sitter parse -q "$CORPUS_DIR/$rel" 2>&1 || true)"
  if ! grep -qE '\((ERROR|MISSING)' <<<"$out"; then
    echo "excluded file parses clean, which the compiler rejects: $rel"; exit 1
  fi
done

if [ "${#failures[@]}" -gt 0 ]; then
  echo
  echo "Files with ERROR/MISSING nodes:"
  for f in "${failures[@]}"; do
    echo "  $f"
    if [ "$VERBOSE" = 1 ]; then
      tree-sitter parse -q "$CORPUS_DIR/$f" 2>&1 | grep -oE '\((ERROR|MISSING)[^)]*\)' | head -3 | sed 's/^/      /' || true
    fi
  done
  exit 1
fi
