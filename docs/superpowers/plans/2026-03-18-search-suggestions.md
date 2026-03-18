# Search Suggestions, Recent Searches & CTA Button Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a search suggestion list, recent searches stored in localStorage, and a floating CTA button with gradient to the predictive search overlay.

**Architecture:** Five focused file changes. A new `RecentSearches` class mirrors the existing `RecentlyViewed` pattern. Suggestions are rendered server-side in Liquid; JS swaps popular → recent in memory before `morph()` fires so there is no visible update. The CTA footer already exists in the search-results section and is extended to the empty-state section.

**Tech Stack:** Shopify Liquid, vanilla JS (ES modules, private class fields), CSS custom properties from Horizon theme.

---

## File Map

| File | Role |
|------|------|
| `assets/recent-searches.js` | **New.** `RecentSearches` class — localStorage read/write, max 5 |
| `assets/predictive-search.js` | **Modify.** Import `RecentSearches`; add `addSearch` hooks; swap suggestions pre-morph; remove debug logs |
| `snippets/predictive-search-empty-state.liquid` | **Modify.** Add `#search-suggestions` list above product grid |
| `sections/predictive-search-empty.liquid` | **Modify.** Add `predictive-search-form__footer` CTA after the snippet render call |
| `sections/predictive-search.liquid` | **Modify.** Fix CTA `<button>` → `<a>`; remove `position: fixed`; add sticky footer, gradient, and suggestion list CSS in `{% stylesheet %}` |

---

## Task 1: Create `RecentSearches` class

**Files:**
- Create: `assets/recent-searches.js`

- [ ] **Step 1: Create the file**

```js
/**
 * Manages recently searched terms in localStorage.
 */
export class RecentSearches {
  static #STORAGE_KEY = 'recentSearches';
  static #MAX_SEARCHES = 5;

  /**
   * Prepend a search term, deduplicate, cap at 5, persist.
   * @param {string} term
   */
  static addSearch(term) {
    if (!term) return;
    let searches = this.getSearches();
    searches = searches.filter((s) => s !== term);
    searches.unshift(term);
    searches = searches.slice(0, this.#MAX_SEARCHES);
    localStorage.setItem(this.#STORAGE_KEY, JSON.stringify(searches));
  }

  /**
   * @returns {string[]}
   */
  static getSearches() {
    return JSON.parse(localStorage.getItem(this.#STORAGE_KEY) || '[]');
  }
}
```

- [ ] **Step 2: Verify the file is importable**

Open the browser console on mug.se, run:
```js
import('/assets/recent-searches.js?v=1').then(m => {
  m.RecentSearches.addSearch('Test');
  console.log(m.RecentSearches.getSearches()); // ['Test']
  m.RecentSearches.addSearch('Test'); // dedupe
  console.log(m.RecentSearches.getSearches()); // ['Test'] still length 1
});
```
Expected: `['Test']` both times.

- [ ] **Step 3: Commit**

```bash
git add assets/recent-searches.js
git commit -m "feat: add RecentSearches localStorage class"
```

---

## Task 2: Add suggestion list to empty-state snippet

**Files:**
- Modify: `snippets/predictive-search-empty-state.liquid`

**Context:** The snippet currently renders a `<div id="predictive-search-results">` containing `<div class="predictive-search-results__inner">` which contains the product grid. Add the suggestion list inside `.predictive-search-results__inner`, before the `{% render 'predictive-search-products-list' %}` call (line 30).

- [ ] **Step 1: Add `#search-suggestions` above the product grid**

In `snippets/predictive-search-empty-state.liquid`, insert the suggestion block after line 20 (`<div class="predictive-search-results__inner">`) and before the `{% paginate %}` tag (line 26). Follow the full code block below — do not use the line number as a reference since it may shift:

```liquid
      <ul id="search-suggestions" class="search-suggestions">
        <li><a href="/search?q=Elgitarrer&type=product">Elgitarrer<span class="search-suggestions__label">Kategori</span></a></li>
        <li><a href="/search?q=Effektpedaler&type=product">Effektpedaler<span class="search-suggestions__label">Kategori</span></a></li>
        <li><a href="/search?q=Akustiska+gitarrer&type=product">Akustiska gitarrer<span class="search-suggestions__label">Kategori</span></a></li>
        <li><a href="/search?q=Synthar+%26+moduler&type=product">Synthar & moduler<span class="search-suggestions__label">Kategori</span></a></li>
        <li><a href="/search?q=Ljudkort&type=product">Ljudkort<span class="search-suggestions__label">Kategori</span></a></li>
      </ul>
```

The full `load_empty_state` block after the edit should read:

