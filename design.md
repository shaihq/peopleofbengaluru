# DESIGN.md — Bengaluru Visual Specification

This is the single source of truth for how the game looks.
It is a specification, not inspiration. If code conflicts with this file, the code is wrong.

---

# 0. ONE-LINE TARGET

**Overwatch-quality stylized hero-game art, set in a sunny, lived-in Bengaluru.**

We are taking Overwatch's *craft*, meaning its proportions, materials, lighting, color discipline and readability.
We are NOT taking its characters, logos, UI, assets or setting.

---

# 1. REFERENCES AND WHAT TO TAKE FROM THEM

| Reference | Take | Leave |
|---|---|---|
| Overwatch street scene (primary) | Heroic proportions, stylized PBR materials, lived-in street layering, warm daylight, readable silhouettes, real-world signage turned into game art | Sci-fi weapons, combat VFX, NYC setting |
| Mobile hero-game lobbies (secondary) | Bold slanted UI panels, chunky buttons, clear HUD hierarchy, characters presented on a stage | Purple/neon palette, chibi proportions, currency/monetisation clutter |

When the two disagree, **Overwatch wins** for the world and characters. The mobile refs only inform HUD structure.

---

# 2. VISUAL PILLARS

1. **Heroic and chunky.** Everything is slightly oversized, rounded and confident. Nothing is thin, fragile or fussy.
2. **Painted, not photographed.** Materials respond to light realistically, but surfaces are clean, simplified color fields with soft gradients. There is no photo noise.
3. **Warm world, saturated people.** The city is warm and slightly muted, and characters are the most saturated things on screen.
4. **Lived-in, not cluttered.** Layered detail (signs, wires, plants, awnings) clusters around points of interest, with calm negative space between.
5. **Light tells the story.** A warm sun, cool shadows and soft ambient occlusion. Most of the beauty comes from lighting.

---

# 3. COLOR

## 3.1 World palette (tokens)

```
SKY_TOP          #5FA8E0
SKY_HORIZON      #F4DDB4
SUN              #FFD9A0
SHADOW_TINT      #5A6E9A   cool blue in shadows, never grey/black

CONCRETE_WARM    #D8C7AE
CONCRETE_AGED    #B8A68C
TERRACOTTA       #C8643C
ROOF_TILE        #B5523A

WALL_MINT        #9CCFB4
WALL_BUTTER      #F2D58A
WALL_POWDER      #9EC3D9
WALL_SALMON      #E8A08A
WALL_PINK        #E59AA6
WALL_WHITE       #F3EDE1   never pure white

LEAF_DEEP        #2F5E34
LEAF_MID         #4E8A3E
LEAF_LIGHT       #8DBB4F

ASPHALT          #4A4A52
ROAD_PAINT       #F2EBD9
KERB_YELLOW      #F2C230   Bengaluru black-and-yellow kerbs
KERB_BLACK       #2B2B2B

AUTO_GREEN       #2E8B4E
AUTO_YELLOW      #F2C230
BMTC_BLUE        #2E6FB7
```

## 3.2 Rules

