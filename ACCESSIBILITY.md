# Accessibility

IDEM is designed for African entrepreneurs — people who may be starting a
business for the first time, working from a modest phone or computer, with a
slow connection, and who may not be technical. We believe every one of them
deserves a clear, usable experience, regardless of disability, assistive
technology, language, or device. This document describes how IDEM approaches
accessibility, what we ask of contributors, and how to report a barrier.

---

## Priorities

Our goal is to meet **WCAG 2.1 Level AA** across all IDEM applications. This
is an ongoing aspiration, not a verified conformance claim. We evaluate
conformance by application as each one reaches a stable release.

The areas we focus on most actively:

| Area | How |
|---|---|
| **Colour contrast** | All text and interactive controls are checked in both light and dark themes against the 4.5 : 1 (normal text) and 3 : 1 (large text / UI) ratios. |
| **Keyboard navigation** | Every user journey — from signing in to downloading a finished business plan — is completable without a mouse. Focus styles are always visible. |
| **Screen reader support** | Controls carry ARIA labels and roles. Dynamic content (AI generation progress, error states) announces itself with `aria-live`. |
| **Motion sensitivity** | Every animation has a `prefers-reduced-motion` alternative. No content flashes or moves unexpectedly. |
| **Language and reading level** | The interface is bilingual (French / English). Copy uses short sentences and everyday vocabulary, not technical jargon. |
| **Small screens and slow connections** | All flows work on a phone-sized viewport. Heavy assets are lazy-loaded; the interface remains usable on a slow connection. |

---

## Contributor expectations

All user-facing changes must meet the following before a pull request is merged:

1. **Contrast** — check every new colour combination with a contrast tool (e.g.
   [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/))
   against the design-system tokens defined in `packages/shared-styles/styles.css`.
   Do not introduce raw hex values or Tailwind colour utilities; use the project
   tokens so that both themes are covered automatically.

2. **Keyboard** — tab through the changed UI manually and confirm that:
   - focus order matches the visual reading order,
   - every interactive element is reachable and activatable with the keyboard,
   - focus is never lost (e.g. after a modal closes, focus returns to the
     trigger).

3. **ARIA** — interactive elements that do not use native HTML semantics must
   carry explicit `role`, `aria-label` (or `aria-labelledby`), and state
   attributes (`aria-expanded`, `aria-disabled`, …). Prefer native elements
   (`<button>`, `<input type="…">`, `<select>`) over custom widgets wherever
   possible.

4. **Motion** — any CSS animation or transition must be wrapped in a
   `prefers-reduced-motion` media query that either removes the animation or
   replaces it with a simple opacity change.

5. **Loader** — use the shared `<idem-loader>` component for all loading states.
   Do not introduce local spinners. The loader already includes the correct
   `aria-label` and `role="status"`.

6. **Evidence in the PR** — include a short note (one or two sentences) in the
   pull-request description confirming the above checks were done. A screenshot
   showing visible focus is welcome but not required.

The CI pipeline runs ESLint with `eslint-plugin-jsx-a11y` (AppGen / React) and
Angular's `@angular-eslint` rules (all Angular apps). A linting failure blocks
the merge.

---

## Reporting accessibility issues

If something in IDEM prevents you from completing a task, please tell us. You do
not need to identify yourself as a person with a disability to report a barrier.

**Open an issue on GitHub** and use the label `accessibility`. Include as much of
the following as is useful:

- The task you were trying to complete (e.g. "download my business plan")
- The page or URL where the barrier occurred
- What happened, and what you expected to happen instead
- Your browser and version (e.g. Chrome 127)
- Your operating system (e.g. macOS 14, Android 14)
- Any assistive technology you were using (e.g. NVDA, VoiceOver, Switch Access)

Screenshots or screen recordings are welcome but never required.

If you need help that cannot wait for a public issue to be resolved, write to the
maintainers directly at the address listed in the GitHub profile.

---

### Severity

We use four severity levels. Maintainers assign or confirm severity during
triage; you do not need to guess.

