# Conquerors — AI Art Reference Prompts

Paste-ready prompts for generating high-quality 3D-rendered concept art of every
unit and building in the game, for Gemini's image generator (Nano Banana / Imagen).
Organized so you can batch through them and send the results back for the in-game
sprites to be rebuilt to match.

## How to use this doc

1. Pick a prompt block below.
2. If it contains `[[CIVILIZATION]]`, copy the whole paragraph, then replace that
   exact placeholder with one of the three civilization lines printed just under it
   (Rome / China / India). Each is a complete, ready-to-paste prompt once swapped in.
3. Paste the resulting paragraph into Gemini as a single message. If the UI offers
   an aspect-ratio picker, choose **1:1 / square**. Use the highest quality/resolution
   setting available.
4. Save the image with a clear filename (e.g. `rome_legionary.png`,
   `china_towncenter.png`) — the in-game key is noted in parentheses in each heading
   so the mapping back to code stays unambiguous.
5. Send a batch back whenever convenient — you don't need all ~108 before sending
   the first ones over.

**Expectation-setting:** Gemini will give you one strong "hero shot" per prompt, not
a multi-direction sprite sheet or walk-cycle. Treat these as concept-art references.
Once you bring images back, the practical path is for me to redraw matching
procedural canvas sprites in the existing style (keeps the zero-asset, all-code
rendering pipeline and all current animations working) — or, if you'd rather drop
the PNGs in directly, that needs a separate image-loading pipeline (sprite sheets,
per-direction art, team-color tinting on real pixels) which is a bigger change we'd
scope separately. No need to decide now — just flagging it so there's no surprise
later.

---

## Global render spec (already baked into every prompt below)

