# Search Results Page — Collection Layout Design

**Goal:** Make the search results page look and behave like a collection page: same filters, product cards, sorting, and grid layout, with a search bar on top.

**Architecture:** The `sections/search-results.liquid` section already uses the shared `filters` block and `product-grid` snippet — identical to what collection pages use. It is currently disabled in `templates/search.json` in favour of a legacy custom liquid renderer. The fix is to enable it and disable the old renderer.

**Tech Stack:** Shopify Liquid, `templates/search.json` (JSON template), `sections/search-results.liquid`

---

## Page Structure (top to bottom)

1. Breadcrumb — `custom_liquid_MA4tEE` (keep, already enabled)
2. Search bar with SÖK button — `search` section / `search-header` type (keep, already enabled)
3. Result count line — `custom_liquid_TUpVga` "Visar X produkter för sökningen Y" (keep, already enabled)
4. Filters + product grid — `main` section / `search-results` type **(enable this)**

Non-product results (pages, articles) are excluded — `search-results.liquid` already filters `search.results` by `object_type == 'product'`.

---

## Changes

### `templates/search.json`

- **Enable** the `main` section (remove `"disabled": true` from `"main"`)
- **Disable** `custom_liquid_pYjBdr` (the legacy `search-page-result` snippet renderer — add `"disabled": true`)
- **Disable** `custom_liquid_EgnEdD` (legacy custom CSS for the old renderer — add `"disabled": true`)
- **Disable** `custom_liquid_cpxPWn` (already disabled — confirm no change needed)
- Section order stays the same

### `sections/search-results.liquid`

No changes needed. Already uses:
- `{% content_for 'block', type: 'filters' %}` — same filter block as collection pages
- `{% render 'product-grid' %}` — same product grid snippet
- `{% content_for 'block', type: '_product-card' %}` — same product card block
- Filters results to `object_type == 'product'` only
- Paginates at 24 products per page

### No other files change.

---

## Settings (already configured in search.json `main` block)

| Setting | Value |
|---------|-------|
| layout_type | grid |
| product_card_size | extra-large |
| mobile_product_card_size | large |
| product_grid_width | full-width |
| columns_gap_horizontal | 0px |
| columns_gap_vertical | 0px |
| color_scheme | scheme-1 |
| filter_style | horizontal |

These match the collection page configuration and require no changes.
