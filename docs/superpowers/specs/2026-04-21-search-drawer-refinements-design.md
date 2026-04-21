# Search Drawer Refinements

**Date:** 2026-04-21
**Project:** MUG (mug.se) — Shopify Horizon theme
**Follows:** `2026-04-20-search-drawer-design.md` (the drawer itself)

---

## Overview

Six focused refinements to the right-side search drawer that shipped yesterday. Together they resolve a scroll-jank bug, tighten the product grid to a clean 3×3, replace a fixed footer with an inline call-to-action (which also restores click-through on the bottom row), add a new suggestions group sourced from Shopify's `queries` resource, and bump product thumbnails to full resolution. All changes are scoped to the desktop (`≥750px`) drawer; mobile is unchanged.

## Goals

- Scroll inside the drawer reaches the last row smoothly, without "forcing" it.
- Product grid renders exactly 3 rows × 3 columns when the search returns a full result set (no orphan row).
- A single inline "Visa alla resultat" link sits below the product grid and is the *only* "view all" CTA — no sticky footer, no pointer-events overlay clipping the bottom row of products.
- The drawer surfaces Shopify's suggested `queries` as a labeled text list titled **"Förslag"**, sharing the same list styling as the existing Pages/Collections text lists.
- Product card thumbnails render crisp on high-DPR displays.
- Product cards at every scroll position remain clickable end-to-end.

## Non-goals

- Mobile (≤749px) UX is **not** touched.
- Recently-viewed state and its 24-product cap are **not** touched.
- Shopify's 10-per-resource API cap is **not** worked around — we only go to 9 per request.
- No new JS custom elements, no new asset files, no new Liquid snippets. All changes are edits within existing files.
- Color scheme, drawer geometry, drawer animation — all unchanged from yesterday's spec.
- Pills rendering for `queries` as a top-of-results refinement UI is **removed**, not added alongside — `queries` data is shown exactly once, as the "Förslag" list.

---

## The six changes

### 1. Remove the product text list *and* the scroll jank it caused

**File:** `sections/predictive-search.liquid:94-120`

**Change:** Delete the entire `{% if predictive_search.resources.products.size > 0 %} … PRODUCTS text list … {% endif %}` block that renders products as `.predictive-search-results__textlist` rows *above* the product grid.

**Why this fixes both items #1 and #4 of the user punch-list:**
Products already render as the visual grid further down (line 154-160 via `render 'predictive-search-products-list'`). The text list was a second, redundant render of the same data. Beyond visual duplication, it added a sibling flex-column child between the sticky search header and the scroll area, which appears to be the source of the perceived scroll jank (extra tall block forcing a layout reflow every time the scroll container recalculates content height during the Shopify-managed `morph` update). Removing it restores a predictable scroll container height.

**Acceptance criteria:**
- Typing a query renders products as a grid only — no duplicated text rows for products above the grid.
- Scrolling from the top of the results area to the last visible product row completes in a single natural gesture; no "sticking" at mid-scroll.
- Pages, Collections, and Articles text lists (still useful — they link to non-product pages) are retained.

### 2. Cap product results at 9 (3×3 grid)

**File:** `assets/predictive-search.js:331`

**Change:** `url.searchParams.set('resources[limit]', '8')` → `url.searchParams.set('resources[limit]', '9')`.

**Why:** The drawer grid renders 3 columns. At 8 products we get 2 full rows + 2 orphans. At 9 we get exactly 3 full rows. Shopify's `/search/suggest.json` supports up to 10 per resource so 9 is within API bounds.

**Acceptance criteria:**
- When a search matches ≥9 products, the grid renders exactly 9 cards in 3 rows of 3.
- When a search matches fewer than 9, the grid renders however many matched (no change in that case).
- The recently-viewed products code path (`assets/predictive-search.js:368`, which uses `limit=24`) is unaffected.

### 3. Inline "Visa alla resultat" link (replaces the sticky footer)

**Files:**
- `snippets/predictive-search.liquid:119-127` — delete `.predictive-search-form__footer` block (and its anchor `<a class="button button-primary predictive-search__search-button" …>`).
- `sections/predictive-search.liquid:570-586` — delete the `.predictive-search-form__footer` ruleset (the one with `margin-top: -80px`, `z-index: 2`, gradient background, and `pointer-events: none` / `.predictive-search-form__footer .button { pointer-events: auto }`).
- `sections/predictive-search.liquid` — add a new inline link at the **end** of the `{% if predictive_search.performed %}{%- if search_results_count > 0 -%}` branch, placed **after** the products-list render at line 158-160 and **before** the close of `.predictive-search-results__inner`. Uses the same `button button-primary` styling class list as the old button. Rendered only when `search_results_count > 0`.
- `assets/predictive-search.js:#updateFooter()` (starts at line 497) — simplify to target the new inline link instead of the removed footer, OR delete it and inline the label-swap logic wherever the link renders. Since the link is now server-rendered per search, the method may become a no-op or be removed entirely if label does not need client-side updating. Implementer: audit which call sites still rely on `#updateFooter()` before deleting; if any remain, keep the method and point it at the new inline link.

