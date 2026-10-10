# @idem/shared-video-editor

The motion-video editor shared by **iVision** (`apps/ivision/web`) and the **IDEM dashboard**
(Communication module): the live preview (the very engine that renders the MP4, played in the
browser) next to every on-screen text of the video. Clicking a text jumps the preview to the
moment it is on screen; every keystroke redraws it immediately.

## How it works

The preview page (`GET …/videos/:id/preview` → `html`) is played in a sandboxed iframe
(`srcdoc`, `sandbox="allow-scripts"`). The engine (`apps/ivision/core/engine/src/index.tsx`,
`setupEditBridge`) accepts messages from its direct parent only:

| Editor → preview | Effect |
| --- | --- |
| `{ type: 'ivision:edit', key, slots?, image?, images?, focus? }` | Redraws the scene with new texts / photo, then shows it |
| `{ type: 'ivision:focus', key }` | Jumps to the moment the scene's texts are fully on screen |
| `{ type: 'ivision:seek', t }`, `ivision:play`, `ivision:pause` | Playback |

| Preview → editor | Content |
| --- | --- |
| `ivision:ready` | duration, scenes (`key`, `start`, `end`, `moment`) |
| `ivision:time` | current time, playing |

The component never calls a server. It emits `edit` (pending text edits, after a typing pause)
and `replaceImage` (a scene whose photo the user wants to change). The host saves through its own
API (IDEM: `PATCH /project/communication/:projectId/videos/:id`; iVision:
`PATCH /v1/brands/:brandId/videos/:id`, both with `{ slots }` or `{ images }`) and, when the
saved storyboard's timing changed (reading time), reloads the preview.

## Usage (Angular)

```ts
import { IdemVideoEditorComponent } from '@idem/shared-video-editor/angular';
```

```html
<idem-video-editor
  [html]="previewHtml()"
  [scenes]="video().storyboard.scenes"
  [slotDefs]="options().scenes"
  [ratio]="9 / 16"
  lang="fr"
  (edit)="saveTexts($event)"
  (replaceImage)="pickPhoto($event.key)" />
```

After uploading a new photo, call `editor.previewImage(key, url)` to show it at once.

Add the path to the app's `tsconfig.json`:

```json
"@idem/shared-video-editor": ["../../packages/shared-video-editor/src"],
"@idem/shared-video-editor/*": ["../../packages/shared-video-editor/src/*"]
```
