# Vilevile

IDEM's brand typeface. It is [Jura](https://github.com/ossobuffo/jura) — SIL OFL 1.1 — altered in five ways, self-hosted, and exposed in CSS as `Vilevile`. It also carries the product's icons.

The served typeface lives in `packages/shared-styles/fonts/`; this folder only holds the factory.

**`packages/shared-styles/fonts/` — the typeface**

| File | Role |
| --- | --- |
| `fonts.css` | The `@font-face` rules, **generated**. Imported by `../styles.css`. |
| `icons.css` | The `.pi-*` classes, **generated**. Imported by `../styles.css`. |
| `vilevile-latin.woff2` | 31 KB — loaded by default (French, English) |
| `vilevile-latin-ext.woff2` | 34 KB — loaded only when the page contains extended Latin, an African letter or Greek |
| `vilevile-icons.woff2` | 38 KB — loaded only when the page shows an icon |
| `vilevile-var.ttf` | 155 KB — **not** served to browsers: design tools (Figma, Illustrator), system installation |
| `OFL.txt` | The licence. It must travel with the `.woff2` files. |

**`packages/shared-styles/tools/font/` — the factory**

| File | Role |
| --- | --- |
| `build-fonts.py` | The build. The three tuning knobs are at the top of the file. |
| `african.py` | Builds the African letters |
| `icons.py` | Merges the PrimeIcons glyphs |
| `restyle.py` | Redraws the icons in IDEM's hand |
| `motifs.py` | The motif library that set the direction — **not wired in** |
| `specimen.py` | The check: a proof set with HarfBuzz, plus impact measurements |
| `src/Jura[wght].ttf` | The upstream source, as published by Google Fonts |

## What changes compared to Jura

### 1. The weight axis goes up to 900

Jura stops at 700. The code already asked for `font-black` in 64 places and `font-extrabold` in 9: the browser could only answer with synthetic bold. There is now a real Black.

Jura is a two-master variable font (300 and 700) whose `gvar` tuples all sit on a single region, `(start=0, peak=1, end=1)`. Multiplying its deltas by `K` therefore extends, exactly, the line that joins Light to Bold — not an approximation, the same geometric construction pushed further.

The ceiling was measured, not eyeballed: beyond a design equivalent to "Jura 1100", the ring of `å` closes and `œ`, `æ`, `‰` clog. At 1000, the smallest counter of the Black keeps 23 % of the area it has in the original Bold, and none is closed. `python3 specimen.py` shows this check again.

### 2. The whole scale is shifted towards bold

Jura is a light face: its 400 is thin and its 700 barely weighs a semi-bold. The axis is therefore **cut at the bottom** — everything thinner than `DESIGN_FLOOR` disappears — then relabelled 300..900. Each weight requested by CSS gets a clearly heavier design, while the scale stays affine (no step, no `avar` table needed):

| CSS asks for | Jura draws | Stem, ‰ of the em |
| --- | --- | --- |
| 300 Light | 450 | 58 |
| 400 Regular | 542 | 68 |
| 500 Medium | 633 | 77 |
| 600 SemiBold | 725 | 87 |
| 700 Bold | 817 | 97 |
| 800 ExtraBold | 908 | 107 |
| 900 Black | 1000 | 116 |

`DESIGN_FLOOR` is **the** weight knob: raising it thickens the whole set at once.

### 3. The tracking is in the font

It used to be set by `* { letter-spacing: -0.07em }` in `styles.css`. It is now -0.09 em and it is subtracted from the advance widths (`hmtx`), exactly as `letter-spacing` does — space is removed *after* the glyph, without moving it, which avoids touching the offsets of composites (`é`, `à`…). It also applies to the word space, just like the CSS rule did.

**Nothing in the product sets tracking any more** — no `letter-spacing` rule, no Tailwind `tracking-*` utility. Text gets it from the font, everywhere. Setting one again would **add** to the tracking in the advances instead of replacing it.

The only exceptions are outside Vilevile's scope: SVG logos, where tracking is part of the brand drawing; e-mails, set in a system font; and the document engine of `apps/api`, which sets text in EACH project's own typeface.

Pleasant side effect: ligature-based icon fonts are no longer squeezed by the universal selector.

### 4. It carries the icons

An icon font is a font like any other: drawings stored in Unicode's private use area. Nothing required loading a second one. The 314 drawings of **PrimeIcons 7** are therefore in Vilevile, at their original code points.

The product has a single family. `font-family: 'Vilevile'` draws the text AND the icons; there is no separate `@font-face`, no `primeicons.woff2` to serve, no `!important` rule to force the family back in components. An icon inherits the colour and size of its text like any character.

**And they are redrawn in our hand.** The West African graphic vocabulary — adinkra stamps, bogolan, nsibidi — does not draw with a thin line: it lays down masses. PrimeIcons is the opposite, a 1.5-unit stroke on a 24-unit box. `restyle.py` therefore applies a **morphological dilation by a disc** to each icon: exactly the stamp's tool, the die that bites the paper slightly beyond its edge. The stroke thickens, sharp corners round off, topology stays intact.

What changes is the HAND, not the word: a bin stays a bin. Reading an icon is a convention, and breaking it would make the product unusable.

**Measurement protects the structure.** Growing closes small counters and welds neighbouring parts — three ellipsis dots would become a bar. For each icon, growth starts at `GROW_PX` and steps down while the dilation changes the number of ink blobs or holes. Fifty-two icons were served thinner this way, and the build log names them.

**Existing code does not change.** `icons.css` reproduces PrimeIcons' classes as they are — only the family changes — so `<i class="pi pi-user"></i>` works unchanged, `.pi-fw` and `.pi-spin` included.

