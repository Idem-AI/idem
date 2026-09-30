# Social network mockup library

The "Social media banners" and "Social posts" pages of the brand charter show the brand **inside the real interface of each network**. Those interfaces are **HTML/CSS** templates versioned here: no base image, no image model. The code drops in what belongs to the project (logo, banner, name, promise, visuals), then Chrome takes a screenshot.

## Why HTML and not images

An image mockup forces you to place the logo and text pixel by pixel, on top of demo content that must be erased first. In HTML, every brand element is a named slot: you fill it and the layout follows (a long name is truncated cleanly, a banner keeps its ratio), and a template can be edited in a text editor.

The HTML clones found online ("instagram clone" GitHub repositories, CodePen card templates) only covered Instagram and generic cards, with dated interfaces and dependencies (Bootstrap, Font Awesome). The templates were therefore drawn for IDEM from each network's public interface.

## Templates

| File | Network | Type | Size (px) | Brand slot |
|---|---|---|---|---|
| `facebook-page.html` | Facebook | page | 1200 × 760 | cover 940 × 348 |
| `linkedin-page.html` | LinkedIn | company page | 1200 × 660 | cover 748 × 128 |
| `x-profile.html` | X | profile | 1200 × 640 | header 598 × 200 |
| `youtube-channel.html` | YouTube | channel | 1200 × 720 | banner 1040 × 172, thumbnail 424 × 238 |
| `instagram-profile.html` | Instagram | profile | 1200 × 720 | 6 grid tiles |
| `instagram-post.html` | Instagram | post | 400 × 654 | visual 400 × 500 (4:5) |
| `linkedin-post.html` | LinkedIn | post | 400 × 566 | visual 400 × 400 (1:1) |
| `facebook-post.html` | Facebook | post | 400 × 564 | visual 400 × 400 (1:1) |
| `x-post.html` | X | post | 440 × 319 | visual 362 × 190 (1.9:1) |

Sizes and formats are declared in `manifest.json`; they must stay identical to the template's CSS. Post visuals have exactly the ratio of the visual generator's formats (`post` 1200 × 1500, `square` 1080 × 1080, `banner` 1200 × 630): they are never cropped.

## Placeholders

`{{key}}` receives **escaped** text. `{{{key}}}` receives **HTML produced by the code**, never by a model.

| Placeholder | Content |
|---|---|
| `{{brandName}}` | brand name |
| `{{handle}}` | account handle, without `@` |
| `{{category}}` | sector, two or three words |
| `{{bio}}` | short description / promise |
| `{{postText}}` | post text |
| `{{caption}}`, `{{hashtags}}` | caption and hashtags (Instagram, X) |
| `{{title}}` | featured video title (YouTube) |
| `{{avatarSrc}}`, `{{avatarGround}}` | avatar logo and its contrasting background |
| `{{mediaSrc}}` | post visual (data URI or URL) |
| `{{{coverHtml}}}` | banner composed at the slot size |
| `{{{mediaHtml}}}` | composed thumbnail (YouTube) |
| `{{{tiles}}}` | grid tiles (Instagram) |
| `{{{fontLinks}}}` | Google Fonts links for the brand typefaces |

## Adding a network

1. Create `templates/<id>.html`: a complete document, `body` at the final size, interface fonts loaded from Google Fonts, no local resource.
2. Declare the entry in `manifest.json` (`kind`, size, `cover` / `media`).
3. Run `npm run check:mockups`: each template is rendered with a test brand, and the check fails if a placeholder has no value or if content overflows the page.
