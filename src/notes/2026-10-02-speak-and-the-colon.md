---
title: Why Speak said "twenty-four thousand twenty-two"
date: 2026-10-02
tags: Accessibility, Engineering
summary: One colon, read as a thousands comma. A small fix that matters to someone who listens instead of reads.
---

I asked Ask about Genesis 24:22 and had its answer read aloud. Where the answer gave the verse "in today's words", the voice said "Genesis twenty-four thousand twenty-two."

## Where it came from

A chapter-and-verse colon is ambiguous to a speech voice, so the app rewrites references before speaking them. That rewrite turned the colon into a comma: `24:22` became `24,22`.

To a person, a comma there is a pause. To the speech engine, `24,22` is a number with a thousands separator: twenty-four thousand and twenty-two.

## The fix

The colon now becomes a plain space. `Genesis 24 22` is read "Genesis twenty-four, twenty-two", which is how people say it out loud anyway. The voices for other languages take the same path now too, and there are tests that pin down exactly what each reference turns into.

It's a one-character change. But for someone who listens to the app instead of reading it, a wrong number in the reference sends them to the wrong place. Bugs like this only turn up when real people use the app in a real room, which is why the beta matters.
