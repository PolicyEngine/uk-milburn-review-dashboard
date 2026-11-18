"""Build the dashboard as a static site for a private Claude artifact.

    python3 scripts/artifact_export.py

Runs `next build` with ARTIFACT_EXPORT=1 (next.config.ts: static export, no
base path, data fetched relative to the page) into artifact-export/, makes
every remaining /_next/, /data/ and /assets/ path relative, and stages the
files to publish in artifact-export/publish/:

- index.html: a short page that opens dashboard.html (the artifact wraps its
  main page in its own document skeleton, which a Next.js page cannot take;
  other HTML files are served as they are);
- dashboard.html: the dashboard itself;
- nx/ (Next.js's _next/, renamed: the artifact service reserves names that
  start with "_"), data/, assets/ and the other static files beside them.

The Household impact tab cannot calculate in an artifact (it calls an
external API, which the artifact's frame blocks).
"""

import fnmatch
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "artifact-export")
PUBLISH = os.path.join(OUT, "publish")

LOADER = """<title>Milburn review dashboard</title>
<meta name="robots" content="noindex, nofollow">
<style>
  :root { --bg: #f7fafa; --fg: #1d2b2b; --link: #2c6e6e; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #101818; --fg: #e4eeee; --link: #7fc4c4; color-scheme: dark } }
  :root[data-theme="dark"] { --bg: #101818; --fg: #e4eeee; --link: #7fc4c4; color-scheme: dark }
  body { background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; padding-block: 48px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
  a { color: var(--link); }
</style>
<p>Opening the dashboard&hellip; If it does not open, <a href="./dashboard.html">open it here</a>.</p>
<script>location.replace("./dashboard.html" + location.hash);</script>
"""


def build():
    env = dict(os.environ, ARTIFACT_EXPORT="1")
    shutil.rmtree(OUT, ignore_errors=True)
    subprocess.run(["bunx", "next", "build"], cwd=ROOT, env=env, check=True)



def rewrite_paths(text):
    """The path rewrites for HTML and JS, as relativise applies them."""
    text = re.sub(r"([\"'`(])/_next/", r"\1./_next/", text)
    text = re.sub(r"([\"'`])/data/", r"\1./data/", text)
    text = re.sub(r"([\"'`])/assets/", r"\1./assets/", text)
    text = re.sub(r"([\"'`])/icon\.svg", r"\1./icon.svg", text)
    text = text.replace("/_next/", "/nx/")
    text = text.replace('indexOf("./nx/")', 'indexOf("/nx/")')
    text = text.replace("contain './nx/'", "contain '/nx/'")
    return text


FLIGHT_PUSH = re.compile(r'<script>self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)</script>')


def rewrite_flight(html):
    """Rewrite paths inside Next's embedded page data, keeping every text
    row's declared byte length true. Without this the rewrite shortens a
    row (an inline script naming /_next/ paths, say), the reader runs past
    its end and the page shows "This page couldn't load"."""
    pushes = list(FLIGHT_PUSH.finditer(html))
    if not pushes:
        return html
    data = "".join(json.loads(m.group(1)) for m in pushes)
    raw = data.encode("utf-8")
    out = []
    i = 0
    row = re.compile(rb"([0-9a-zA-Z]+):T([0-9a-f]+),")
    while i < len(raw):
        m = row.match(raw, i)
        if m:
            n = int(m.group(2), 16)
            body = raw[m.end():m.end() + n].decode("utf-8")
            new = rewrite_paths(body).encode("utf-8")
            out.append(m.group(1) + b":T" + format(len(new), "x").encode() + b"," + new)
            i = m.end() + n
            continue
        j = raw.find(b"\n", i)
        j = len(raw) if j < 0 else j + 1
        out.append(rewrite_paths(raw[i:j].decode("utf-8")).encode("utf-8"))
        i = j
    merged = b"".join(out).decode("utf-8")
    first = pushes[0]
    one = "<script>self.__next_f.push([1," + json.dumps(merged).replace("<", "\\u003c") + "])</script>"
    parts = []
    last = 0
    for k, m in enumerate(pushes):
        parts.append(html[last:m.start()])
        if k == 0:
            parts.append(one)
        last = m.end()
    parts.append(html[last:])
    return "".join(parts)

