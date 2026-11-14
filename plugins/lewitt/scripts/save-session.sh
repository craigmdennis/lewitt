#!/bin/sh
# Save a session for agent screenshots of the app.
#
# A login page can block a browser that Playwright controls, so the login runs in
# an ordinary browser:
#
# 1. Log in to the app.
# 2. Open DevTools, then the Network tab, and reload the page.
# 3. Select a request to the app's API, and copy the value of the `cookie`
#    request header.
# 4. Run this script. It reads the value from the clipboard, because a terminal
#    prompt accepts at most 1024 bytes, and then clears the clipboard.
#
# The script writes the cookies for <domain> to SESSION_FILE from .lewitt/paths.
# With a check URL, it then requests that URL with the cookies and reports the
# status.
#
# Usage, from the product folder that holds .lewitt/:
#   sh "$LEWITT_ROOT/scripts/save-session.sh" <domain> [check url]
set -eu
[ -f .lewitt/paths ] || { echo "Run this from the product folder that holds .lewitt/." >&2; exit 1; }
set -a
. ./.lewitt/paths
set +a
umask 077
mkdir -p "$(dirname "$SESSION_FILE")"
python3 - "$SESSION_FILE" "$1" "${2:-}" <<'PY'
import json
import ssl
import subprocess
import sys
import urllib.error
import urllib.request

out, domain, check = sys.argv[1:]
header = subprocess.run(["pbpaste"], capture_output=True, text=True).stdout.strip()
subprocess.run(["pbcopy"], input="", text=True)
if header.lower().startswith("cookie:"):
    header = header[len("cookie:"):].strip()
cookies = []
for part in header.split(";"):
    name, sep, value = part.strip().partition("=")
    if sep:
        cookies.append({
            "name": name, "value": value, "domain": domain, "path": "/",
            "expires": -1, "httpOnly": False, "secure": True, "sameSite": "Lax",
        })
if not cookies:
    sys.exit("No cookies found on the clipboard.")
json.dump({"cookies": cookies, "origins": []}, open(out, "w"))
print(f"Saved {len(cookies)} cookies to {out}")

if check:
    req = urllib.request.Request(check, headers={"Cookie": header})
    try:
        with urllib.request.urlopen(req, context=ssl._create_unverified_context()) as resp:
            print(f"Session works: {check} returned {resp.status}")
    except urllib.error.HTTPError as err:
        sys.exit(f"Session check failed: {check} returned {err.code}")
    except urllib.error.URLError as err:
        sys.exit(f"Session check failed: {check} is unreachable ({err.reason})")
PY
