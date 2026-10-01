#!/usr/bin/env python3
"""
Cut the video shorts from the screen recordings.

    python3 tools/cut_shorts.py <recordings folder>            # every short not yet cut
    python3 tools/cut_shorts.py <recordings folder> reader-book  # just these, re-cut
    python3 tools/cut_shorts.py <recordings folder> --all        # every short, re-cut

Reads shorts.json. For each short, joins its segments (source file, start
second, end second) into video/<id>.mp4 and draws a poster, video/<id>.jpg.
The video is the screen only: no bezel, no callouts. The page draws the frame
and the callouts over it (js/shorts.js), so either can change without
touching the video.

Needs ffmpeg with libx264.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "video")
WIDTH = 1280          # 1280 × 882 from the iPad's 2420 × 1668: sharp on a laptop, ~1–3 MB a short
CRF = "27"


def has_audio(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
                          "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip()
    return bool(out)


def cut(short, recordings):
    segs = short["segments"]
    audio = all(has_audio(os.path.join(recordings, s[0])) for s in segs)
    args = ["ffmpeg", "-v", "error", "-y"]
    for src, start, end in segs:
        args += ["-ss", str(start), "-t", str(end - start), "-i", os.path.join(recordings, src)]
    pre = ""
    if short.get("crop"):
        w, h, x, y = short["crop"]
        pre = f"crop={w}:{h}:{x}:{y},"
    chains, labels = [], ""
    for i in range(len(segs)):
        chains.append(f"[{i}:v]{pre}scale={WIDTH}:-2:flags=lanczos,fps=30,setsar=1,format=yuv420p[v{i}]")
        if audio:
            chains.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo[a{i}]")
            labels += f"[v{i}][a{i}]"
        else:
            labels += f"[v{i}]"
    chains.append(f"{labels}concat=n={len(segs)}:v=1:a={1 if audio else 0}[v]" + ("[a]" if audio else ""))
    out = os.path.join(OUT, short["id"] + ".mp4")
    args += ["-filter_complex", ";".join(chains), "-map", "[v]"]
    args += ["-map", "[a]", "-c:a", "aac", "-b:a", "96k"] if audio else ["-an"]
    args += ["-c:v", "libx264", "-preset", "slow", "-crf", CRF, "-profile:v", "high",
             "-movflags", "+faststart", out]
    subprocess.run(args, check=True)
    poster = os.path.join(OUT, short["id"] + ".jpg")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(short.get("poster", 1)), "-i", out,
                    "-frames:v", "1", "-q:v", "4", poster], check=True)
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out],
                         capture_output=True, text=True).stdout.strip()
    print(f"  {short['id']:<16} {float(dur):5.1f} s  {os.path.getsize(out) / 1e6:4.1f} MB")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    recordings = sys.argv[1]
    wanted = [a for a in sys.argv[2:] if not a.startswith("--")]
    every = "--all" in sys.argv
    with open(os.path.join(ROOT, "shorts.json"), encoding="utf-8") as f:
        shorts = json.load(f)["shorts"]
    os.makedirs(OUT, exist_ok=True)
    for s in shorts:
        if s.get("placeholder"):
            continue
        done = os.path.exists(os.path.join(OUT, s["id"] + ".mp4"))
        if wanted and s["id"] not in wanted:
            continue
        if done and not wanted and not every:
            continue
        cut(s, recordings)


if __name__ == "__main__":
    main()
