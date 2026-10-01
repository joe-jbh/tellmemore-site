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
    {{showcase}}          the home page's carousel: the feature cards from shorts.json, each with its short
    {{shorts_tiles}}      every short as a tile, by chapter, with "Play all" (the tutorials page)
    {{short:<id>}}        one short on its own, waiting for a tap

The shorts themselves are cut by tools/cut_shorts.py into video/. A short
marked "draft" in shorts.json is left off the site unless you build with
--drafts, which is the way to look at it before it's ready:

    python3 tools/build.py --drafts && open index.html
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


# ---- the video shorts --------------------------------------------------------

DRAFTS = "--drafts" in sys.argv

ICONS = {
    "prev": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 4.5 8 12l7.5 7.5-1.8 1.8L4.4 12l9.3-9.3z"/></svg>',
    "next": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 4.5 16 12l-7.5 7.5 1.8 1.8 9.3-9.3-9.3-9.3z"/></svg>',
    "play": '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>'
            '<svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h4v15H6zm8 0h4v15h-4z"/></svg>',
    "sound": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4.5v15L8 15H4zm12.5-1.7a6 6 0 0 1 0 9.4l-1.2-1.4a4.2 4.2 0 0 0 0-6.6zm2.3-2.7a9.5 9.5 0 0 1 0 14.8l-1.2-1.4a7.7 7.7 0 0 0 0-12z"/></svg>',
}


