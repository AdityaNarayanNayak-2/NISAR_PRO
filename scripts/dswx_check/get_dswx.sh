#!/bin/bash
# Downloads NASA OPERA DSWx-S1 water layers (B01_WTR) over the Bihar scene, 00:11 UTC pass. Date: first argument (default 2026-09-12).
# Login: your Earthdata username + password (typed hidden). They go only to urs.earthdata.nasa.gov,
# through a temporary file that is deleted at the end. Run: bash ~/Desktop/nisar_data/dswx_s1/get_dswx.sh
mkdir -p "${DSWX_DIR:-$HOME/Desktop/nisar_data/dswx_s1}" && cd "${DSWX_DIR:-$HOME/Desktop/nisar_data/dswx_s1}"
DATE=${1:-2026-09-12}; DAY=${DATE//-/}
read -rp "Earthdata username: " EU
read -rsp "Earthdata password (hidden): " EP; echo
TMP=$(mktemp -d); chmod 700 "$TMP"; trap 'rm -rf "$TMP"' EXIT
printf 'machine urs.earthdata.nasa.gov login %s password %s\n' "$EU" "$EP" > "$TMP/netrc"; chmod 600 "$TMP/netrc"; unset EP
dl() { curl -sS -L --netrc-file "$TMP/netrc" -c "$TMP/cookies" -b "$TMP/cookies" -A NISAR-Pro -o "$2" -w '%{http_code}' "$1"; }

URLS=$(curl -s -A NISAR-Pro "https://cmr.earthdata.nasa.gov/search/granules.json?short_name=OPERA_L3_DSWX-S1_V1&bounding_box=84.3,23.0,88.2,26.5&temporal=${DATE}T00:00:00Z,${DATE}T23:59:59Z&page_size=50" |
  python3 -c "import sys,json
for e in json.load(sys.stdin)['feed']['entry']:
  for l in e['links']:
    h=l['href']
    if h.startswith('https') and h.endswith('B01_WTR.tif') and '_${DAY}T0011' in h: print(h)")
[ -n "$URLS" ] || { echo "NASA search returned nothing (internet?)"; exit 1; }
ok=0; bad=0
for u in $URLS; do
  f=$(basename "$u"); [ -s "$f" ] && { echo "have $f"; ok=$((ok+1)); continue; }
  code=$(dl "$u" "$TMP/part")
  if [ "$code" = 200 ] && head -c 4 "$TMP/part" | grep -q -a -E '^(II\*|MM)'; then
    mv "$TMP/part" "$f"; echo "got $f"; ok=$((ok+1))
  else
    bad=$((bad+1)); echo "FAILED $f (HTTP $code)"
    if [ $bad = 1 ]; then
      echo "--- what NASA answered (first lines):"; head -c 400 "$TMP/part" | tr -d '\0' | sed 's/<[^>]*>/ /g' | tr -s ' \n' | head -c 300; echo
      echo "--- If it mentions login: check the username/password at https://urs.earthdata.nasa.gov"
      echo "--- If it mentions 'authorize' or EULA: open the file link once in a browser while logged in and click Authorize"
      echo "    $u"
    fi
  fi
done
echo "done: $ok files ok, $bad failed"
