#!/usr/bin/env bash
# Post-deploy smoke test: fetches a handful of known routes WITHOUT executing JavaScript (same as
# Google/WhatsApp/Facebook see them) and checks each one's <title> is its own, not the home page's.
#
# Exists because of a real incident (2026-11-10/11): the dev and then prod CloudFront
# distributions had no routing rule mapping an extensionless path (e.g. "/listings") to its
# prerendered key ("/listings/index.html"), so EVERY non-root route silently served the home
# page's HTML via CloudFront's 403->index.html fallback — invisible to anyone browsing normally
# (Angular's client-side router recovers after hydration), but wrong for every crawler/bot/link
# preview that reads the raw HTML. See infra/cloudfront-functions/spa-routing.js for the fix this
# test guards.
set -euo pipefail

BASE_URL="${1:?Usage: smoke-test.sh <base-url>, e.g. https://dev.espacial.com.mx}"

# path -> a substring expected in THAT path's own <title>, distinct from the home page's.
declare -A PAGES=(
  ["/listings"]="Propiedades en venta y renta"
  ["/propiedades"]="Propiedades en venta y renta"
  ["/agents"]="Agentes inmobiliarios"
  ["/para-agentes"]="Para agentes e inmobiliarias"
)

fetch_title() {
  # `|| true`: a genuine network failure (timeout, DNS, 5xx) must not abort the whole script via
  # `set -e` on this command-substitution assignment — it should just fail THIS path's check
  # (empty title) so every other path still gets reported, not silently skipped.
  curl -sf --max-time 15 "$1" 2>/dev/null | grep -o '<title>[^<]*</title>' | head -1 || true
}

home_title="$(fetch_title "$BASE_URL/")"
echo "Home title: $home_title"
if [[ -z "$home_title" ]]; then
  echo "FAIL: could not fetch the home page at all ($BASE_URL/) — aborting smoke test"
  exit 1
fi

failures=0
for path in "${!PAGES[@]}"; do
  expected="${PAGES[$path]}"
  title="$(fetch_title "$BASE_URL$path")"

  if [[ -z "$title" ]]; then
    echo "FAIL: $path — request failed or returned no <title> at all"
    failures=$((failures + 1))
  elif [[ "$title" == "$home_title" ]]; then
    echo "FAIL: $path — title is IDENTICAL to the home page's ('$title') — this route is silently falling back to home, the exact bug this test exists to catch"
    failures=$((failures + 1))
  elif [[ "$title" != *"$expected"* ]]; then
    echo "FAIL: $path — expected title to contain '$expected', got '$title'"
    failures=$((failures + 1))
  else
    echo "OK: $path -> $title"
  fi
done

if [[ $failures -gt 0 ]]; then
  echo ""
  echo "$failures of ${#PAGES[@]} smoke-test check(s) FAILED"
  exit 1
fi

echo ""
echo "All ${#PAGES[@]} smoke-test checks passed"
