---
name: auth-flows
description: Sign-in, sign-up, password reset and session states - the flows users hit first and judge fastest.
tier: contextual
priority: 45
triggers: [auth, authentication, login, signin, sign in, signup, sign up, register, password, account, onboarding, session, authorization, roles, permissions]
---

# Authentication flows

The first surface a user meets. It is also where generated apps are laziest: a centred card on a gradient, floating in the middle of nothing.

## Layout

Not a centred card on a gradient. Pick a structure that belongs to the design system: a split screen where one side carries real product content or photography, a page anchored to the top with generous space below, or a form set within the actual application shell.

## Sign in

- Email and password, labels visible above the fields, correct `autocomplete` attributes (`email`, `current-password`).
- A show/hide password toggle with an accessible name.
- "Forgot password" adjacent to the password field, not buried in the footer.
- Submit button in a loading state during the request, disabled to prevent double submission.
- Errors are generic on purpose: "Email or password is incorrect", never "No account with that email" — that enumerates accounts.

## Sign up

- Ask only for what is needed to create the account. Everything else belongs in onboarding.
- Password requirements shown **before** submission, with live validation as the field is filled. Never reveal them only in an error.
- `autocomplete="new-password"`.
- Terms acceptance is an explicit checkbox with real links, never pre-checked.

## Password reset

Always confirm with the same message whether or not the address exists. Reset links expire, and the page says so. The new-password screen confirms success and routes to sign-in or straight into the session.

## Session and roles

- Protected routes redirect to sign-in and return the user to where they were going once authenticated.
- Loading a protected route shows a skeleton, never a flash of the sign-in page.
- Where roles exist, unavailable actions are hidden or disabled with a reason, never present and failing on click.
- Sign out is reachable in two clicks from anywhere.

## First run

A new account lands on something. Never an empty dashboard with no explanation: state what to do first and give the control that does it.
