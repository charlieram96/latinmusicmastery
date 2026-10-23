#!/bin/bash
# Rebuild source/assets/seq (the JPEG frame sequences the promo plays) from the
# repository's own videos plus the two recorded PlaySense clips.
# usage: bash tools/extract_seq.sh   (run from local-artifacts/lmm-promo)
set -e
cd "$(dirname "$0")/.."
REPO=../..
SEQ=source/assets/seq
mkdir -p $SEQ/hero $SEQ/heroslow $SEQ/band $SEQ/miami $SEQ/ps_conga $SEQ/ps_piano
ffmpeg -v error -y -i $REPO/public/videos/hero-video-final.mp4 -vf "fps=30,scale=1920:1080" -q:v 3 $SEQ/hero/f_%05d.jpg
ffmpeg -v error -y -ss 0 -t 2.3 -i $REPO/public/videos/hero-video-final.mp4 \
  -vf "minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:vsbmc=1,setpts=2.0*PTS,fps=30,scale=1920:1080" -q:v 3 $SEQ/heroslow/f_%05d.jpg
ffmpeg -v error -y -i $REPO/public/videos/band-performing.mp4 -vf "fps=30,scale=1920:1080:flags=lanczos" -q:v 3 $SEQ/band/f_%05d.jpg
ffmpeg -v error -y -i $REPO/public/marketing/stage-miami.mp4 -vf "fps=30" -q:v 3 $SEQ/miami/f_%05d.jpg
# PlaySense stage recordings (made with tools/record.mjs against /playsense-preview); numbered from 0
ffmpeg -v error -y -i source/assets/clips/ps_conga.mp4 -start_number 0 -q:v 2 $SEQ/ps_conga/f_%05d.jpg
ffmpeg -v error -y -i source/assets/clips/ps_piano.mp4 -start_number 0 -q:v 2 $SEQ/ps_piano/f_%05d.jpg
for d in hero heroslow band miami ps_conga ps_piano; do echo "$d $(ls $SEQ/$d | wc -l) frames"; done