**Brand logos are not touched.** GitHub, PayPal, Microsoft, TikTok and the twenty others are trademarks: their drawing is not ours, and every brand guideline forbids altering it. The list is explicit in `restyle.py`. They therefore look thinner than the rest of the set — that is the price, and it is fair.

The icons ship in their own `unicode-range` slice. A page that shows none downloads nothing more than before.

**What it does not do:** icon thickness does not follow the weight axis. PrimeIcons' sources are filled outlines — the stroke is already vectorised, there is no `stroke-width` to vary. An icon therefore keeps its thickness next to text set in Black. That is a limit of the icon set, not of the font.

### 5. It can write Cameroonian languages

This is the "African typography" part, and the only one that removes and moves nothing: it only adds characters.

Of the nineteen letters of the **General Alphabet of Cameroonian Languages** (AGLC), Jura lacked fourteen. A text in Ewondo, Duala, Fulfulde or Bamileke came out full of empty boxes. Vilevile covers the whole AGLC, plus six letters of the African Reference Alphabet:

```
A B Ɓ C D Ɗ E Ɛ Ə F G H I Ɨ J K L M N Ŋ Ɲ O Ɔ P R S T U Ʉ V W Y Z
a b ɓ c d ɗ e ɛ ǝ f g h i ɨ j k l m n ŋ ɲ o ɔ p r s t u ʉ v w y z
                                      plus  ɑ  ɣ  ɵ Ɵ
```

Each letter is **built from Jura's own shapes**, never drawn beside them — that is what keeps it in style and makes it grow with the axis:

- **ɛ, ɣ, ɑ** were already there under another name. Jura's Greek epsilon *is* a Latin open e, its gamma a Latin gamma, its single-storey "a" an alpha. A `cmap` entry is enough: zero glyphs, zero bytes.
- **ɔ Ɔ Ɛ** are mirrors of `c`, `C` and the digit `3`.
- **ɨ Ɨ ʉ Ʉ ɵ Ɵ** are the letter plus the hyphen, cut to length. The hyphen carries the font's horizontal thickness, so the bar thickens with the weight on its own.
- **ɓ Ɓ ɗ Ɗ** are the letter plus a hook — a quarter ring joined to the top of the stem, turned left as in every reference typeface.
- **ɲ Ɲ** are the letter plus a tail: a straight stem below the baseline, exactly as Jura already draws the one of `ŋ`.

The only two drawn pieces — the hook and the tail — are parameterised by the stroke thickness. They are generated twice, at the lightest and at the heaviest, and the difference gives exact `gvar` deltas: they grow with the axis like the rest of the font, with no approximation.

**Tones sit correctly.** Cameroonian languages are tonal; without an anchor, an accent would fall at the foot of the letter. Every built letter receives its donor's anchor, and two glyphs Jura already had without an anchor — `Ə` and `ɣ` — get one on the way. Checked character by character with HarfBuzz: `ɛ́ ɛ̀ ɛ̂ ɛ̌`, `ɔ́ ɔ̀ ɔ̂ ɔ̌`, `ʉ́ ɨ̀ ə̂ ŋ̌` — the twenty-two letters, the four tones.

## Rebuilding

```sh
pip install fonttools brotli
cd packages/shared-styles/tools/font
python3 build-fonts.py            # rewrites the woff2 files, the ttf and fonts.css
pip install uharfbuzz pillow numpy
python3 specimen.py               # proof + impact measurements
```

The knobs are at the top of `build-fonts.py`:

| Knob | Effect | Consequence outside this folder |
| --- | --- | --- |
| `DESIGN_FLOOR` | overall weight | none |
| `GROW_PX` (`icons.py`) | icon thickness | none |
| `DESIGN_CEIL` | weight of the Black | none; capped by measurement |
| `TRACKING_EM` | tracking | none, as long as CSS declares none |

`fonts.css` is generated: do not edit it by hand.

The `chart` application (mermaid-live-editor) does not consume `@idem/shared-styles`: it carries its own copy of the two `.woff2` files in `static/fonts/` and its `@font-face` rules in `src/app.html`. After a rebuild, copy the files there.

## Measured impact on layouts

Heavier means wider, but tracking moved from -0.07 to -0.09 em compensates almost exactly. Compared to the previous rendering (Google's Jura + `letter-spacing: -0.07em`):

| | Light | Regular | Medium | SemiBold | Bold |
| --- | --- | --- | --- | --- | --- |
| text width | +1.4 % | +0.9 % | +0.6 % | +0.2 % | −0.1 % |

In other words: the page does not move. Beyond 700 the comparison is meaningless — there was no design on the other side, only synthetic bold.

## Subset

Kept: full Latin (Ext-A, Ext-B and Ext-Additional included — they carry the African letters), punctuation, currencies (₣, ₦, ₵), mathematical operators and basic Greek. Dropped: Cyrillic, polytonic Greek and Kayah Li: 381 glyphs out of 1115. The ranges are in `KEEP_RANGES`.

The `latin` / `latin-ext` split follows Google Fonts: a page in French or English only downloads `vilevile-latin.woff2`. The African letters are in `latin-ext`, so they cost nothing until they are displayed.

## Licence

Jura is published under the [SIL Open Font License 1.1](../../fonts/OFL.txt), Copyright 2019 The Jura Project Authors, by Daniel Johnson, Alexei Vanyashin and Mirko Velimirovic. No reserved font name is declared in its header; the modified version nevertheless carries a distinct name, and the modifications are recorded in the font's own copyright notice.

The OFL is viral: Vilevile stays under OFL 1.1, `OFL.txt` must travel with the `.woff2` files, and it cannot be sold on its own.
