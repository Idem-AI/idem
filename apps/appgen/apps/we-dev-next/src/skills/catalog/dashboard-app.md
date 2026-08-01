---
name: dashboard-app
description: Application UI where design serves the product - shell layout, data density, tables, empty states, and the states every async surface needs.
tier: contextual
registers: [product]
priority: 60
triggers: [dashboard, admin, app, workspace, table, crud, panel, analytics, management, backoffice, console, sidebar, kpi, reporting]
---

# Application UI

Design serves the product here. The user came to do something; every pixel either helps or is in the way.

## Shell

A persistent navigation rail or sidebar, a content region that scrolls independently, and a page header carrying the page title plus **one** primary action. Secondary controls live in a toolbar, not scattered across the page.

Navigation shows where you are. The active item is unmistakable, and not by colour alone.

## Density

Application UI is denser than marketing. Use the tight spacing step from the design system, not the section step. Vertical space is expensive: a dashboard where three rows fill the viewport has failed.

Tables over cards for anything with more than three comparable attributes. A card grid of records is almost always the wrong affordance: it wastes space and makes comparison impossible.

## Tables

- Sticky header. Alignment: text left, numbers right, `tabular-nums` on every numeric column.
- Row actions appear on hover on desktop and are always visible on touch.
- Sortable columns state their direction with an icon and `aria-sort`.
- Pagination or virtualised scroll past ~50 rows, with the total count shown.
- On narrow screens the table becomes a list of labelled rows, not a horizontal scroll of an unreadable grid.

## Every async surface has four states

Never ship only the happy path.

1. **Loading** — skeletons matching the real layout's shape, not a centred spinner.
2. **Empty** — say what would be here, why it is not, and offer the action that fixes it. "No invoices yet" plus a "Create invoice" button. Never an empty box.
3. **Error** — what failed, in plain language, and a retry. Never a raw stack trace or "Something went wrong".
4. **Populated.**

## Forms and feedback

Labels above inputs, always visible. Validate on blur, not on every keystroke. Errors sit next to the field that caused them and say how to fix it. Destructive actions confirm, and the confirm button names the action ("Delete project", not "OK").

Every action gives feedback within 100 ms: an optimistic update, a spinner in the button, or a toast.
