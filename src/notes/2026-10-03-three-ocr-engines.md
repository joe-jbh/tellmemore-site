---
title: Reading an 1871 dictionary with three OCR engines
date: 2026-10-03
tags: Engineering, Content
summary: Two readers agreeing isn't the same as being right. How glm, Apple Vision and the Internet Archive voted on 2,409 Bible names.
---

Hitchcock's *Interpreting Dictionary of Scripture Proper Names* fills ten pages at the back of *Hitchcock's New and Complete Analysis of the Holy Bible* (1871): three columns to a page, one name and its meaning to a line. *Boaz, or Booz, in strength.* The app uses it to explain the names you meet in the text.

There's already a well-known e-text of it. I wanted our own copy, read from the printed page, that we could check line by line and stand behind.

## Three readers

Each column is cut into halves, and each half is read three times:

- **glm-ocr**, a small vision model running locally on my Mac through Ollama;
- **Apple Vision**, the text recognition built into macOS, with its language correction turned off so it reports what it sees;
- the **Internet Archive's** own OCR of the same scan.

At first the rule was simple. glm's reading is the base, and wherever Apple and the Archive agree on something different, take their version.

## Two readers, one mistake

That rule turned out to be wrong more often than right. Old type wears out. A semicolon's tail fades, and both machines see a colon. A worn *u* prints like an *n*, so both read "house" as "honse". A word split across two lines ("smit- … ing of his son") gets rejoined by glm and left in pieces by the other two. In each case glm, which reads more like a person does, had it right, and the vote overruled it.

So the rule changed: a correction is only taken if it produces a real word. It's the rule a human proofreader uses without thinking about it.

## Checking against the page

After the change, 2,341 of the 2,390 names that appear in both our copy and the earlier e-text read exactly the same. I checked every remaining difference against the scan, zoomed in:

- **Where we were wrong**, glm misread a few names. *Zibcon* is Zibeon, and *roof* had been read as *root*.
- **Where the print itself is damaged**, the name is certain from the King James text. *Chnza* is Chuza (Luke 8:3) and *Zcr* is Zer.
- **Where the print is simply wrong**, we fix it and say so: "release; per-don".
- **Where the earlier e-text is wrong**, the scan sides with us. Bethphage is "house of my *mouth*", not "month", and Habaziniah, Sanhedrim and Shaaph are spelled the way the page spells them.

Every correction is logged with what the page shows and a cropped image of it. One line, *Mizar, little*, was lost because the column was cut through the middle of it; the next version of the cutter looks for a blank row in the image before it cuts.

Next up: Nave's Topical Bible, at two columns and about eight hundred pages.