**Unit/creature tail:**
> Isometric dimetric RTS game-art camera elevated about 45°, slight 3/4 rotation,
> subject centered and filling roughly 75% of the frame height, neutral standing or
> action pose facing toward the lower-right. Render quality of a modern 3D
> real-time-strategy game (Age of Empires IV tier) — not flat illustration, not
> photorealistic, not pixel art, not anime. Soft three-point studio lighting with the
> key light from the upper-left and a soft contact shadow beneath the subject. Plain
> flat light-grey (#d9d9d9) background, no ground texture, no scenery, no text, no
> watermark, no logo. Square 1:1 image, crisp high-detail materials.

**Building tail:**
> Isometric dimetric RTS game-art camera elevated about 45°, viewing the building's
> front-left corner so two walls and the roofline are all clearly visible, structure
> centered and filling roughly 80% of the frame height, sitting on a small ground
> patch matching only its own footprint. Render quality of a modern 3D
> real-time-strategy game (Age of Empires IV tier) — not flat illustration, not
> photorealistic, not blocky voxel art. Soft three-point studio lighting with the key
> light from the upper-left and a soft contact shadow, plain flat light-grey
> (#d9d9d9) backdrop, no surrounding scenery, no text, no watermark, no logo. Clean,
> elegant, and restrained ornamentation — the silhouette should read clearly at a
> glance, not be visually cluttered. Square 1:1 image.

## Civilization palette key

- **Rome** — `{{ROME}}`: Imperial Roman military aesthetic: crimson-red wool cloth,
  burnished bronze and steel armor, white-and-gold trim, leather strapping,
  laurel-wreath and SPQR-eagle motifs. Architecture: white marble and warm
  terracotta, rounded arches, fluted columns, red-tiled roofs.
- **China** — `{{CHINA}}`: Han-dynasty-inspired Chinese aesthetic: black-lacquered
  armor with crimson-red and gold trim, jade-green accents, silk robing.
  Architecture: dark timber framing, white plaster walls, grey tile roofs with
  gently upturned eaves — elegant and clean, never cluttered or over-decorated.
- **India** — `{{INDIA}}`: Mughal/Maurya-inspired Indian aesthetic: saffron-orange
  and royal-blue silk, gilded brass armor and fittings, restrained gold filigree.
  Architecture: ivory and pink sandstone, scalloped arches, domed chhatri turrets.

---

## 1. Universal land units (all 3 civs train these)

### Settler / Villager (`settler`)
```
A humble worker villager carrying simple tools (an axe, hoe, or pickaxe slung over
one shoulder), light unarmored everyday clothing, practical and modest appearance,
calm idle stance facing the lower-right. [[CIVILIZATION]] Isometric dimetric RTS
game-art camera elevated about 45°, slight 3/4 rotation, subject centered and
filling roughly 75% of the frame height, neutral standing or action pose facing
toward the lower-right. Render quality of a modern 3D real-time-strategy game (Age
of Empires IV tier) — not flat illustration, not photorealistic, not pixel art, not
anime. Soft three-point studio lighting with the key light from the upper-left and a
soft contact shadow beneath the subject. Plain flat light-grey (#d9d9d9) background,
no ground texture, no scenery, no text, no watermark, no logo. Square 1:1 image,
crisp high-detail materials.
```
- Rome: Imperial Roman military aesthetic: crimson-red wool cloth, burnished bronze and steel armor, white-and-gold trim, leather strapping, laurel-wreath and SPQR-eagle motifs. Architecture: white marble and warm terracotta, rounded arches, fluted columns, red-tiled roofs.
- China: Han-dynasty-inspired Chinese aesthetic: black-lacquered armor with crimson-red and gold trim, jade-green accents, silk robing. Architecture: dark timber framing, white plaster walls, grey tile roofs with gently upturned eaves — elegant and clean, never cluttered or over-decorated.
- India: Mughal/Maurya-inspired Indian aesthetic: saffron-orange and royal-blue silk, gilded brass armor and fittings, restrained gold filigree. Architecture: ivory and pink sandstone, scalloped arches, domed chhatri turrets.

> From here on, only the **subject sentence** is shown for universal units/buildings
> to keep this scannable — always append the matching tail from the Global Render
> Spec above, and swap `[[CIVILIZATION]]` for one of the three palette lines.

### Scout — light cavalry (`scout`)
```
A light cavalry scout riding a lean, fast horse at a trot, minimal armor, a leather
vest, carrying a short spear or javelin, alert posture scanning the horizon.
[[CIVILIZATION]]
```
*(+ unit tail)*

### Spearman (`spearman`)
```
An infantry spearman in a balanced combat stance, an upright spear in one hand and a
round shield in the other, medium-weight armor over a tunic. [[CIVILIZATION]]
```
*(+ unit tail)*

### Swordsman (`sword` — China & India only; Rome's slot is the Legionary, see §2)
```
An infantry swordsman in a ready combat stance, short sword drawn, a round shield on
the other arm, leather-and-scale armor. [[CIVILIZATION]]
```
*(+ unit tail — use only the China and India palette lines)*

### Archer (`archer`)
```
A ranged archer at full draw, a recurve bow taut, an arrow nocked, a quiver of
arrows at the hip, light unpadded clothing for mobility. [[CIVILIZATION]]
```
*(+ unit tail)*

### Crossbowman (`crossbow`)
```
A crossbowman aiming a loaded crossbow forward at chest height, sturdy
leather-and-metal vest armor heavier than a regular archer's, a bolt case at the
hip. [[CIVILIZATION]]
```
*(+ unit tail)*

### Longbowman (`longbow`)
```
A longbowman at full draw with a tall longbow nearly as long as their own body,
lightly armored, a wide stable stance, a full arrow quiver on the back.
[[CIVILIZATION]]
```
*(+ unit tail)*

### Catapult (`catapult`)
```
A wooden siege catapult / mangonel war machine on wheels, taut torsion ropes, a
heavy boulder loaded in the throwing-arm cradle, a small civilization banner mounted
on the frame, machine only with no crew figure. [[CIVILIZATION]]
```
*(+ unit tail)*

### Trader (`trader`)
```
A merchant trader leading a pack-laden donkey (or carrying a heavy satchel of cloth
bundles, jars, and coin pouches), simple unarmored merchant attire, a friendly
non-combat posture. [[CIVILIZATION]]
```
*(+ unit tail)*

### Ox Cart (`cart`)
```
A heavy wooden ox-drawn cart loaded with sacks of grain, lumber, and ore, pulled by
one sturdy ox, wooden wheels with iron rims, a slow and dependable silhouette.
[[CIVILIZATION]]
```
*(+ unit tail)*

---

## 2. Unique civilization units (already civ-locked — full prompts)

### Rome — Legionary (`legionary`, replaces Swordsman)
```
A Roman legionary heavy infantryman: full lorica segmentata banded-plate armor, an
iconic large curved rectangular scutum shield bearing an SPQR eagle emblem, a short
gladius sword drawn, a bronze imperial galea helmet with a small crest, a red tunic
beneath the armor, a confident forward combat stance. Isometric dimetric RTS
game-art camera elevated about 45°, slight 3/4 rotation, subject centered and
filling roughly 75% of the frame height. Render quality of a modern 3D
real-time-strategy game (Age of Empires IV tier) — not flat illustration, not
photorealistic, not pixel art, not anime. Soft three-point studio lighting, key
light upper-left, soft contact shadow, plain flat light-grey (#d9d9d9) background,
no scenery, no text, no watermark, no logo. Square 1:1 image, crisp high-detail
materials.
```

### Rome — Equites (`equites`, replaces Horseman)
```
An elite Roman Equites heavy cavalryman astride an armored warhorse: lorica hamata
chainmail, a spatha cavalry sword raised overhead, a small round cavalry shield, a
plumed bronze helmet, a flowing red cloak.
```
*(+ unit tail)*

### Rome — Centurion (`centurion`, unique)
```
A Roman Centurion commander: ornate lorica segmentata armor more gilded and
detailed than a regular legionary's, a signature transverse horsehair-crest helmet
(crest running side-to-side, not front-to-back), a vine-wood swagger stick in one
hand and a gladius drawn in the other, a commanding confident stance.
```
*(+ unit tail)*

### China — Keshik (`keshik`, replaces Horseman)
```
A mounted Chinese Keshik horse-archer: black-and-red lacquered leather lamellar
armor, a fur-trimmed cap, a recurve composite bow held ready, riding a sturdy
steppe horse at a canter.
```
*(+ unit tail)*

### China — Chu Ko Nu (`chukonu`, unique)
```
A Chinese Chu Ko Nu infantryman holding an iconic boxy repeating crossbow with a
top-mounted bolt magazine, light lacquered armor, a calm focused aiming stance with
bolts visibly mid-load for visual interest.
```
*(+ unit tail)*

### India — Ashvaroha (`ashva`, replaces Horseman)
```
An Indian Ashvaroha cavalry rider: gilded brass scale armor over saffron silk, a
curved talwar sword raised, an ornate cloth horse caparison in royal blue and gold,
riding at a confident canter.
```
*(+ unit tail)*

### India — Chariot Runner (`chariot`, unique)
```
A light two-wheeled Indian war chariot at a full gallop, pulled by two horses,
carrying a driver and a javelin-throwing warrior, a gilded wood frame with
saffron-and-blue cloth banners, a fast agile silhouette.
```
*(+ unit tail)*

### India — War Elephant (`elephant`, unique)
```
A massive armored Indian war elephant in full battle dress: gilded brass plate
barding across the head and flanks, an ornate howdah platform on its back carrying
a mahout driver and a spear-armed warrior, bronze blades fitted to the tusks, a
powerful imposing stance.
```
*(+ unit tail)*

---

## 3. Naval units (civ-skinned)

### Fishing Boat (`fishboat`)
```
A small single-mast wooden fishing boat with a net draped over one side and woven
fish baskets stacked on deck, a modest civilian vessel, simple sail.
[[CIVILIZATION]]
```
*(+ unit tail — hull trim and sail color per palette)*

### Transport Ship (`transport`)
```
A broad wooden transport galley with an open cargo deck for ferrying troops, a
single mast with a furled sail, a sturdy unarmed hull. [[CIVILIZATION]]
```
*(+ unit tail)*

### War Galley (`galley`)
```
A sleek wooden war galley with a row of oars along the hull, a bronze ram at the
bow, a mounted bolt-thrower on deck, a single mast with a battle sail.
[[CIVILIZATION]]
```
*(+ unit tail)*

### Quinquereme (`quinquereme`)
```
A large multi-deck wooden quinquereme warship with tiered rows of oars, a
reinforced bronze ramming bow, a raised fighting deck carrying a mounted siege
weapon, twin masts. [[CIVILIZATION]]
```
*(+ unit tail)*

### Fire Ship (`fireship`)
```
A small fast wooden fire ship with dramatic but controlled flame and dark smoke
rising from its deck, fire-pots and burning oil barrels lashed to the hull, a
reckless menacing silhouette. [[CIVILIZATION]] (hull trim color only — keep the fire
and smoke regardless of civilization)
```
*(+ unit tail)*

### War Catamaran (`catamaran`)
```
A twin-hulled wooden war catamaran with a light bolt-thrower mounted on the central
deck, twin sails, a fast and narrow profile. [[CIVILIZATION]]
```
*(+ unit tail)*

---

## 4. Wildlife (neutral — no civilization variants)

### Deer (`deer`)
```
A stylized-but-naturalistic forest deer in a calm grazing or alert standing pose, a
brown coat, gentle naturalistic proportions matching a stylized 3D RTS game's
animal art. Isometric dimetric RTS game-art camera elevated about 45°, slight 3/4
rotation, subject centered and filling roughly 75% of the frame height. Render
quality of a modern 3D real-time-strategy game (Age of Empires IV tier) — not flat
illustration, not photorealistic, not pixel art, not anime. Soft three-point studio
lighting, key light upper-left, soft contact shadow, plain flat light-grey (#d9d9d9)
background, no scenery, no text, no watermark, no logo. Square 1:1 image, crisp
high-detail materials.
```

### Wild Boar (`boar`)
```
A stocky wild boar in an aggressive charging stance, dark bristly hide, prominent
tusks, a low powerful build.
```
*(+ unit tail)*

### Wolf (`wolf`)
```
A lean grey wolf in a low prowling stance, bared teeth, alert ears, a naturalistic
predator posture.
```
*(+ unit tail)*

### Sheep (`sheep`)
```
A fluffy white domestic sheep in a calm idle grazing stance, a soft woolly texture,
a harmless farm-animal silhouette.
```
*(+ unit tail)*

---

## 5. Buildings (civ-skinned shared architecture)

### Town Center (`tc`)
```
The civilization's central Town Center — a fortified multi-story headquarters hall
with a small watch balcony and a civilization banner mounted above the entrance, the
architectural heart of a settlement. [[CIVILIZATION]]
```
*(+ building tail)*

### Storehouse (`storehouse`)
```
A simple resource storehouse — a sturdy single-story warehouse with wide double
doors, stacked crates, sacks, and jars visible just inside the entrance, utilitarian
and modest. [[CIVILIZATION]]
```
*(+ building tail)*

### Farm (`farm`)
```
A rectangular farm plot with tilled soil rows of growing crops, a low wooden fence
border, and a small thatched tool shed in one corner, rural and humble.
[[CIVILIZATION]]
```
*(+ building tail)*

### Canal (`canal`)
```
A short stone-lined irrigation canal segment with flowing water and a small wooden
sluice gate, simple and functional. [[CIVILIZATION]]
```
*(+ building tail)*

### Stone Wall (`wall`)
```
A defensive stone wall segment with crenellated battlements along the top, built to
connect seamlessly to identical segments on either side. [[CIVILIZATION]]
```
*(+ building tail)*

### Gate House (`gate`)
```
A fortified gate house section of wall, featuring a heavy double wooden door beneath
a reinforced stone arch and a small battlement platform above. [[CIVILIZATION]]
```
*(+ building tail)*

### Barracks (`barracks`)
```
An infantry barracks — a sturdy training hall with shields and spears displayed on
racks near the entrance, a civilization banner at the roofline, a martial
training-yard feel. [[CIVILIZATION]]
```
*(+ building tail)*

### Stable (`stable`)
```
A cavalry stable — a long low hall with wide horse-stall openings along one side and
hay bales stacked near the entrance. [[CIVILIZATION]]
```
*(+ building tail)*

### Archery Range (`range`)
```
An archery range — an open-sided practice hall with target dummies visible and a
rack of bows and quivers along one wall, a simple covered roof. [[CIVILIZATION]]
```
*(+ building tail)*

### University (`university`)
```
A university research hall — a dignified scholarly building with a small dome or
modest tower, scroll racks or a carved stone tablet visible near the entrance, an
air of learning and prestige. [[CIVILIZATION]]
```
*(+ building tail)*

### Training Grounds (`grounds`)
```
A training grounds — an open courtyard structure with wooden practice posts and a
small reviewing platform, banners marking a martial drilling yard. [[CIVILIZATION]]
```
*(+ building tail)*

### Watchtower (`tower`)
```
A tall slender watchtower with a small crenellated platform at the top for archers
and narrow arrow-slit windows along the shaft. [[CIVILIZATION]]
```
*(+ building tail)*

### Wall Tower / Keep (`keep`)
```
A massive fortified tower built into a wall line — thick stone walls, multiple
levels of arrow-slits, and a strong crenellated top platform, imposing and
defensive. [[CIVILIZATION]]
```
*(+ building tail)*

### Dock (`dock`)
```
A wooden dock extending over open water on sturdy pilings, a small boathouse at the
land end, mooring posts and coiled rope on the loading platform. [[CIVILIZATION]]
```
*(+ building tail)*

### Castle (`castle`)
```
A grand Age-IV castle fortress — a large multi-towered stronghold with thick high
walls, a strong gatehouse, and several corner towers, the single most imposing
fortified building in the civilization's roster. [[CIVILIZATION]]
```
*(+ building tail)*

---

## 6. Neutral capturable settlement

### Hill Town (`town`)
```
A neutral, capturable hilltop hamlet settlement: a small cluster of modest
stone-and-thatch buildings behind a low perimeter wall, no civilization banners
flying, generic ancient fusion architecture that could plausibly belong to any local
culture, situated on a rocky mountain plateau. Isometric dimetric RTS game-art
camera elevated about 45°, viewing the front-left corner so two walls and the
roofline are clearly visible, structure centered and filling roughly 80% of the
frame height, sitting on a small ground patch matching only its own footprint.
Render quality of a modern 3D real-time-strategy game (Age of Empires IV tier) —
not flat illustration, not photorealistic, not blocky voxel art. Soft three-point
studio lighting, key light upper-left, soft contact shadow, plain flat light-grey
(#d9d9d9) backdrop, no surrounding scenery, no text, no watermark, no logo. Clean,
elegant, restrained ornamentation. Square 1:1 image.
```

---

## 7. Wonders (already civ-locked — full prompts)

### Rome — Colosseum (`wonder`)
```
The Roman Wonder, modeled on the Colosseum: a grand monumental amphitheater with
tiered rings of stone arches stacked across multiple levels, a full oval structure,
ornamental statues set in the upper-tier arches, warm sand-colored travertine
stone, an awe-inspiring scale befitting a civilization's greatest monument.
```
*(+ building tail)*

### China — Temple of Heaven (`wonder`)
```
The Chinese Wonder, modeled on the Temple of Heaven: a grand round temple with
three circular tiers of deep-blue conical tiled roofs stacked progressively
smaller, vivid vermillion-red timber pillars encircling each tier, set on a round
white marble terrace, a serene and majestic scale.
```
*(+ building tail)*

### India — Taj Mahal (`wonder`)
```
The Indian Wonder, modeled on the Taj Mahal: a grand domed mausoleum-palace with a
large central white marble dome flanked by four slender corner minarets, a
symmetrical façade with tall arched iwan entrances, delicate inlaid stone filigree
kept elegant rather than overdone, a serene white-marble grandeur.
```
*(+ building tail)*

---

## Coverage tally

- Universal land units: 9 templates × 3 civs = 27, + Swordsman × 2 civs = 2 → **29**
- Unique civ units: **8** (full prompts)
- Naval units: 6 templates × 3 civs → **18**
- Wildlife: **4** (neutral)
- Buildings: 15 templates × 3 civs → **45**
- Neutral settlement: **1**
- Wonders: **3** (full prompts)

**Total finished assets once all civ swaps are done: 108.**
