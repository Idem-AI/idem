# @idem/shared-document-editor

The WYSIWYG editor shared by the **IDEM dashboard** (business plan, pitch deck, brand book,
business card, legal documents, Communication visuals) and **iVision** (visuals made in the chat).
One engine: a feature added here ships in both products.

## Two components

| Component | Role |
| --- | --- |
| `<idem-document-preview>` | The document rendered in the editor's own iframe (pixel-identical to the PNG/PDF). Hovering frames an element; clicking opens an **Edit** menu. Emits `editRequested` with `{ sectionId, path }`. |
| `<idem-document-editor>` | The full editor: canvas, toolbar, layers, properties, attributes, charts, AI edit, undo/redo, autosave. |

Neither calls a server nor knows a route. The host provides a `DocumentTypeAdapter`
(`load`, `save`, and optionally `aiEdit` — without it the AI panel is hidden) and handles
navigation:

```html
<idem-document-preview
  [html]="html()" [section]="{ id: visual.id, type: 'flyer-square' }"
  [pageFormat]="{ width: '1080px', height: '1080px' }" [fonts]="fonts()"
  (editRequested)="openEditor($event)" />

<idem-document-editor
  [adapter]="adapter" [contextId]="projectOrBrandId" [documentId]="docId"
  [target]="{ sectionId, path }" [heading]="title"
  (exit)="goBack()" />
```

- **IDEM**: adapters in `apps/main-dashboard/.../document-editor/adapters`, the page
  `document-editor.ts` resolves the adapter from the route and the project from the cookie.
- **iVision**: `apps/ivision/web/.../visual-edit` (adapter on `GET/PUT /v1/visuals/:id`; the API
  strips scripts and re-renders the PNG after every save). No AI edit: visuals are never
  rewritten by a model (poster engine rule).

## Texts

UI texts live in `src/angular/i18n/editor.i18n.ts` (fr, en), read by the `idemEditorT` pipe in
the host's current language (ngx-translate). Add a text there once — not in each app.

## Wiring

`tsconfig.json`:

```json
"@idem/shared-document-editor": ["<root>/packages/shared-document-editor/src"],
"@idem/shared-document-editor/*": ["<root>/packages/shared-document-editor/src/*"]
```

Global stylesheet (Tailwind v4 must scan the templates):

```css
@source '<relative path>/packages/shared-document-editor/src';
```
