#!/usr/bin/env bash
# Reproduce the local derivative; inputs remain untouched.
set -euo pipefail
cd "$(dirname "$0")/../.."
ffmpeg -y -i local-artifacts/codex-ritmo/reference.m4v -i local-artifacts/codex-ritmo/codex-ritmo.m4v \
-filter_complex '[0:v]trim=0:10.3102,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1[v0];[1:v]trim=0:155.8398,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1[v1];[0:v]trim=166.15:166.5,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1[v2];[1:v]trim=start=168.9024,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,tpad=stop_mode=clone:stop_duration=1[v3];[v0][v1][v2][v3]concat=n=4:v=1:a=0,fps=30000/1001[v]' \
-map '[v]' -map 0:a:0 -t 440.3399 -c:v libx264 -preset veryfast -crf 21 -pix_fmt yuv420p -c:a copy -movflags +faststart \
public/local-course-assets/codex-ritmo/ritmo-basico-aligned.mp4
