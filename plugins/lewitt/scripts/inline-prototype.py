#!/usr/bin/env python3
"""Build a prototype version as one HTML file, so the design lead can share the file on its own.

    python3 "$LEWITT_ROOT/scripts/inline-prototype.py" <run>/prototype/v<n>

The prototyper edits the files in `prototype/v<n>/src/`. This script writes
`prototype/v<n>/index.html` from `src/index.html`, with each local stylesheet in a `<style>`
element and each local script in a `<script>` element. The page snapshot CSS already holds its
fonts and images as data URLs. The script stops when `src/index.html` links any other local
file, since the built file would not show it.
"""

import re
import sys
from pathlib import Path

STYLESHEET = re.compile(r'<link\b[^>]*\brel=["\']?stylesheet["\']?[^>]*>', re.I)
SCRIPT = re.compile(r'<script\b([^>]*)\bsrc=["\']([^"\']+)["\']([^>]*)>\s*</script>', re.I)
HREF = re.compile(r'\bhref=["\']([^"\']+)["\']', re.I)
LOCAL_REF = re.compile(r'\b(?:src|href)=["\'](?![a-z][a-z0-9+.-]*:|//|/|#|\?)([^"\']+)["\']', re.I)


def local(ref):
    return not re.match(r"[a-z][a-z0-9+.-]*:|//|/", ref, re.I)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    version_dir = Path(sys.argv[1]).resolve()
    src = version_dir / "src"
    if not (src / "index.html").is_file():
        sys.exit(f"{src} has no index.html.")
    html = (src / "index.html").read_text()

    def inline_style(match):
        href = HREF.search(match.group(0))
        if not href or not local(href.group(1)):
            return match.group(0)
        css = (src / href.group(1)).read_text().replace("</style", "<\\/style")
        return f"<style>\n{css}\n</style>"

    def inline_script(match):
        if not local(match.group(2)):
            return match.group(0)
        js = (src / match.group(2)).read_text().replace("</script", "<\\/script")
        attrs = (match.group(1) + match.group(3)).strip()
        return f"<script{' ' + attrs if attrs else ''}>\n{js}\n</script>"

    html = STYLESHEET.sub(inline_style, html)
    html = SCRIPT.sub(inline_script, html)
    left = sorted(set(LOCAL_REF.findall(html)))
    if left:
        sys.exit(f"Not built. src/index.html links local files the built file cannot show: {', '.join(left)}. "
                 "Inline them as data URLs, or remove them.")
    (version_dir / "index.html").write_text(html)
    print(f"Built {version_dir / 'index.html'}: {len(html.encode()) // 1024} KB.")


main()
