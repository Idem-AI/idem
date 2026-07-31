---
name: forms-inputs
description: Form layout, validation timing, error recovery and input types that behave correctly on mobile keyboards.
tier: contextual
priority: 45
triggers: [form, input, validation, field, contact form, survey, wizard, multi-step, upload, formulaire, checkout form, settings]
---

# Forms

## Layout

One column. Multi-column forms cause tab-order confusion and break on mobile. The exception is genuinely paired fields (city and postcode, first and last name) on wide screens only.

Labels above inputs, always visible. A placeholder is not a label: it disappears the moment typing starts, and it fails for screen readers.

Group related fields with `<fieldset>` and a `<legend>`. Optional fields are marked "(optional)"; do not mark required ones with an asterisk and hope.

## Input types

The right `type` gives mobile users the right keyboard, which matters far more than it looks:

- `type="email"` `inputMode="email"` `autoComplete="email"`
- `type="tel"` `inputMode="tel"` — and for this audience, accept `+237 6 71 23 45 67` shaped input, not a US-only mask
- `type="number"` only for genuine quantities; use `inputMode="decimal"` for money
- `autoComplete` on every field a browser could fill: `name`, `street-address`, `postal-code`, `cc-number`, `one-time-code`

## Validation

- Validate on **blur**, not on every keystroke. Validating as someone types tells them their email is invalid while they are typing it.
- Re-validate on change once a field has already errored, so the error clears as it is fixed.
- Requirements are stated before submission, never revealed only in the error.
- Errors sit next to the field, in words, saying how to fix it: "Password needs at least 8 characters" beats "Invalid password".
- Tie the message with `aria-describedby` and mark the field `aria-invalid`.
- On submit failure, move focus to the first field in error.

## Submission

The submit button enters a loading state and is disabled during the request, so a double tap does not create two records. Never disable submit until the form is valid: the user is left with a dead button and no explanation.

On success, say what happened and what is next. On failure, keep every entered value. Losing a filled form to a network error is the worst thing a form can do.

## Long forms

Past roughly ten fields, split into steps with a visible progress indicator and a per-step summary. Never lose entered data when moving back a step.

Uploads show the file name, size and a progress bar, allow removal, and state accepted formats and the size limit before selection.