| Level | Definition | Example |
|---|---|---|
| **Critical** | The user cannot complete the task by any means. | A modal closes but focus disappears — keyboard users cannot continue. |
| **High** | The user can complete the task but only with significant extra effort or by finding a workaround. | A dropdown is not reachable by keyboard; the user must use a mouse. |
| **Medium** | The task is completable but the experience is noticeably degraded. | A button label says "Click here" with no additional context for screen-reader users. |
| **Low** | Minor friction that does not meaningfully block access. | An icon has a generic `title` attribute instead of a descriptive one. |

---

### How we respond

After you open an accessibility issue you can expect:

1. **Acknowledgement within 5 business days** — a maintainer will confirm that
   the issue has been received and assign a severity level.
2. **Status updates** — if investigation takes more than a week we will post an
   update on the issue.
3. **Workaround first** — whenever a quick workaround exists (e.g. a keyboard
   shortcut, an alternative page, an export option) we will document it on the
   issue before the fix lands.
4. **Resolution targets** (aspirational):
   - Critical: fix targeted within 2 weeks
   - High: fix targeted within 4 weeks
   - Medium / Low: addressed in the next planned accessibility review
5. **Verification** — when a fix is ready, we will invite the original reporter
   to verify it if they wish to.

---

## Ownership and maintenance

The **core maintainer team** (listed in the GitHub repository) is collectively
responsible for accessibility. In practice:

- Any maintainer reviewing a pull request is responsible for checking
  accessibility impact.
- Accessibility issues are triaged weekly alongside other bug reports.
- When a maintainer leaves the project, ownership of their open accessibility
  issues is transferred to another maintainer before their departure.

We conduct a broader review of accessibility at each major release. The scope,
method, date, and result of each review will be documented in this file.

---

## Supported environments

The following combinations have been tested or are actively maintained. Partial
support means the experience works but may have minor rough edges.

### Browsers

| Browser | Version | Support |
|---|---|---|
| Chrome / Chromium | Latest stable | Full |
| Firefox | Latest stable | Full |
| Safari | Latest stable (macOS & iOS) | Full |
| Edge | Latest stable | Full |
| Chrome for Android | Latest stable | Full |

### Assistive technologies

| Technology | Platform | Status |
|---|---|---|
| VoiceOver | macOS / iOS | Tested |
| NVDA | Windows | Tested |
| TalkBack | Android | Partial (tested on key flows) |
| Keyboard-only navigation | All | Full |
| Switch Access | Android | Not yet evaluated |

### Input methods

- Mouse / trackpad
- Keyboard (tested on QWERTY FR and EN layouts)
- Touch (phone and tablet)

Combinations not listed above have not been evaluated. If you use an
assistive technology not on this list and encounter a barrier, please report it
— your feedback helps us expand coverage.

---

## Known limitations

The following barriers are known and tracked. Workarounds are described where
they exist.

| Area | Description | Workaround | Tracked issue |
|---|---|---|---|
| Chart editor | The Mermaid diagram editor (`apps/chart`) is not yet keyboard-navigable. | Download the generated diagram instead of editing it interactively. | #chart-a11y |
| Generated documents | PDF and DOCX exports are not tagged for screen readers. | The text content is available in plain text inside the IDEM console before export. | #pdf-a11y |
| Video previews | AppGen's live preview iframe does not yet expose ARIA landmarks. | The generated code can be downloaded and reviewed directly. | #appgen-a11y |

If no issue number appears, the limitation has been noted but not yet filed as a
formal issue. Please open one if it affects you.

---

## Feedback and improvements

Suggestions to improve this statement or our accessibility practices are welcome.
Open an issue with the label `accessibility` and the sub-label `meta` (or just
mention it in your issue).

Concrete barriers — things that prevent you from using IDEM — should go through
the [reporting process](#reporting-accessibility-issues) above so they are
triaged properly.

We review this document at each major release and update it to reflect the
current state of the project.