```liquid
  {% if load_empty_state %}
    <div class="predictive-search-results__inner">
      <ul id="search-suggestions" class="search-suggestions">
        <li><a href="/search?q=Elgitarrer&type=product">Elgitarrer<span class="search-suggestions__label">Kategori</span></a></li>
        <li><a href="/search?q=Effektpedaler&type=product">Effektpedaler<span class="search-suggestions__label">Kategori</span></a></li>
        <li><a href="/search?q=Akustiska+gitarrer&type=product">Akustiska gitarrer<span class="search-suggestions__label">Kategori</span></a></li>
        <li><a href="/search?q=Synthar+%26+moduler&type=product">Synthar & moduler<span class="search-suggestions__label">Kategori</span></a></li>
        <li><a href="/search?q=Ljudkort&type=product">Ljudkort<span class="search-suggestions__label">Kategori</span></a></li>
      </ul>
      {% liquid
        assign collection = settings.empty_state_collection | default: collections.all
        assign default_title = 'content.search_results_resource_products' | t
        assign title = settings.empty_state_collection.title | default: default_title
      %}
      {% paginate collection.products by 4 %}
        {% assign products = collection.products %}
        {% if products.size > 0 %}
          {% render 'predictive-search-products-list',
            products_test_id: products_test_id,
            title: title,
            products: products,
            limit: 4
          %}
        {% else %}
          <div class="predictive-search-results__no-results">
            <p>{{ 'content.no_products_found' | t }}</p>
          </div>
        {% endif %}
      {% endpaginate %}
    </div>
  {% endif %}
```

- [ ] **Step 2: Verify in browser**

Open the search modal. Inspect the DOM — `#search-suggestions` should be present above the product grid. The 5 links should be visible (unstyled for now).

- [ ] **Step 3: Commit**

```bash
git add snippets/predictive-search-empty-state.liquid
git commit -m "feat: add hardcoded popular search suggestions to empty state"
```

---

## Task 3: Add CTA footer to empty-state section

**Files:**
- Modify: `sections/predictive-search-empty.liquid`

**Context:** The section schema has `"class": "predictive-search-empty-section"` — Shopify wraps the section output in a div with that class. The footer div added here will be inside that wrapper, so `parsedEmptySectionMarkup.querySelector('.predictive-search-form__footer')` will find it.

- [ ] **Step 1: Add footer after the snippet render call**

Replace the contents of `sections/predictive-search-empty.liquid` (before `{% schema %}`):

```liquid
{% render 'predictive-search-empty-state',
  load_empty_state: true,
  shadow_opacity: 0.1,
  products_test_id: 'products-list-default--reset'
%}

<div class="predictive-search-form__footer">
  <a
    href="{{ routes.search_url }}?type=product"
    class="button button-primary predictive-search__search-button"
  >
    VISA ALLA PRODUKTER
  </a>
</div>
```

Note: use `routes.search_url` (Shopify Liquid global) instead of hardcoded `/search` — works with custom URL routes.

- [ ] **Step 2: Verify in browser**

Open the search modal. A button reading "VISA ALLA PRODUKTER" should appear at the bottom. Clicking it navigates to the search page. (Styling comes in Task 4.)

- [ ] **Step 3: Commit**

```bash
git add sections/predictive-search-empty.liquid
git commit -m "feat: add VISA ALLA PRODUKTER CTA to empty state section"
```

---

## Task 4: Fix CTA button and add all CSS

**Files:**
- Modify: `sections/predictive-search.liquid`

**Context:** This file has a `{% stylesheet %}` block at the bottom. The existing `button.button.button-primary.predictive-search__search-button` CSS rule (around line 403) uses `position: fixed` — this must be replaced. The `<button ref="viewAllButton">` element around line 235 must become an `<a>` tag.

### 4a — Fix the CTA button element

- [ ] **Step 1: Change `<button>` to `<a>` in the footer**

Find this block near line 234:
```liquid
    <div class="predictive-search-form__footer">
      <button class="button button-primary predictive-search__search-button" ref="viewAllButton">
        {{ 'content.search_results_view_all' | t }} {{ predictive_search.resources.products.size }} Resultat
      </button>
    </div>
```

Replace with:
```liquid
    <div class="predictive-search-form__footer">
      <a
        href="{{ routes.search_url }}?q={{ predictive_search.terms | url_encode }}&type=product"
        class="button button-primary predictive-search__search-button"
        ref="viewAllButton"
      >
        VISA ALLA {{ predictive_search.resources.products.size }} RESULTAT
      </a>
    </div>
```

- [ ] **Step 2: Verify in browser**

Type "gitarr" in the search box. The footer button should read "VISA ALLA X RESULTAT" and clicking it navigates to `/search?q=gitarr&type=product`.

### 4b — Replace CSS in `{% stylesheet %}`

- [ ] **Step 3: Remove conflicting CSS rules and add new footer + gradient + suggestion styles**

