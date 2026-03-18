# Cart Upsell Recommendations — Avex Technical Test

**Task 1: Cart Upsell** — Dynamic product recommendations in the cart using the Shopify Recommendations API.

## Live Preview

- **Store:** [cautiva-bsas.myshopify.com](https://cautiva-bsas.myshopify.com)
- **Theme:** Dawn 15.4.1 (with Cart Upsell section)

## What Was Built

A custom cart section that shows product recommendations based on the first item in the cart. Recommendations update automatically when the cart changes.

### Features

- Fetches recommendations from the **Shopify Recommendations API** (`/recommendations/products.json`)
- **Auto-updates** when cart items change (add, remove, quantity change)
- **Excludes** products already in the cart
- **Add to cart** directly from recommendations — cart and suggestions refresh instantly
- **Responsive** grid: 4 columns on desktop, 2 on mobile
- **Sale prices** shown with compare-at strikethrough
- **Loading spinner** during API fetch
- **Empty state** when no recommendations are available
- **Theme customizer** settings: heading text, heading size, number of products, section padding

### Architecture

Built as a **Web Component** (`<cart-upsell>`) following Dawn's patterns:

- Subscribes to Dawn's `PUB_SUB_EVENTS.cartUpdate` pub/sub system for cart change detection
- Uses `AbortController` to cancel stale fetch requests on rapid cart changes
- Caches recommendations and re-filters from cache when only the exclusion set changes (avoids unnecessary API calls)
- Renders product cards via `document.createElement` — no `innerHTML`
- Uses Dawn's `fetchConfig()` helper and `routes` global for cart API calls

### Files Changed (from stock Dawn 15.4.1)

| File | Type | Description |
|------|------|-------------|
| `sections/cart-upsell-recommendations.liquid` | **New** | Section template with Liquid, schema settings, and data attributes |
| `assets/cart-upsell.js` | **New** | `CartUpsell` Web Component — fetch, render, cart event handling |
| `assets/cart-upsell.css` | **New** | Responsive grid layout using Dawn's CSS custom properties |
| `templates/cart.json` | **Modified** | Added `cart-upsell` section after `cart-footer` |

Everything else is unmodified Dawn 15.4.1.

## How to Test

1. Browse products and **add one to cart**
2. Go to the **cart page** (`/cart`)
3. Below the cart footer, you'll see **"You may also like"** with product recommendations
4. Click **"Add to cart"** on a recommendation — the cart updates and the added product disappears from suggestions
5. **Remove all items** from the cart — the upsell section hides
6. Change quantities or remove items — recommendations refresh automatically

## Theme Customizer Settings

In the Shopify theme editor (`Customize → Cart page → Cart Upsell`):

- **Heading** — default: "You may also like"
- **Heading size** — Small / Medium / Large
- **Products to show** — 2 to 4 (default: 4)
- **Empty state text** — shown when no recommendations available
- **Section padding** — top and bottom (0–100px)

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Web Component over vanilla JS | Follows Dawn's component pattern; clean lifecycle with `connectedCallback`/`disconnectedCallback` |
| Dawn pub/sub over fetch interception | Native integration — same mechanism Dawn's `CartItems` uses |
| AbortController for fetch cancellation | Prevents race conditions when user rapidly changes cart |
| Cached recommendations with client-side filtering | When only the exclusion set changes (not the source product), re-filters from cache instead of re-fetching |
| Separate CSS file over `{% stylesheet %}` | Enables browser caching; loads only on pages using the section |
| `createElement` over `innerHTML` | Follows project code quality standards; safer against XSS |

## Scripts (Development Utilities)

| Script | Purpose |
|--------|---------|
| `scripts/seed-products.mjs` | Seeds store with 8 sample products + 2 collections via Admin GraphQL API |
| `scripts/fix-publish-products.mjs` | Publishes products to Online Store sales channel |
| `scripts/cleanup-duplicates.mjs` | Removes duplicate products from failed seed runs |

Run with: `SHOPIFY_TOKEN=shpat_... node scripts/<script>.mjs`

## No Third-Party Dependencies

- No external apps or recommendation engines
- No npm packages — all vanilla JS
- Only Shopify-native APIs (Recommendations API, Cart AJAX API, Section Rendering)