**Link markup (Liquid):**
```liquid
<a
  href="{{ routes.search_url }}?q={{ predictive_search.terms | url_encode }}"
  class="button button-primary predictive-search__search-button"
  ref="viewAllButton"
>
  VISA ALLA RESULTAT
</a>
```

Note the href: `?q={{ terms }}` without `&type=product`, so clicking navigates to Shopify's default `/search` results page (which shows mixed resource types), matching what the drawer surfaced.

**Styling:** the link uses existing `button button-primary` classes with no sticky/gradient/pointer-events wrapper. It flows inline as the last child of `.predictive-search-results__inner`. Some spacing above may need to be added via an inline rule in `sections/predictive-search.liquid`'s `{% stylesheet %}`, e.g. `margin-block: var(--margin-lg) var(--margin-md); display: flex; justify-content: center;` — kept minimal.

**Why this resolves click-through:** the deleted sticky footer used `margin-top: -80px` to overlap the last product row with a bottom-fade gradient. Even with `pointer-events: none` on the wrapper, the browser still hit-tested the child `<button>` (which had `pointer-events: auto`), and when the click landed *through* the gradient onto what looked like a product card, it could instead hit the footer's stacking context. Removing the overlap eliminates the hit-test ambiguity.

**Acceptance criteria:**
- No fixed/sticky "view all" button appears anywhere in the drawer.
- Exactly one inline `<a>` with label "VISA ALLA RESULTAT" renders at the bottom of the scrollable area, only when the search has ≥1 result.
- Clicking any product card — including cards in the last visible row — navigates to that product's page.
- Clicking the inline link navigates to `/search?q=<query>` (Shopify default search page, all resource types).
- Empty-state (no query typed, recently-viewed products showing) does **not** render the link.
- No-results state (query typed but 0 matches) does **not** render the link.

### 4. Vendors via `queries` resource, rendered as "Förslag" text list

**Files:**
- `sections/predictive-search.liquid:36-56` — delete the existing pills rendering block (`.predictive-search-results__wrapper-queries` list with `.predictive-search-results__pill` anchors). `queries` is rendered *only* in its new form.
- `sections/predictive-search.liquid` — add a new rendering block immediately after the Collections text list (which ends around line 74) and before the Pages text list (line 76). Block markup:

```liquid
{% if predictive_search.resources.queries.size > 0 %}
  <div class="predictive-search-results__group">
    <h4 class="predictive-search-results__heading">FÖRSLAG</h4>
    <ul class="predictive-search-results__textlist list-unstyled">
      {% for resource in predictive_search.resources.queries limit: 5 %}
        <li>
          <div class="search_pred">
            <a href="{{ resource.url }}">
              <span aria-label="{{ resource.text }}">{{ resource.styled_text }}</span>
            </a>
          </div>
        </li>
      {% endfor %}
    </ul>
  </div>
{% endif %}
```

**Why this placement:** the drawer's visual rhythm reads top-to-bottom as "header → generic category suggestions → text lists → product grid → view-all". Placing "Förslag" (search completions) above Pages/Articles groups the suggestion-style content together. Collections stays at the top of the text-list stack because a matching collection is the strongest signal ("you might mean this whole category").

**Why label "Förslag" and not "Märken":** Shopify's `queries` resource returns a mix of search completions, popular queries, and vendor-adjacent phrases — not a clean list of shop vendors. Labeling it "Märken" (Brands) would misrepresent the content. "Förslag" (Suggestions) is honest and matches the data. True vendor-only filtering is explicitly out of scope for this spec.

**Styling:** reuses the existing `.predictive-search-results__textlist` + `.search_pred` rules (already defined in `sections/predictive-search.liquid:251-278`). The highlighted markup from Shopify's `resource.styled_text` (which wraps the matched substring in `<mark>`) flows through unchanged. The `.predictive-search-results__pill mark` styling from the deleted pills block (lines 388-392) is also removed since no more pills render.

**Acceptance criteria:**
- Typing a query that yields suggestions from Shopify shows a "FÖRSLAG" labeled section above Pages and below Collections.
- No pill-shaped elements render anywhere in the drawer.
- Clicking a suggestion navigates to its `resource.url`.
- Maximum 5 suggestions displayed.
- Visually matches the existing Pages/Collections text lists (same heading typography, same row padding, same hover bg).

### 5. Full-resolution product thumbnails

