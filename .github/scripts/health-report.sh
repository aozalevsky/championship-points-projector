#!/usr/bin/env bash
# Keep a single "API health check failing" issue in sync with the checks,
# without commenting on every run:
#   - opens the issue when a check starts failing;
#   - comments only when the set of failing checks changes;
#   - closes the issue once every reported check has passed again.
# The reported set is stored as a hidden marker in the latest bot post:
#   <!-- failing: ["Job / Step", ...] -->
# Env: GH_TOKEN, REPO, RUN_ID, RUN_URL; DRY_RUN=1 prints instead of writing.
set -euo pipefail

title="API health check failing"

gh_write() {
  if [ -n "${DRY_RUN:-}" ]; then printf 'DRY_RUN: gh'; printf ' %q' "$@"; echo; else gh "$@"; fi
}

jobs=$(gh api "repos/$REPO/actions/runs/$RUN_ID/jobs" --paginate --jq '.jobs[]' | jq -s .)
# checks that failed in this run, as "Job / Step"
failing=$(jq -c '[.[] | select(.conclusion == "failure") as $j
                   | $j.steps[] | select(.conclusion == "failure")
                   | "\($j.name) / \(.name)"] | sort' <<< "$jobs")
# jobs that ran and passed in this run: their previously failing checks recovered
passed_jobs=$(jq -c '[.[] | select(.conclusion == "success") | .name]' <<< "$jobs")

issue=$(gh issue list --repo "$REPO" --state open --search "in:title \"$title\"" \
  --json number,title --jq "[.[] | select(.title == \"$title\")][0].number // empty")

if [ -z "$issue" ]; then
  if [ "$failing" = "[]" ]; then echo "all checks pass, no open issue"; exit 0; fi
  body="Health checks failing:
$(jq -r '.[] | "- \(.)"' <<< "$failing")

Run: $RUN_URL

This issue gets a comment only when the set of failing checks changes, and closes itself once they all pass again.
<!-- failing: $failing -->"
  gh_write issue create --repo "$REPO" --title "$title" --body "$body" --assignee aozalevsky
  exit 0
fi

# last reported set: newest marker in the comments, else in the issue body
reported=$(gh api "repos/$REPO/issues/$issue/comments" --paginate --jq '.[].body' \
  | grep -o '<!-- failing: .* -->' | tail -n 1 || true)
if [ -z "$reported" ]; then
  reported=$(gh issue view "$issue" --repo "$REPO" --json body --jq .body \
    | grep -o '<!-- failing: .* -->' | tail -n 1 || true)
fi
reported=$(sed -E 's/^<!-- failing: (.*) -->$/\1/' <<< "${reported:-<!-- failing: [] -->}")
# issues filed before this script have no marker: treat as "unknown", so the
# first run re-reports whatever is failing now (or closes if all is well)

outstanding=$(jq -cn --argjson r "$reported" --argjson f "$failing" --argjson p "$passed_jobs" '
  [$r[] | select((split(" / ")[0]) as $job | ($p | index($job)) | not)] + $f | unique')

if [ "$outstanding" = "[]" ]; then
  gh_write issue close "$issue" --repo "$REPO" --comment "All checks pass again: $RUN_URL
<!-- failing: [] -->"
  exit 0
fi

if [ "$outstanding" = "$reported" ]; then
  echo "issue #$issue: still failing, nothing new to report"
  exit 0
fi

new=$(jq -r --argjson r "$reported" '.[] | select(. as $x | $r | index($x) | not) | "- now failing: \(.)"' <<< "$outstanding")
fixed=$(jq -r --argjson o "$outstanding" '.[] | select(. as $x | $o | index($x) | not) | "- recovered: \(.)"' <<< "$reported")
gh_write issue comment "$issue" --repo "$REPO" --body "Failing checks changed ($RUN_URL):
$(printf '%s\n%s' "$new" "$fixed" | sed '/^$/d')

Still failing:
$(jq -r '.[] | "- \(.)"' <<< "$outstanding")
<!-- failing: $outstanding -->"
