/**
 * `service-templates.json`'s own `logo` field is a path relative to the
 * legacy app's `public/` dir (e.g. `svgs/activepieces.png`) — the same
 * images, vendored under `public/assets/svgs/` here, so this only has to
 * add the `assets/` prefix. A handful of templates reference a file that
 * was never shipped (confirmed: 3 of 278) — callers fall back to a generic
 * icon on the image's own `error` event rather than pretend a broken path
 * is fine.
 */
export function serviceLogoUrl(logo: string | null | undefined): string | null {
  if (!logo) return null;
  return `assets/${logo}`;
}

/** A curated screenshot's path (already `<template-name>/<file>`, see `getTemplateSummary`) → its served URL. */
export function serviceScreenshotUrl(screenshot: string): string {
  return `assets/service-screenshots/${screenshot}`;
}
