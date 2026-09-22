#!/usr/bin/env python3
"""
Build the site: src/*.html page bodies into the shared layout, with the
values in site.json filled in, the QR codes drawn, the video cards laid
out and the app's own guide converted from Markdown. Output is written to
the repo root, which is what GitHub Pages serves.

    python3 tools/build.py            # build everything
    python3 tools/build.py --guide ../"Bible Study App"/AssistiveBibleReader/AssistiveBibleReader/Resources/UsageGuide.md
                                      # also refresh src/guide.md from the app's guide first

Needs: python3 with `markdown` and `segno` (pip3 install markdown segno).
Both are pure Python. Nothing else — no npm, no Ruby.

Placeholders a page body may use:
    {{site_url}} {{app_name}} {{app_subtitle}} {{studio}} {{contact_email}}
    {{testflight_app_store_url}} {{testflight_join_url}} {{app_store_url}}
    {{commentaries_download_mb}}
    {{qr:<url>}}          an inline SVG QR code for that URL (placeholders inside it are filled first)
    {{videos}}            the video cards from site.json
    {{join_or_soon}}      a Get-the-beta button, or a "coming soon" line while the join URL is empty
"""
import datetime as dt
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "src")

try:
    import markdown
    import segno
except ImportError:
    sys.exit("pip3 install markdown segno")


def load_site():
    with open(os.path.join(ROOT, "site.json"), encoding="utf-8") as f:
        return json.load(f)


def qr_svg(url):
    """A QR code as inline SVG: black on white, quiet zone included, no
    dimensions so CSS sizes it. Medium error correction is enough for a
    printed flyer and keeps the code coarse — easier for a shaky camera."""
    q = segno.make(url, error="m")
    svg = q.svg_inline(scale=8, border=4, dark="#111111", light="#ffffff", omitsize=True)
    return svg.replace("<svg ", '<svg role="img" aria-label="QR code" ', 1)


def video_cards(site):
    out = []
    for v in site["videos"]:
        if v["youtube"]:
            frame = (f'<iframe src="https://www.youtube-nocookie.com/embed/{v["youtube"]}" '
                     f'title="{v["title"]}" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>')
        else:
            frame = '<span>Video coming soon</span>'
        out.append(f'''<article class="video" id="{v["id"]}">
  <div class="frame">{frame}</div>
  <div class="body"><h3>{v["title"]}</h3><div class="len">{v["length"]}</div><p>{v["blurb"]}</p></div>
</article>''')
    return "\n".join(out)


def join_or_soon(site):
    if site["testflight_join_url"]:
        return f'<a class="btn" href="{site["testflight_join_url"]}">Open in TestFlight</a>'
    return ('<p class="note"><strong>The beta link is not live yet.</strong> This page is the one the flyer points to; '
            'when the first build clears Apple\'s review the button appears here, and nothing printed has to change.</p>')


def fill(text, site):
    values = {k: str(v) for k, v in site.items() if not k.startswith("_") and not isinstance(v, (list, dict))}
    values["year"] = str(dt.date.today().year)
    values["videos"] = video_cards(site)
    values["join_or_soon"] = join_or_soon(site)
    # Plain values first, so that {{qr:{{site_url}}/beta.html}} becomes
    # {{qr:https://…/beta.html}} before the code is drawn.
    text = re.sub(r"\{\{(\w+)\}\}", lambda m: values.get(m.group(1), m.group(0)), text)
    text = re.sub(r"\{\{qr:([^}]+)\}\}", lambda m: qr_svg(m.group(1)), text)
    return text


def guide_html():
    """The app's guide, from src/guide.md, with a table of contents."""
    path = os.path.join(SRC, "guide.md")
    with open(path, encoding="utf-8") as f:
        md = f.read()
    # The app's H1 is its own title; the page supplies one.
    md = re.sub(r"^# .*\n", "", md, count=1)
    body = markdown.markdown(md, extensions=["toc", "smarty"], extension_configs={"toc": {"toc_depth": "2"}})
    # A slug per H2 from the toc extension; build the contents list.
    heads = re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', body)
    toc = "\n".join(f'<li><a href="#{i}">{t}</a></li>' for i, t in heads)
    return f'<nav class="toc" aria-label="Contents"><strong>On this page</strong><ol>{toc}</ol></nav>\n<div class="guide">{body}</div>'


def build():
    site = load_site()
    with open(os.path.join(SRC, "_layout.html"), encoding="utf-8") as f:
        layout = f.read()
    built = []
    for name in sorted(os.listdir(SRC)):
        if not name.endswith(".html") or name.startswith("_"):
            continue
        with open(os.path.join(SRC, name), encoding="utf-8") as f:
            page = f.read()
        # Front matter: first line "<!-- title: … | nav: … | description: … -->"
        m = re.match(r"<!--\s*(.*?)\s*-->\n", page)
        meta = dict(kv.split(":", 1) for kv in [p.strip() for p in m.group(1).split("|")]) if m else {}
        meta = {k.strip(): v.strip() for k, v in meta.items()}
        body = page[m.end():] if m else page
        if name == "guide.html":
            body = body.replace("{{guide}}", guide_html())
        html = layout.replace("{{content}}", body)
        html = html.replace("{{title}}", meta.get("title", site["app_name"]))
        html = html.replace("{{description}}", meta.get("description", ""))
        html = html.replace("{{nav}}", meta.get("nav", ""))
        html = html.replace("{{layout}}", meta.get("layout", ""))
        html = fill(html, site)
        # Mark the current page in the nav.
        html = re.sub(rf'<a href="{re.escape(name)}"', f'<a href="{name}" aria-current="page"', html, count=1)
        with open(os.path.join(ROOT, name), "w", encoding="utf-8") as f:
            f.write(html)
        built.append(name)
    print("built " + ", ".join(built))


def main():
    if "--guide" in sys.argv:
        src = sys.argv[sys.argv.index("--guide") + 1]
        shutil.copyfile(src, os.path.join(SRC, "guide.md"))
        print(f"guide refreshed from {src}")
    build()


if __name__ == "__main__":
    main()