**File:** `snippets/predictive-search-products-list.liquid:67` (and its twin at line 83).

**Change:** `image_width: 500` → `image_width: 1000` at both call sites within the snippet.

**Why:** at 3 columns across a 750px drawer, each card's rendered width is ~250px. On a 3× DPR display (iPhone Pro, newer MacBook Pro Retina panels), the browser needs ≥750px of actual pixels for crisp rendering. The current 500px source was soft on those displays. Note: `image_aspect_ratio: '5 / 5'` is **kept** — the user's concern was blurriness, not crop; square preserves the clean grid rhythm.

**Acceptance criteria:**
- Product card thumbnails in the search drawer render visually crisp on Retina/3× displays when inspected at 100% zoom.
- No layout shift (image's displayed dimensions are unchanged; only the source is higher-resolution).
- Recently-viewed product grid gets the same upgrade since both code paths flow through the same snippet.

### 6. Scroll jank — verified resolved by change #1

Not a separate change; listed here for explicit acceptance tracking.

**Acceptance criteria:**
- After changes #1 and #3 land, a user can scroll from the top of the results area to the inline "VISA ALLA RESULTAT" link in a single natural mouse-wheel gesture on desktop, and a single swipe on a trackpad, without any scroll-position stall.

---

## Files touched (summary)

| File | Change |
|---|---|
| `sections/predictive-search.liquid` | Delete products textlist block (1). Delete queries pills block (4). Add "Förslag" textlist block (4). Add inline view-all link block (3). Delete `.predictive-search-form__footer` CSS + `.predictive-search-results__pill*` CSS from `{% stylesheet %}` (3, 4). |
| `snippets/predictive-search.liquid` | Delete `.predictive-search-form__footer` markup (3). |
| `snippets/predictive-search-products-list.liquid` | Change `image_width: 500` → `1000` at two call sites (5). |
| `assets/predictive-search.js` | Change `resources[limit]` from `8` → `9` (2). Audit/update `#updateFooter()` (3). |

No new files. No deletions beyond code blocks within existing files. All changes are within `≥750px` scope (the deletions do not affect mobile because the mobile drawer reuses the same markup — verify during implementation that removing the pills doesn't visually break mobile; if it does, gate the pills removal behind a desktop media query instead of deleting outright).

---

## Out of scope (explicit)

- Changing or filtering the `queries` resource content (it's Shopify-controlled).
- True vendor-only search section (would require Option A — extracting unique vendors from matched products — explicitly deferred).
- Mobile drawer geometry, animation, or styling.
- Image aspect ratio change (kept at 5/5 square).
- Increasing result count beyond 9.
- Changes to recently-viewed state.

---

## Risks & mitigations

**Risk:** Deleting the pills breaks mobile search layout (the pills render on mobile too).
**Mitigation:** Implementer verifies mobile search visually after change #4. If broken, the fix is to wrap the pills block deletion in a `@media (min-width: 750px)` CSS display:none rather than deleting the Liquid block. Defer the Liquid deletion until a follow-up that also removes the mobile pills.

**Risk:** `#updateFooter()` in `predictive-search.js` has call sites that assume the footer exists.
**Mitigation:** Grep for `updateFooter` before deleting. If callers exist, keep the method and retarget it to the inline link (update label text on search change) rather than deleting.

**Risk:** The inline view-all link's position within the `{% content_for %}`-based section render may not survive Shopify's `morph()` replacement during live search updates.
**Mitigation:** Place the link inside `.predictive-search-results__inner` so it's part of the block that `morph()` replaces on each keystroke. Verify during implementation that the link re-renders after each search with the updated `predictive_search.terms` in its href.

**Risk:** `image_width: 1000` doubles the image payload per card. At 9 cards that's a meaningful increase on 3G connections.
**Mitigation:** Shopify's CDN serves WebP by default and browsers cache per-URL. For the drawer use case (user has already engaged; small thumbnail is the hero visual), sharp images are worth the byte cost. If payload becomes a concern later, revisit with `srcset`/responsive images.

---

## Success criteria (full set)

1. No product text list renders above the grid.
2. Product grid renders 9 cards in 3×3 when the search has ≥9 matches.
3. No sticky/fixed footer anywhere in the drawer.
4. Exactly one inline "VISA ALLA RESULTAT" link at the bottom of the results area, only when `search_results_count > 0`, linking to `/search?q=...`.
5. A "FÖRSLAG" labeled text list appears above Pages when Shopify returns query suggestions.
6. No pill-shaped query suggestions anywhere.
7. Product thumbnails are visually crisp on 3× DPR displays.
8. Every product card — top row through bottom row — is clickable and navigates to its product page.
9. Scroll from top of results to the inline link completes in a single natural gesture.
10. Mobile search UX is visually and behaviorally identical to before.
