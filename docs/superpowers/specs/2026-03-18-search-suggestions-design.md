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

### Liquid structure

In `snippets/predictive-search-empty-state.liquid`, add a suggestion block above the product grid:

```html
<ul id="search-suggestions" class="search-suggestions">
  <li><a href="/search?q=Elgitarrer&type=product">Elgitarrer<span class="search-suggestions__label">Kategori</span></a></li>
  <li><a href="/search?q=Effektpedaler&type=product">Effektpedaler<span class="search-suggestions__label">Kategori</span></a></li>
  <li><a href="/search?q=Akustiska+gitarrer&type=product">Akustiska gitarrer<span class="search-suggestions__label">Kategori</span></a></li>
  <li><a href="/search?q=Synthar+%26+moduler&type=product">Synthar & moduler<span class="search-suggestions__label">Kategori</span></a></li>
  <li><a href="/search?q=Ljudkort&type=product">Ljudkort<span class="search-suggestions__label">Kategori</span></a></li>
</ul>
```

The `id="search-suggestions"` is the selector contract between Liquid and JS.

### Empty state — pre-morph swap in `#resetSearch`

Inside `#resetSearch`, after parsing the empty state markup but **before** calling `morph()`:

1. Call `RecentSearches.getSearches()`
2. **If the array is empty:** leave `#search-suggestions` untouched — the popular suggestions render as-is from Liquid
3. **If entries exist:** query `parsedEmptySectionMarkup.querySelector('#search-suggestions')` and replace its inner HTML with recent-search `<li>` items in the same structure (`/search?q=<term>&type=product`, label "Kategori")

This guarantees one atomic DOM update with no visible swap.

### Labels

All suggestion items (both popular and recent) use the right-aligned label **"Kategori"**. Known trade-off: a user who searched for a product name (e.g. "Gibson Les Paul") will see it labelled "Kategori", which is imprecise. This is accepted — the label describes the destination (a product-type search), and there is no "clear" mechanism to remove inaccurate entries.

### Search state (while typing)

The existing Shopify predictive search already renders text suggestions (collections, pages, brands) above the product grid in `sections/predictive-search.liquid`. No changes needed.

---

## 2. Recent Searches Storage

A new file `assets/recent-searches.js` exports a `RecentSearches` class, following the same pattern as `RecentlyViewed` (including no try/catch around localStorage — matching existing convention):

```js
export class RecentSearches {
  static #STORAGE_KEY = 'recentSearches';
  static #MAX_SEARCHES = 5;

  static addSearch(term) {
    let searches = this.getSearches();
    searches = searches.filter(s => s !== term);
    searches.unshift(term);
    searches = searches.slice(0, this.#MAX_SEARCHES);
    localStorage.setItem(this.#STORAGE_KEY, JSON.stringify(searches));
  }

  static getSearches() {
    return JSON.parse(localStorage.getItem(this.#STORAGE_KEY) || '[]');
  }
}
```

### When `addSearch` is called

`RecentSearches.addSearch(term)` is called at **two** hook points in `predictive-search.js`:

1. **Bare form submit (Enter key, no item selected):** in the form `submit` event handler, using `input.value.trim()` as the term. Only called if the value is non-empty.

2. **Click on a popular/recent suggestion link:** a delegated `click` listener on `#search-suggestions` calls `addSearch` with the link's text content (excluding the label span) before navigation.

`addSearch` is **not** called when the user keyboard-activates a product card (arrow-keys + Enter on a `.predictive-search-results__card--product`). The `onSearchKeyDown` Enter path fires `currentItem.querySelector('a')?.click()` which may land on a product card — this must be guarded: only call `addSearch` if the activated item is a text-suggestion row (has class `predictive-search-results__card--query` or is inside `#search-suggestions`), never for product cards.

---

## 3. Scroll container and footer relationship

The scroll container is `.predictive-search-form__content` (which has `max-height: var(--modal-max-height)` and `overflow-y: auto`). The `.predictive-search-form__footer` is a **sibling** of `.predictive-search-form__content`, not a child — it sits outside the scroll area. This is already the case in `sections/predictive-search.liquid`. The gradient `::before` on the footer overlays the bottom edge of the scrolling product grid correctly because the footer is stacked directly below the scroll container in normal flow.

---

## 4. CTA Button

### Search state

