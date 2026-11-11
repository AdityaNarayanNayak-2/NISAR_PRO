# NISAR Pro intro video

48-second animated intro, made with [Remotion](https://www.remotion.dev/) (React → MP4).
All maps and numbers come from `ingarss_2026/` results.

```bash
cd video
npm ci
npm run assets    # draws the map pictures into public/ (needs numpy, rasterio, pillow)
npm run render    # writes out/nisar-pro-intro-16x9.mp4 and out/nisar-pro-intro-1x1.mp4
npm run studio    # live preview in the browser, to edit scenes
```

Scenes and their lengths are in `src/Intro.tsx` (`S = { hook, title, ... }`, 30 fps).

To add music (the video has none):

```bash
ffmpeg -i out/nisar-pro-intro-16x9.mp4 -i music.mp3 -map 0:v -map 1:a -c:v copy -c:a aac -shortest -af "afade=t=out:st=45:d=3" out/with-music.mp4
```
