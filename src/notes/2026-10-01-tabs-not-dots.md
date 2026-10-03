---
title: Tabs, not dots
date: 2026-10-01
tags: Design, Accessibility
summary: A carousel's dots are a few points wide. For a reader with Parkinson's they may as well not be there.
---

The home page shows six short videos, one for each thing the app does. The usual way to build that is a carousel with a row of dots underneath: one dot per slide, the current one filled in.

I never shipped the dots. A dot is a few points across, and it says nothing about what it leads to. The app was built for my mother, whose hand shakes and whose eyes struggle with small grey shapes on a light page. A row of dots would give her nothing to aim at and no way to tell one slide from another.

## What replaced them

- **Tabs with words on them.** *One screen · Speak · Listen · Ask · Margin · Siri.* Each one is at least 48 points tall and says what it is.
- **Big controls under the video.** Back, Play/Pause, Sound and Next, each a 64-point button with a label under the icon.
- **A tap on the video pauses it.** That's the one gesture everyone tries first.
- **It starts muted and moves on by itself** when one short ends, so someone who just watches still sees all six.

None of this is clever. It's what you get when the person you design for is in the room. The rule I keep coming back to: if a target is too small for her, it's too small.