The existing `predictive-search__search-button` in `sections/predictive-search.liquid` requires two fixes:

- Change `<button>` → `<a href="/search?q={{ predictive_search.terms | url_encode }}&type=product">`
- Remove the existing `position: fixed` CSS rule (lines ~403–409 of `sections/predictive-search.liquid` `{% stylesheet %}`) — replace it entirely with the sticky-footer approach below

The label reads **"VISA ALLA X RESULTAT"** where X is `predictive_search.resources.products.size`. Known limitation: this is capped at the API limit (24), not the true total.

### Empty state

Add a footer wrapper and CTA link to `sections/predictive-search-empty.liquid` (the file currently has no `predictive-search-form__footer` — it must be added here):

```html
<div class="predictive-search-form__footer">
  <a href="/search?type=product" class="button button-primary predictive-search__search-button">
    VISA ALLA PRODUKTER
  </a>
</div>
```

This div sits after the `{% render 'predictive-search-empty-state' %}` call, making it a sibling of the scroll container when rendered inside the modal.

### Positioning (both states)

Apply to `.predictive-search-form__footer` in the `{% stylesheet %}` block of `sections/predictive-search.liquid`:

```css
.predictive-search-form__footer {
  position: sticky;
  bottom: 0;
}
```

The existing `position: fixed` rule on `button.button.button-primary.predictive-search__search-button` must be **removed** to avoid a style conflict.

---

## 5. Gradient

A `::before` pseudo-element on `.predictive-search-form__footer` fades from transparent at the top to `var(--color-background)` at the bottom. It is `position: absolute` so it does not add layout height or push the button down. The footer itself needs `position: relative` to contain it. Added in the `{% stylesheet %}` block of `sections/predictive-search.liquid`:

```css
.predictive-search-form__footer {
  position: relative; /* contains the absolute gradient */
}

.predictive-search-form__footer::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  height: 80px;
  background: linear-gradient(to bottom, transparent, var(--color-background));
  pointer-events: none;
}
```

---

## 6. Suggestion List Styles

CSS for the suggestion list lives in the `{% stylesheet %}` block of `sections/predictive-search.liquid`:

```css
.search-suggestions {
  list-style: none;
  margin: 0;
  padding: 0;
  border-bottom: 1px solid var(--color-border);
}

.search-suggestions li {
  border-bottom: 1px solid var(--color-border);
}

.search-suggestions li:last-child {
  border-bottom: none;
}

.search-suggestions a {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  text-decoration: none;
  color: var(--color-foreground);
}

.search-suggestions a:hover {
  text-decoration: underline;
}

.search-suggestions__label {
  font-size: 0.8rem;
  color: rgb(var(--color-foreground-rgb) / 0.5);
  margin-left: auto;
}
```

---

## 7. Keyboard Navigation

Arrow-key navigation does **not** extend to the `#search-suggestions` list in the empty state. The suggestion items are click/tap only. This keeps `#allResultsItems` logic unchanged.

---

## 8. Cleanup

Remove the `[RV debug]` `console.log` statements added to `#resetSearch` during debugging as part of this implementation.

---

## 9. Files Changed

| File | Change |
|------|--------|
| `assets/recent-searches.js` | New — `RecentSearches` class |
| `assets/predictive-search.js` | Import `RecentSearches`; call `addSearch` on form submit and suggestion click; swap suggestions pre-morph in `#resetSearch`; guard `addSearch` from product card activations; remove `[RV debug]` console logs |
| `snippets/predictive-search-empty-state.liquid` | Add `#search-suggestions` block above product grid |
| `sections/predictive-search-empty.liquid` | Add `predictive-search-form__footer` wrapper with CTA link |
| `sections/predictive-search.liquid` | Fix CTA `<button>` → `<a>` tag; remove `position: fixed` rule; add sticky footer, gradient, and suggestion list styles in `{% stylesheet %}` |

---

## Constraints

- No visible flash when swapping popular → recent suggestions (swap happens pre-morph, in memory)
- No "clear" button on recent searches
- Popular search terms are hardcoded in Liquid (not editable in theme customizer)
- Max 5 recent searches stored and displayed
- CTA count uses `predictive_search.resources.products.size` (known limitation: capped at API limit)
- localStorage error handling matches `RecentlyViewed` convention (no try/catch)
- `addSearch` never records product card activations as searches
