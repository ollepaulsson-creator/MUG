# Search Suggestions, Recent Searches & CTA Button

**Date:** 2026-03-18
**Project:** MUG (mug.se) — Shopify Horizon theme

---

## Overview

Three related improvements to the predictive search overlay:

1. A suggestion list above the product grid (popular searches or recent searches)
2. A floating CTA button showing result count
3. A gradient behind the CTA button so it visually lifts above the product grid

---

## 1. Suggestion List

### Empty state — no recent search history

Render 5 hardcoded popular search terms server-side in `snippets/predictive-search-empty-state.liquid`. Each term is a link to `/search?q=<term>&type=product` with a right-aligned label reading **"Kategori"**.

Hardcoded terms:
- Elgitarrer
- Effektpedaler
- Akustiska gitarrer
- Synthar & moduler
- Ljudkort

### Empty state — with recent search history

When `RecentSearches.getSearches()` returns entries, `#resetSearch` in `predictive-search.js` replaces the popular suggestion list with up to 5 recent searches **in memory** (before `morph()` is called). The user never sees the swap — the DOM updates once with the final state. Each recent search link also uses label **"Kategori"**.

### Search state (while typing)

The existing Shopify predictive search already renders text suggestions (collections, pages, brands) above the product grid. No changes needed here.

---

## 2. Recent Searches Storage

A new file `assets/recent-searches.js` exports a `RecentSearches` class, following the same pattern as `RecentlyViewed` in `assets/recently-viewed-products.js`.

```js
class RecentSearches {
  static #STORAGE_KEY = 'recentSearches';
  static #MAX_SEARCHES = 5;

  static addSearch(term)   // prepend, deduplicate, slice to 5, save
  static getSearches()     // read from localStorage
}
```

`addSearch(term)` is called in `predictive-search.js` when the user submits a search (presses Enter or clicks a suggestion link).

The swap from popular → recent searches happens inside `#resetSearch`, in the parsed markup in memory before `morph()` fires — identical timing to the recently viewed product swap.

---

## 3. CTA Button

### Search state

The existing `predictive-search__search-button` in `predictive-search-form__footer` is re-enabled. Shopify already populates it with the query and result count: **"VISA ALLA X RESULTAT"** linking to `/search?q=<query>&type=product`.

### Empty state

A matching button is added to `sections/predictive-search-empty.liquid` with the text **"VISA ALLA PRODUKTER"** linking to `/search?type=product`.

### Positioning

The footer sits outside the scrollable `.predictive-search-form__content` area, so it is never cropped by the modal height. It is positioned at the bottom of the modal via `position: sticky; bottom: 0` (or equivalent within the flex layout).

---

## 4. Gradient

A `::before` pseudo-element on `.predictive-search-form__footer` renders a gradient that fades from transparent at the top to white (`var(--color-background)`) at the bottom. This creates the visual effect of the button floating above the product grid.

---

## Files Changed

| File | Change |
|------|--------|
| `assets/recent-searches.js` | New — `RecentSearches` class |
| `assets/predictive-search.js` | Import `RecentSearches`; call `addSearch` on submit; swap suggestions in `#resetSearch` |
| `snippets/predictive-search-empty-state.liquid` | Add suggestion list block above product grid |
| `sections/predictive-search-empty.liquid` | Add empty-state CTA button |
| `snippets/search-modal.liquid` or `assets/custom.css` | Re-enable and style CTA button + gradient |

---

## Constraints

- No visible flash when swapping popular → recent suggestions (swap happens pre-morph)
- No "clear" button on recent searches
- Popular search terms are hardcoded (not editable in theme customizer)
- Max 5 recent searches stored and displayed
