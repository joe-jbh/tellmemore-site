# Tell Me More — Bible Reader · website

The companion site for the app: what it is, the guide, how-to videos, voice
advice, how to get the beta, the privacy page, and a printable flyer.
Served by GitHub Pages at https://jbhstudio.app (the `CNAME` file).

## Layout

    src/            the pages, one body each, plus _layout.html and guide.md
    site.json       the values that change without the pages changing:
                    the TestFlight link, the App Store link, the video IDs
    tools/build.py  assembles src/ + site.json into the root *.html
    css/ img/       stylesheet and icons
    *.html          BUILT — do not edit; edit src/ and rebuild

## Working on it

    pip3 install markdown segno        # once
    python3 tools/build.py             # after any change to src/ or site.json
    open index.html                    # look
    git add -A && git commit -m "…" && git push

To pull in the app's latest guide (it is the same Markdown the app shows
under Settings › About):

    python3 tools/build.py --guide "../Bible Study App/AssistiveBibleReader/AssistiveBibleReader/Resources/UsageGuide.md"

## The flyer

`flyer.html` is a US-letter page. Open it in Safari, File › Print, PDF ›
Save as PDF. Its second QR code points at `/beta.html` on this site, not at
the TestFlight link, so a printed flyer keeps working when the link changes
(or when the app moves to the App Store) — update `site.json`, rebuild, push.

## When something changes

- **TestFlight public link exists** → `testflight_join_url` in site.json.
- **A video is up** → its YouTube ID in `videos`.
- **1.0 on the App Store** → `app_store_url`; beta.html then offers the store.
