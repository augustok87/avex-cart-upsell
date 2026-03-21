# Cart Upsell — Avex Technical Test

Custom cart section that recommends products based on the first item in the cart, using the Shopify Recommendations API.

**Store:** [cautiva-bsas.myshopify.com](https://cautiva-bsas.myshopify.com) · **Theme:** Dawn 15.4.1

## Setup

```bash
npm install        # dev tooling only (prettier, eslint)
```

No build step — Shopify serves the assets directly.

## Files

| File | Description |
|------|-------------|
| `sections/cart-upsell-recommendations.liquid` | Section template with schema settings |
| `assets/cart-upsell.js` | `<cart-upsell>` Web Component — fetch, render, event handling |
| `assets/cart-upsell.css` | Responsive grid, loading/empty states |
| `eslint.config.mjs` | ESLint flat config scoped to custom JS |
| `.prettierrc` | Prettier config with Shopify Liquid plugin |
| `package.json` | Dev dependencies and lint/format scripts |
| `.gitignore` | Excludes node_modules, editor/CLI config |

`templates/cart.json` (which wires the section into the cart page) was modified separately on `main`.

## How it works

1. On page load, fetches `/recommendations/products.json` for the first cart item
2. Falls back to `/collections/all/products.json` when recommendations are empty (cold-start stores)
3. Subscribes to `PUB_SUB_EVENTS.cartUpdate` — when the cart changes, either refetches (new source product) or re-filters from cache (same source, different exclusions)
4. Products already in the cart are excluded from the grid
5. "Add to cart" buttons publish cart update events, keeping the whole page in sync

## Key decisions

- **Web Component** — matches Dawn's pattern (`CartItems`, `ProductForm`, etc.) and gives us clean lifecycle hooks
- **Dawn pub/sub over fetch interception** — integrates natively with the theme instead of monkey-patching
- **AbortController** — cancels in-flight requests on rapid cart changes to prevent race conditions
- **Client-side cache** — when only the exclusion set changes, re-filters cached data instead of hitting the API again
- **`createElement` over `innerHTML`** — avoids XSS vectors from product titles/descriptions

## Linting & formatting

```bash
npm run lint           # eslint on JS assets
npm run format         # prettier on all custom files
npm run format:check   # CI-friendly check (no writes)
```

Config: [`.prettierrc`](.prettierrc), [`eslint.config.mjs`](eslint.config.mjs)

## Testing

1. Add a product to cart → go to `/cart`
2. "You may also like" appears with recommendations (cart items excluded)
3. Click "Add to cart" on a recommendation → it leaves the grid, cart updates
4. Remove all items → section hides
5. Change the source product → recommendations refetch

Customizer settings available under **Cart page → Cart Upsell**: heading, product count (2–4), padding.