- No pure black (#000) or pure white (#FFF) anywhere in the world.
- Shadows shift toward SHADOW_TINT, not toward grey.
- Each building uses one wall color, one trim color (white or concrete) and at most one accent.
- Character colors run 15–25% more saturated than anything in the environment.
- **Banned as dominant colors:** purple, magenta, cyan, neon blue, and purple-to-cyan gradients. They may appear only as tiny accents, such as one shop sign.

---

# 4. CHARACTERS

## 4.1 Proportions (Overwatch-style heroic)

- Height is about 7 heads. That's not chibi and not realistic.
- Hands, feet and shoulders are oversized by about 20–30%.
- The head is slightly large, so faces read at medium distance.
- Gear (backpacks, jackets, headphones, tool belts) is chunky and blocky.
- Each character has **one signature shape** readable as a silhouette: a hood, cap, oversized headphones, a laptop backpack, a visor, a long kurta-jacket or robotic shoulders.

## 4.2 Material split

Every character has three or more clearly separated material zones:
- **Skin**: soft, warm subsurface feel.
- **Fabric**: matte with large painted folds.
- **Hard parts** (metal or plastic): beveled edges with a bright worn edge highlight.

## 4.3 Color

- One dominant color, one secondary and one accent (60/30/10).
- The accent color repeats on 2–3 spots (shoes, collar, gadget) to tie the design together.

## 4.4 Faces

- Large readable eyes and simplified features.
- Expressive, with a neutral confident default expression.
- No realistic pores or hair strands. Hair is sculpted as large clumps.

## 4.5 Universe consistency

Humans, robots, superheroes and aliens all use the same proportions, the same material approach and the same palette discipline. A robot looks like it was designed by the same team as the barista.

## 4.6 Readability test

- **Far (30m+):** the silhouette and dominant color identify the character.
- **Medium (10m):** you can tell the outfit and their "type" (designer, dev, founder).
- **Close (2m):** face, accessories and personality come through.

---

# 5. MATERIALS

- Use **stylized PBR**: `MeshStandardMaterial` / `MeshPhysicalMaterial`, roughness mostly 0.6–0.9, metalness only on actual metal.
- Use flat color with soft vertex or gradient variation, not photo textures.
- Allowed texture detail: subtle hand-painted grime at wall bases, soft gradients from dark at the bottom to light at the top on tall surfaces, and painted signage.
- Edge wear: beveled edges catch light. Achieve it with real geometry bevels, not normal-map noise.
- **No toon outlines and no cel-shading.** Overwatch is not cel-shaded.
- Glass: slightly reflective with a soft sky tint, never a mirror.

---

# 6. ENVIRONMENT

## 6.1 Construction rules (code-built world)

- **No raw boxes.** Every box-like form uses bevelled/rounded geometry (`RoundedBoxGeometry` or equivalent) with a radius of 2–6% of its size.
- Buildings are assembled from a **kit**: base, floor modules, window bays, balconies, parapets, awnings, water tanks and signboards. Every building comes from the kit, arranged by hand.
- Windows are **recessed**, with sills and frames. They are never painted onto flat walls.
- Proportions are exaggerated: doors and windows about 1.2x scale, and signboards oversized.
- No randomized building generation. Every building is placed and configured intentionally.

## 6.2 Bengaluru signifiers (use these, in this priority)

1. Black-and-yellow painted kerbs
2. Green-and-yellow autos
3. Rain trees and gulmohars with big rounded canopies, which shade the street
4. Hand-painted shop signboards in Kannada and English
5. Sintex-style rooftop water tanks
6. Tangled overhead cables between poles
7. Metro pillars and a viaduct in the background
8. Darshini café with a steel counter, a filter-coffee stand and a tea glass rack
9. Cement apartment blocks with balconies and grilles
10. BMTC buses and bus shelters
11. Glass tech-park towers on the skyline only, never in the foreground

## 6.3 Composition

- **Foreground:** the player and nearby characters, plus clear ground space.
- **Midground:** street, shopfronts and props, where detail clusters.
- **Background:** skyline silhouettes, the metro line and tree masses, fading into atmospheric haze.
- Detail density is highest at eye level (0–4m) and simplifies upward.
- Leave calm areas (an open road, plain wall sections) so detail clusters read.

## 6.4 First district: Koramangala block

One street intersection with:
- A darshini café on the corner, as the social hub
- A startup office in a converted house
- A 4-storey apartment block
- A small park with a rain tree
- A row of 3–4 shops
- A bus stop

Build this beautifully before adding anything else.

---

# 7. LIGHTING AND POST-PROCESSING

## 7.1 Default: late-morning Bengaluru sun

- **Sun:** a directional light in warm SUN color, intensity about 2.5–3, angle about 40° elevation. Soft shadows (PCFSoft or VSM), with the shadow map tightly fitted to the play area.
- **Sky/ambient:** a hemisphere light with SKY_TOP above and warm ground bounce (#C9A27A) below.
- **Environment map:** a soft sky HDRI or generated gradient env for reflections. It must not be a studio HDRI.
- **Fog:** exponential, colored SKY_HORIZON, which creates the background haze.

## 7.2 Post-processing stack (in order)

1. Ambient occlusion (N8AO or GTAO), soft and wide, which gives the "expensive" grounded feel
2. Bloom, with a **high threshold**, so only light sources, sky and specular glints bloom
3. Tone mapping with ACES Filmic, exposure around 1.0
4. A subtle warm color grade
5. A very light vignette

## 7.3 Time-of-day presets (later phases)

Morning, Afternoon, Golden Hour, Sunset, Night and Rain. Each preset is a complete set of colors and intensities for sun, sky, fog and grade. At night, only real light sources (signs, streetlights, windows) emit light.

## 7.4 Rules

- Shadows are never pure black.
- Characters get a subtle rim or back light so they separate from the background.
- Nothing glows unless it is a real light source.

---

# 8. CAMERA

- Third-person, behind the shoulder, with the player slightly left of center.
- FOV 55–60°.
- The camera height puts the horizon about one-third from the top.
- Smooth follow with spring damping, and no snapping.
- Collision with buildings: the camera pulls in instead of clipping.
- Running widens FOV by about 4° and pulls the camera back slightly.

---

# 9. ANIMATION AND GAME FEEL

- Movement has weight: short acceleration and deceleration curves, and the character turns smoothly toward its direction of travel.
- Idle animations breathe, never freeze.
- UI animates with snappy ease-out (150–250ms) and a slight overshoot on appear.
- Ambient life (leaves, birds, traffic) moves slowly and calmly in the background.

---

# 10. UI / HUD

## 10.1 Style

Bold, tactile game UI. Structurally it's inspired by hero-game lobbies; in color it's Bengaluru.

- **Shapes:** slanted parallelogram panels (about 8° skew), chunky borders and slight bevels with a hard bottom shadow (2–4px offset, no blur).
- **No glassmorphism, no blurred translucent cards, no thin 1px SaaS borders.**

## 10.2 UI tokens

```
UI_INK        #1C1F2B   panel base
UI_INK_SOFT   #2A2F40
UI_CREAM      #FFF6E5   primary text on dark
UI_SAFFRON    #FFB020   primary action / highlight
UI_ACTION     #FF5A36   alerts, secondary action
UI_OPEN       #3DDC84   open-to-work
```

## 10.3 Typography

- **Display:** "Barlow Condensed", 800 italic, uppercase, for names, headers, buttons and HUD labels.
- **Body:** "Barlow", 500/600, for roles, descriptions and small text.
- Uppercase headers with tight letter-spacing (0.02em).
- Text sits on solid panels or carries a subtle dark shadow, so it never floats unreadably over the world.

## 10.4 HUD layout

- **Top-left:** a location badge (BENGALURU / KORAMANGALA).
- **Top-right:** the online count (● 238 DESIGNERS ONLINE).
- **Bottom-left:** key hints as chunky key-caps: `WASD` MOVE · `SHIFT` RUN · `E` INTERACT · `M` MAP.
- Keep the HUD minimal. The world is the hero.

## 10.5 Nameplates

- Float above the head and always face the camera.
- **NAME** in display font, cream, with a dark shadow. **Role** small beneath it.
- An optional `● OPEN TO WORK` pill in UI_OPEN.
- No card background, or at most a small slanted ink tab behind the name.
- Fade with distance, show the name only beyond about 20m, and hide beyond about 40m.

## 10.6 Profile panel

- Slides in from the right as a slanted ink panel covering about 35% of the screen. The world stays visible and the camera frames the character on the left.
- Shows name, role, company, location, "currently building", and open-to-work status.
- Buttons are chunky slanted buttons: PORTFOLIO (saffron, primary), LINKEDIN, X.

---

# 11. ASSET PIPELINE

| What | How |
|---|---|
| Buildings, roads, kerbs, street furniture | Built in code from the kit (section 6.1) |
| Trees | Built in code from clustered rounded canopy blobs plus a trunk |
| Characters | Concept image → AI image-to-3D (Higgsfield / Meshy / Tripo) → rig and animate in Mixamo → GLB |
| Hero props (auto, BMTC bus) | AI image-to-3D → GLB, with materials re-tuned to the palette |

Rules:
- **Characters are never built from primitives.**
- Every generated asset gets its materials re-tuned to this palette and roughness range before use.
- An asset that fails the consistency test (section 13) is rejected, not "fixed later".
- Keep GLBs light: characters under about 15k triangles and props under about 5k. Use Draco/meshopt compression.

---

# 12. NEVER

- Generic Three.js demo look (grey ground, default lights, a floating cube world)
- Purple/cyan/neon palettes, cyberpunk or synthwave styling
- Glassmorphism, SaaS cards or thin-border UI
- Cel-shading or toon outlines
- Photorealism or photo textures
- Low-poly faceted style
- Random or procedural building placement
- Bloom on non-light surfaces
- Pure black shadows
- Chibi or super-deformed characters
- Mixing character styles

---

# 13. CONSISTENCY CHECK (run before shipping any visual)

1. Would this sit naturally in a screenshot next to an Overwatch street scene?
2. Does it use only palette tokens?
3. Are all edges beveled and all forms chunky?
4. Does it read at its intended distance?
5. Is the lighting doing the work, rather than glow and effects?
6. Does it say "Bengaluru" without being a literal copy?
7. Would an art director believe one team made everything on screen?

If any answer is no, redesign before continuing.