def load_shorts():
    path = os.path.join(ROOT, "shorts.json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def short_length(s):
    secs = round(sum(b - a for _, a, b in s.get("segments", [])))
    return f"{secs // 60}:{secs % 60:02d}" if secs else ""


def usable(s):
    """A short that has a video and is ready (or drafts are wanted)."""
    return not s.get("placeholder") and (DRAFTS or not s.get("draft"))


def item_for(s, chapters, **extra):
    """What the player needs to know about one short."""
    ch = chapters.get(s.get("chapter"), {})
    if usable(s):
        it = {"kind": "short", "id": s["id"], "title": s["title"], "text": s.get("blurb", ""),
              "eyebrow": ch.get("title", ""), "src": f"video/{s['id']}.mp4",
              "poster": f"video/{s['id']}.jpg", "cues": s.get("cues", [])}
        if s.get("taps"):
            it["taps"] = s["taps"]
        if s.get("silent"):
            it["silent"] = True
    else:
        it = {"kind": "placeholder", "id": s["id"], "title": s["title"], "text": s.get("blurb", "")}
    it.update(extra)
    return it


def player_html(items, mode, frame, tabs=None, label="Videos"):
    first = items[0]
    tab_html = ""
    if tabs:
        tab_html = '<div class="shorts-tabs" role="tablist" aria-label="Features">' + "".join(
            f'<button role="tab" type="button" data-goto="{i}" aria-selected="{"true" if i == 0 else "false"}">{html_escape(t)}</button>'
            for i, t in enumerate(tabs)) + "</div>"
    src = f' src="{first["src"]}" controls' if first["kind"] == "short" and mode == "single" else ""
    poster = f' poster="{first["poster"]}"' if first.get("poster") else ""
    text = ""
    if first.get("glyph"):
        text += f'<div class="glyph">{html_escape(first["glyph"])}</div>'
    text += f'<h3>{html_escape(first["title"])}</h3><p>{html_escape(first.get("text", ""))}</p>'
    controls = ""
    if mode != "single":
        controls += f'<button type="button" data-act="prev" aria-label="Previous">{ICONS["prev"]}<span class="lbl">Back</span></button>'
    controls += f'<button type="button" data-act="play" aria-label="Play">{ICONS["play"]}<span class="lbl">Play</span></button>'
    controls += f'<button type="button" data-act="sound" aria-pressed="false">{ICONS["sound"]}<span class="lbl">Sound off</span></button>'
    if mode != "single":
        controls += f'<button type="button" data-act="next" aria-label="Next">{ICONS["next"]}<span class="lbl">Next</span></button>'
    data = json.dumps({"items": items}, ensure_ascii=False).replace("</", "<\\/")
    return f'''<section class="shorts" data-shorts data-mode="{mode}" aria-label="{html_escape(label)}">
{tab_html}<div class="device" data-frame="{frame}">
  <div class="screen"><div class="hold"></div><video playsinline muted preload="metadata"{src}{poster}></video><div class="overlay"></div><div class="titlecard" aria-hidden="true"></div></div>
</div>
<div class="shorts-below">
  <div class="showcase-text" aria-live="polite">{text}</div>
  <div class="shorts-controls">{controls}</div>
</div>
<script type="application/json">{data}</script>
</section>'''


def html_escape(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def showcase(sh):
    """The home page: the six feature cards, each playing its short."""
    chapters = {c["id"]: c for c in sh["chapters"]}
    by_id = {s["id"]: s for s in sh["shorts"]}
    items, tabs = [], []
    for card in sh["carousel"]:
        s = by_id.get(card.get("short") or "")
        extra = {"glyph": card["glyph"], "title": card["title"], "text": card["text"]}
        if s and usable(s):
            it = item_for(s, chapters, **extra)
            it["eyebrow"] = card["glyph"]
        else:
            it = {"kind": "placeholder", "id": card["glyph"].lower().replace(" ", "-"), **extra}
        items.append(it)
        tabs.append(card["glyph"])
    return player_html(items, "carousel", sh.get("frame", "ipad"), tabs=tabs, label="What it does")


def single_short(sh, sid):
    chapters = {c["id"]: c for c in sh["chapters"]}
    s = next((x for x in sh["shorts"] if x["id"] == sid), None)
    if not s or not usable(s):
        return ""
    return player_html([item_for(s, chapters)], "single", sh.get("frame", "ipad"), label=s["title"])


def shorts_tiles(sh):
    """The tutorials page: a tile per short under its chapter, and one reel
    that plays them all, chapter cards between, as a single video."""
    chapters = {c["id"]: c for c in sh["chapters"]}
    out, reel = [], []
    any_ready = False
    for ch in sh["chapters"]:
        mine = [s for s in sh["shorts"] if s.get("chapter") == ch["id"] and (usable(s) or s.get("placeholder") or s.get("draft"))]
        if not mine:
            continue
        ready = [s for s in mine if usable(s)]
        if ready:
            reel.append({"kind": "chapter", "id": "chapter-" + ch["id"], "eyebrow": "Chapter", "title": ch["title"],
                         "line": ch.get("line", ""), "poster": f"video/{ready[0]['id']}.jpg"})
        out.append(f'<div class="chapter-head" id="{ch["id"]}"><h2>{html_escape(ch["title"])}</h2><p>{html_escape(ch.get("line", ""))}</p></div>')
        out.append('<div class="tiles">')
        for s in mine:
            flag = '<span class="draft-flag">Draft</span>' if s.get("draft") and DRAFTS else ""
            if usable(s):
                any_ready = True
                reel.append(item_for(s, chapters))
                thumb = (f'<button class="thumb" type="button" data-open="{s["id"]}" style="background-image:url(video/{s["id"]}.jpg)" '
                         f'aria-label="Play: {html_escape(s["title"])}"></button>')
                length = f'<div class="len">{short_length(s)}</div>'
            else:
                thumb = '<div class="thumb soon">Video coming soon</div>'
                length = ""
            out.append(f'<article class="tile" id="{s["id"]}">{thumb}<div class="body"><h3>{html_escape(s["title"])}{flag}</h3>{length}<p>{html_escape(s.get("blurb", ""))}</p></div></article>')
        out.append("</div>")
    if not any_ready:
        return "\n".join(out)
    play_all = '<p class="btn-row"><a class="btn" href="#play-all" data-open="">Play them all, one after another</a></p>'
    dialog = ('<dialog class="reel" id="reel-dialog" aria-label="Tutorial videos">'
              '<div class="reel-top"><button class="btn secondary" type="button" data-act="close">Close</button></div>'
              + player_html(reel, "reel", sh.get("frame", "ipad"), label="Tutorial videos") + "</dialog>")
    return play_all + "\n".join(out) + dialog


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
    sh = load_shorts()
    if sh:
        if "{{showcase}}" in text:
            values["showcase"] = showcase(sh)
        if "{{shorts_tiles}}" in text:
            values["shorts_tiles"] = shorts_tiles(sh)
        text = re.sub(r"\{\{short:([\w-]+)\}\}", lambda m: single_short(sh, m.group(1)), text)
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
    print("built " + ", ".join(built) + (" (with drafts)" if DRAFTS else ""))


def main():
    if "--guide" in sys.argv:
        src = sys.argv[sys.argv.index("--guide") + 1]
        shutil.copyfile(src, os.path.join(SRC, "guide.md"))
        print(f"guide refreshed from {src}")
    build()


if __name__ == "__main__":
    main()