In the `{% stylesheet %}` block, find and **remove** two rules:

**Rule 1** — around line 243, `position: relative !important` on the footer (will conflict with the new `position: sticky`):
```css
.predictive-search-form__footer { position: relative !important; }
```

**Rule 2** — around lines 403–409, the old `position: fixed` on the button (dead selector after `<button>` → `<a>` change, remove for hygiene):
```css
button.button.button-primary.predictive-search__search-button {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translate(-50%);
  margin-bottom: 20px;
}
```

Then add the following at the end of the `{% stylesheet %}` block:

```css
/* ── Footer: sticky at bottom, never cropped ── */
.predictive-search-form__footer {
  position: sticky;
  bottom: 0;
  background-color: var(--color-background);
  padding: var(--padding-lg);
  display: flex;
  justify-content: center;
}

/* Gradient that fades the product grid behind the footer */
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

/* ── Suggestion list ── */
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
  margin-left: 16px;
  flex-shrink: 0;
}
```

- [ ] **Step 4: Verify in browser**

Open the search modal:
- The suggestion list should display with horizontal dividers and right-aligned "Kategori" labels
- The "VISA ALLA PRODUKTER" / "VISA ALLA X RESULTAT" button should be pinned to the bottom
- A gradient should fade the product grid into the button

- [ ] **Step 5: Commit**

```bash
git add sections/predictive-search.liquid
git commit -m "feat: fix CTA button, add sticky footer, gradient and suggestion list styles"
```

---

## Task 5: Wire up `RecentSearches` in `predictive-search.js`

**Files:**
- Modify: `assets/predictive-search.js`

This task has four sub-changes applied to the same file, committed together at the end.

### 5a — Import `RecentSearches`

- [ ] **Step 1: Add import at top of file**

After line 5 (`import { RecentlyViewed } ...`), add:
```js
import { RecentSearches } from '@theme/recent-searches';
```

### 5b — Remove debug logs

- [ ] **Step 2: Remove all `[RV debug]` console.log lines**

Remove these four lines from `#resetSearch`:
```js
console.log('[RV debug] viewedProducts IDs:', viewedProducts);
console.log('[RV debug] recentlyViewedProductsHtml:', recentlyViewedProductsHtml?.outerHTML?.slice(0, 500));
console.log('[RV debug] recentlyViewedChildren count:', recentlyViewedChildren.length, '| ul found:', !!recentlyViewedUl, '| li count:', count, '| rounded:', rounded);
console.log('[RV debug] showing recently viewed, trimmed to', rounded);
console.log('[RV debug] not enough for full row — showing default collection');
```

### 5c — Swap suggestions pre-morph in `#resetSearch`

- [ ] **Step 3: Restructure early returns and insert suggestion swap block**

The current `#resetSearch` has two bare `return` statements inside `if (viewedProducts.length > 0)` that exit the entire method on fetch failure. These must be changed so execution always reaches the suggestion swap and `morph()` — even if recently-viewed markup fails to load.

**Change the two early returns** inside the `if (viewedProducts.length > 0)` block from bare `return` to skipping the recently-viewed injection only. Replace the entire recently-viewed block:

```js
    if (viewedProducts.length > 0) {
      const recentlyViewedMarkup = await this.#getRecentlyViewedProductsMarkup();
      if (!recentlyViewedMarkup) return;   // ← CHANGE this

      const parsedRecentlyViewedMarkup = new DOMParser().parseFromString(recentlyViewedMarkup, 'text/html');
      const recentlyViewedProductsHtml = parsedRecentlyViewedMarkup.getElementById('predictive-search-products');
      if (!recentlyViewedProductsHtml) return;  // ← AND this
      // ... rest of block
    }
```

With this restructured version where failures skip the injection but continue to the suggestion swap and morph:

```js
    if (viewedProducts.length > 0) {
      const recentlyViewedMarkup = await this.#getRecentlyViewedProductsMarkup();
      const parsedRecentlyViewedMarkup = recentlyViewedMarkup
        ? new DOMParser().parseFromString(recentlyViewedMarkup, 'text/html')
        : null;
      const recentlyViewedProductsHtml = parsedRecentlyViewedMarkup?.getElementById('predictive-search-products') ?? null;

      if (recentlyViewedProductsHtml) {
        for (const child of recentlyViewedProductsHtml.children) {
          if (child instanceof HTMLElement) {
            child.setAttribute('ref', 'recentlyViewedWrapper');
          }
        }

        const collectionElement = parsedEmptySectionMarkup.querySelector('#predictive-search-products');
        if (collectionElement) {
          collectionElement.prepend(...recentlyViewedProductsHtml.children);

          const allChildren = Array.from(collectionElement.children);
          const recentlyViewedChildren = allChildren.filter(el => el.getAttribute('ref') === 'recentlyViewedWrapper');
          let recentlyViewedUl = recentlyViewedChildren.find(el => el.tagName === 'UL');
          if (!recentlyViewedUl) {
            for (const el of recentlyViewedChildren) {
              recentlyViewedUl = el.querySelector('ul');
              if (recentlyViewedUl) break;
            }
          }
          const count = recentlyViewedUl ? recentlyViewedUl.children.length : 0;
          const rounded = Math.floor(count / 4) * 4;
          if (rounded >= 4) {
            Array.from(recentlyViewedUl.children).slice(rounded).forEach(el => el.remove());
            allChildren
              .filter(el => el.getAttribute('ref') !== 'recentlyViewedWrapper')
              .forEach(el => el.remove());
          } else {
            recentlyViewedChildren.forEach(el => el.remove());
          }
        }
      }
    }

    // Swap popular suggestions → recent searches if history exists.
    // This runs regardless of whether recently-viewed markup loaded successfully.
    const recentSearches = RecentSearches.getSearches();
    if (recentSearches.length > 0) {
      const suggestionsEl = parsedEmptySectionMarkup.querySelector('#search-suggestions');
      if (suggestionsEl) {
        suggestionsEl.innerHTML = recentSearches
          .map(
            (term) =>
              `<li><a href="${Theme.routes.search_url}?q=${encodeURIComponent(term)}&type=product">${term}<span class="search-suggestions__label">Kategori</span></a></li>`
          )
          .join('');
      }
    }
```

The `if (abortController.signal.aborted) return;` guard and `morph()` call follow immediately after this block — unchanged.

### 5d — Record searches on form submit and suggestion click

- [ ] **Step 4: Add `addSearch` on bare form submit (Enter with no item selected)**

In `onSearchKeyDown`, inside the `case 'Enter':` block, find the `else` branch (line ~213):
```js
        } else {
          const searchUrl = new URL(Theme.routes.search_url, location.origin);
          searchUrl.searchParams.set('q', this.refs.searchInput.value);
          window.location.href = searchUrl.toString();
        }
```

Replace with:
```js
        } else {
          const term = this.refs.searchInput.value.trim();
          if (term) RecentSearches.addSearch(term);
          const searchUrl = new URL(Theme.routes.search_url, location.origin);
          searchUrl.searchParams.set('q', term);
          window.location.href = searchUrl.toString();
        }
```

- [ ] **Step 5: Add delegated click listener for `#search-suggestions`**

In `connectedCallback`, add the suggestion-click listener **outside** the `if (dialog)` guard so it works in all contexts. The `if (dialog)` block ends at line ~54. Place the new listener directly after it, at the top level of `connectedCallback`:

```js
    this.addEventListener('click', this.#handleSuggestionClick, { signal });
```

Then add the handler as a private class field (e.g. after `#handleModalClick`):

```js
  /**
   * Records a search term when a suggestion link is clicked.
   * @param {MouseEvent} event
   */
  #handleSuggestionClick = (event) => {
    const link = /** @type {HTMLElement} */ (event.target).closest('#search-suggestions a');
    if (!link) return;
    // Read the text node directly (first child) to avoid including the label span text
    const term = link.firstChild?.textContent?.trim();
    if (term) RecentSearches.addSearch(term);
  };
```

- [ ] **Step 6: Verify the full flow in browser**

1. Clear localStorage: `localStorage.removeItem('recentSearches')`
2. Open search modal — popular suggestions should show (Elgitarrer, Effektpedaler, etc.)
3. Click "Elgitarrer" — navigates to search. Come back.
4. Open search modal again — "Elgitarrer" should now appear as recent search
5. Type "Gibson" and press Enter — saves "Gibson". Return, open modal — "Gibson" appears first
6. Verify suggestion swap is instant with no visible flash

- [ ] **Step 7: Commit**

```bash
git add assets/predictive-search.js assets/recent-searches.js
git commit -m "feat: wire RecentSearches into predictive search — suggestions, swap, click tracking"
```

- [ ] **Step 8: Push**

```bash
git push
```

---

## Verification Checklist

After all tasks are complete:

- [ ] Empty state (no history): 5 popular suggestions show above product grid, each with "Kategori" label
- [ ] Empty state (with history): recent searches replace popular ones, no flash
- [ ] Max 5 recent searches stored; oldest drops off when a 6th is added
- [ ] Clicking a suggestion records it as a recent search
- [ ] Typing + Enter records the search term
- [ ] Keyboard-activating a product card does NOT record a search
- [ ] CTA button: "VISA ALLA PRODUKTER" in empty state, "VISA ALLA X RESULTAT" while searching
- [ ] CTA button is always visible at the bottom, never cropped
- [ ] Gradient fades the product grid behind the button
- [ ] No `[RV debug]` console logs in production