def relativise():
    """Every absolute path the export writes, made relative to its file."""
    for root, _, files in os.walk(OUT):
        rel = os.path.relpath(root, OUT)
        if rel.split(os.sep)[0] in (
            "data",
            "assets",
            "cache",
            "server",
            "types",
            "publish",
        ):
            continue
        for name in files:
            if not name.endswith((".html", ".js", ".css", ".txt")):
                continue
            path = os.path.join(root, name)
            with open(path, encoding="utf-8", errors="surrogateescape") as fh:
                text = original = fh.read()
            if name.endswith(".html"):
                # Next embeds its page data as rows; a text row ("id:T<hex>,")
                # declares its length in bytes, so rewrite those rows here,
                # recomputing each length, before the plain rewrite below
                text = rewrite_flight(text)
            if name.endswith(".css"):
                # CSS sits in _next/static/chunks/; its fonts and images in _next/static/media/
                text = text.replace("/_next/static/media/", "../media/")
            else:
                text = re.sub(r"([\"'`(])/_next/", r"\1./_next/", text)
                text = re.sub(r"([\"'`])/data/", r"\1./data/", text)
                text = re.sub(r"([\"'`])/assets/", r"\1./assets/", text)
                text = re.sub(r"([\"'`])/icon\.svg", r"\1./icon.svg", text)
                # The artifact service reserves names that start with "_":
                # _next/ is published as nx/. Next.js finds its asset prefix
                # by looking for that folder in its own script's URL, so every
                # mention changes together (indexOf("/_next/") included)
                text = text.replace("/_next/", "/nx/")
                # ...and that search string must stay a path segment, not the
                # relative "./nx/" the rewrite above makes of it
                text = text.replace('indexOf("./nx/")', 'indexOf("/nx/")')
                text = text.replace("contain './nx/'", "contain '/nx/'")
            if name.endswith(".js"):
                # The artifact service refuses a literal U+FFFD; in these
                # files it only sits inside string literals, where the escape
                # means the same character
                text = text.replace("\ufffd", "\\uFFFD")
            if text != original:
                with open(
                    path, "w", encoding="utf-8", errors="surrogateescape"
                ) as fh:
                    fh.write(text)


# Files still in public/ that the local build route
# (src/utils/milburn/localBuild.js) never requests, by path under the
# export, "/"-separated: checked against the browser's network log on every
# tab (17 November 2026). Not listed, because the page reads them:
# data/living_standards_outlook.json (Poverty), data/milburn_*.json and
# six files in each run's folder.
SKIP_PUBLISHED = (
    # Written for every run, drawn nowhere on this route; no longer copied
    # into public/ (scripts/milburn_rerun_all.sh), skipped if they are
    "data/milburn/*/income_curve.csv",
    "data/milburn/*/obr_comparison.csv",
    "data/milburn/*/household_scatter_binned.csv",
    # The Budget measures' parameter tables: the Measures tab no longer
    # fetches them on this route (PolicyCards, 18 November 2026). Kept in
    # public/ this release for the tests and preset scripts that read it.
    "data/policy_parameters.json",
)


def skipped(path):
    """Whether a file (its path under the export) is left out of what is published."""
    path = path.replace(os.sep, "/")
    return any(
        fnmatch.fnmatchcase(path, pattern) for pattern in SKIP_PUBLISHED
    )


def stage():
    shutil.rmtree(PUBLISH, ignore_errors=True)
    os.makedirs(PUBLISH)
    skip_dirs = {
        "cache",
        "server",
        "types",
        "publish",
        "_not-found",
        "diagnostics",
        "build",
    }
    skip_files = {"404.html", "_not-found.html", "_not-found.txt"}
    for root, dirs, files in os.walk(OUT):
        rel = os.path.relpath(root, OUT)
        top = rel.split(os.sep)[0]
        if top in skip_dirs:
            dirs[:] = []
            continue
        if rel == ".":
            dirs[:] = [d for d in dirs if d not in skip_dirs]
        for name in files:
            if rel == "." and (
                name in skip_files
                or name.endswith(".json")
                or name.startswith(".")
            ):
                continue
            if skipped(os.path.normpath(os.path.join(rel, name))):
                continue
            src = os.path.join(root, name)
            # Client-side navigation payloads: this one-page app never uses them
            if rel == "." and (
                name.startswith("__next.") or name == "index.txt"
            ):
                continue
            # Pages-router build manifests: nothing in this app reads them
            if name.startswith("_") and name.endswith("Manifest.js"):
                continue
            dest_name = (
                "dashboard.html"
                if (rel == "." and name == "index.html")
                else name
            )
            parts = rel.split(os.sep)
            if parts[0] == "_next":
                parts[0] = "nx"
            dest = os.path.join(PUBLISH, *parts, dest_name)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copy2(src, dest)
    with open(
        os.path.join(PUBLISH, "index.html"), "w", encoding="utf-8"
    ) as fh:
        fh.write(LOADER)


def main():
    if "--no-build" not in sys.argv:
        build()
    relativise()
    stage()
    files = [os.path.join(r, f) for r, _, fs in os.walk(PUBLISH) for f in fs]
    size = sum(os.path.getsize(f) for f in files)
    print(
        f"Staged {len(files)} files, {size / 1e6:.1f} MB, in {os.path.relpath(PUBLISH, ROOT)}/"
    )


if __name__ == "__main__":
    main()
