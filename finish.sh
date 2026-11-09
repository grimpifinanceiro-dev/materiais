#!/usr/bin/env bash
# Mux soundtrack into both formats and export 4 fps contact sheets.
# The lookahead limiter before AAC keeps true peak under -1 dBTP after encoding (the AAC encoder overshoots ~2 dB on transients).
set -euo pipefail
cd "$(dirname "$0")"
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
LBL="drawtext=fontfile=$FONT:text='%{eif\:n*15\:d}':x=8:y=8:fontsize=18:fontcolor=white@0.85:box=1:boxcolor=black@0.6"
for F in 16x9 9x16; do
  ffmpeg -y -loglevel error -i out/seg/video_$F.mp4 -i out/soundtrack.wav -map 0:v -map 1:a -c:v copy \
    -af "volume=0.5dB,alimiter=limit=0.70:attack=4:release=80:level=false:asc=1" -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart out/launch_$F.mp4
done
# 4 fps = every 15th frame -> 120 tiles; label = source frame number
ffmpeg -y -loglevel error -i out/launch_16x9.mp4 -vf "fps=4,scale=384:216,$LBL,tile=10x12:padding=4:color=0xFF00FF" -frames:v 1 out/contact_16x9.png
ffmpeg -y -loglevel error -i out/launch_9x16.mp4 -vf "fps=4,scale=216:384,$LBL,tile=15x8:padding=4:color=0xFF00FF" -frames:v 1 out/contact_9x16.png
for F in 16x9 9x16; do
  echo "== $F"; ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt,nb_frames -of compact out/launch_$F.mp4
  ffmpeg -hide_banner -nostats -i out/launch_$F.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+I:|Peak:" | tail -2
done
