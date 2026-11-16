# Header renderer

The animation renderer is ISO C17. The README uses the checked-in WebP animation, a GIF fallback, and a still image for reduced motion. No JavaScript runs in the profile.

The canvas is 854 × 220 pixels at 20 fps. The video starts with the first fracture at 2.1 seconds. The opening stops growing at 3 seconds while loose shards continue falling. The complete video excerpt ends at 9.6 seconds, followed by restoration. The loop lasts 11.6 seconds.

## Compile

```sh
mkdir -p build
cc -std=c17 -O2 -Wall -Wextra -Wpedantic -Werror src/header_fracture.c -lm -o build/header-fracture
```

Visual Studio Developer Command Prompt:

```bat
mkdir build
cl /nologo /std:c17 /W4 /WX /O2 /D_CRT_SECURE_NO_WARNINGS src\header_fracture.c /Fe:build\header-fracture.exe /Fo:build\header-fracture.obj
```

## Render

The renderer accepts one RGB24 foreground frame and 232 RGB24 background frames, all 854 × 220 pixels. It writes the composed RGB24 animation to standard output. It does not download media or require credentials.

```sh
build/header-fracture --prepare build/front.ppm
build/header-fracture build/front.rgb build/back.rgb | ffmpeg -f rawvideo -pixel_format rgb24 -video_size 854x220 -framerate 20 -i - -an -c:v libx264 -crf 17 -preset slow -pix_fmt yuv420p -movflags +faststart build/header.mp4
```

`--prepare` produces the foreground gradient. Composite the title and formula onto it, then convert it to RGB24 as `front.rgb`. The committed `assets/header-still.png` can also be decoded directly for rebuilding the same design.

```sh
ffmpeg -i assets/header-still.png -frames:v 1 -f rawvideo -pix_fmt rgb24 build/front.rgb
```

The video is centered on the opening at x = 411, with 28 pixels of horizontal coverage beyond its widest edges. Its native aspect ratio is preserved.

The background uses seconds 26–33.5 of the [He-Man clip](https://www.youtube.com/watch?v=ZZ5LpwO-An4). Given a local `source.mp4`, prepare the same position and timing with:

```sh
ffmpeg -ss 26 -t 7.5 -i source.mp4 -vf "fps=20,scale=294:220:flags=lanczos,tpad=start_mode=clone:start_duration=2.1:stop_mode=clone:stop_duration=2,pad=854:220:411:0:color=0x0d1117" -frames:v 232 -an -f rawvideo -pix_fmt rgb24 build/back.rgb
```

Encode the output:

```sh
ffmpeg -i build/header.mp4 -c:v libwebp_anim -quality 78 -compression_level 4 -loop 0 -an build/header.webp
ffmpeg -i build/header.mp4 -vf "fps=12,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" -loop 0 build/header.gif
```

Published animation filenames include their SHA-256 prefixes. After rebuilding, copy the outputs into `assets/` under new hash-based names and update both README image references. This gives each version a new URL instead of relying on query parameters.

The Math Rain SVGs preserve the original artwork as a snapshot. Statistics, badges, the typing line, and the footer use the original external services. There are no scheduled commits or background workflows.
