---
name: ecommerce
description: Catalogue, product page, cart and checkout patterns, including mobile money payment rails.
tier: contextual
priority: 50
triggers: [ecommerce, e-commerce, shop, store, cart, checkout, product, catalog, catalogue, payment, order, marketplace, boutique, panier, commande, vente]
---

# Commerce surfaces

## Catalogue

Product cards carry image, name, price and one differentiator. Nothing else. Price is never truncated or hidden behind a hover.

Filters live in a sidebar on desktop and a bottom sheet on mobile. Applied filters show as removable chips above the results with a total count. Filtering never resets the scroll position.

Grid: `repeat(auto-fill, minmax(240px, 1fr))` rather than fixed breakpoint column counts.

## Product page

Gallery with a real main image and thumbnails, each with descriptive alt text. Price, availability and the add-to-cart action stay reachable without scrolling back up: on mobile that means a sticky bottom bar.

Variant selection (size, colour, quantity) happens before add-to-cart, and unavailable combinations are visibly disabled with the reason given, not silently missing.

## Cart and checkout

- The cart shows line items, quantities editable inline, subtotal, delivery and total. Every price change is immediately visible.
- Checkout is one page or clearly numbered steps with a visible progress state. Never a mystery wizard.
- Never require an account to buy. Guest checkout first, account creation offered after the order.
- Ask only for what is needed to fulfil the order.

## Payment

For this audience, mobile money is a primary rail, not an afterthought. Offer MTN MoMo, Orange Money, M-Pesa and Wave alongside cards, with each option's logo and the phone-number field the flow actually needs. Card-only checkout is a design error here.

Show the currency explicitly (XAF, XOF, NGN, KES, GHS). Format amounts the way they are written locally.

## Trust

Delivery time and cost stated before checkout, not after. Return policy linked from the product page. Real contact details in the footer. No countdown timers, no "12 people are viewing this", no invented scarcity.
