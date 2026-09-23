# Art direction — DON’T WAKE MISO

## Product visual target

**Premium cozy editorial character art**: warm, tactile, expensive-looking, instantly readable on a phone, but extremely light to download.

The visual target is not photorealism and not generic flat clip-art. Miso must read as:
- orange cat in <200 ms
- sleepy / touchable
- slightly smug
- capable of a sudden personality flip

V1 uses original vector shapes, gradients, shadows and WebAudio. No third-party art assets ship in the page.

## Reference board — principles only

These are references for visual principles. Do not copy characters, meshes, animations, textures, layouts or brand elements.

### Little Kitty, Big City
- https://www.littlekittybigcity.com/
- Learn: clear silhouette, expressive poses, personality before realism, readable comedy.

### Neko Atsume
- https://www.nekoatsume.com/
- Learn: warm quiet spaces, low visual aggression, behavior-as-reward, phone-first readability.

### Pusheen
- https://pusheen.com/
- Learn: strong silhouette, minimal facial marks, sticker/GIF readability, social-share friendliness.

### Apple product/editorial photography
- Learn: soft controlled shadow, restrained palette, large negative space, one focal subject.
- Do not reproduce any Apple campaign or asset.

## Original Miso language

- body: broad orange loaf / oval mass
- head: large enough for eye-state readability, not anime proportions
- ears: soft triangles with warm inner peach
- eyes: sleeping curves → instant green/charcoal open eyes
- fur: almost no strands; 4–6 graphic stripe shapes
- palette: cream paper, warm wood, orange, charcoal, muted salmon
- UI: off-white glass pills + charcoal typography, no gamer chrome

## Motion hierarchy

Most of the screen should be still. The final reaction only feels large if normal motion is tiny.

1. breathing / ambient tilt: barely visible
2. ear or tail twitch: fake cue
3. breath pause: real anticipation
4. eyes open: hard readable state change
5. attack: single explosive zoom + shake + haptic

## Performance rule

Do not add 3D merely because it looks technically impressive.

A future GLB version must beat the vector version on:
- landing → first interaction
- LCP / INP
- average attempts
- share conversion

If it does not, vector remains production.
