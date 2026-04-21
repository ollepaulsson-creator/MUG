# Search Drawer Refinements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship six refinements to the right-side search drawer (remove product text list, cap products at 9, replace sticky footer with inline view-all link, swap pills for a "Förslag" text list, upgrade thumbnail resolution) — each as a self-contained, independently-revertable commit.

**Architecture:** Pure template/CSS/JS edits within existing Shopify Horizon files. No new snippets, sections, assets, or components. Five commits, five tasks; ordering goes simplest → most-coupled so momentum builds before the multi-file changes. All changes are desktop-scoped; mobile layout is untouched.

**Tech Stack:** Shopify Liquid templates, scoped CSS via `{% stylesheet %}` blocks, ES-module JS (`assets/predictive-search.js`), Shopify's built-in `morph()` re-render on predictive-search updates. **No test framework** exists in this repo — verification is manual against acceptance criteria via the preview theme.

**Spec:** `docs/superpowers/specs/2026-04-21-search-drawer-refinements-design.md`

---

## Verification model

This repo has no automated test runner. Instead, each task includes an explicit **pre-verification** step (observe current state, confirm the "bug" is present) and a **post-verification** step (observe new state, confirm the acceptance criteria pass). This replaces the TDD "write failing test → make it pass" cycle with an equivalent "observe failure → fix → observe success" cycle.

**Preview environment:**
- `origin/main` is an **unpublished preview theme**. Pushing to `main` deploys the commit to that preview.
- Verify all changes on the preview URL (the user's Shopify admin → Themes → preview link for the `main`-tracked theme). **Do not publish.**
- Desktop verification = viewport ≥ 750px. Mobile verification = ≤ 749px. The user cares about desktop; mobile should be checked at least for "no visible regression."

**Browser tools:** use Chrome DevTools (or Claude-in-Chrome if dispatched with that capability) to inspect DOM, CSS, and image src attributes. Use Network tab to confirm `/search/suggest.json?resources[limit]=9` is fetched when typing.

---

## File structure

| File | Task(s) | Nature of change |
|---|---|---|
| `assets/predictive-search.js` | 1, 5 | `resources[limit]` literal; `#updateFooter()` method + 2 call sites |
| `snippets/predictive-search-products-list.liquid` | 2 | `image_width` literal (3 occurrences, safe `replace_all`) |
| `sections/predictive-search.liquid` | 3, 4, 5 | Liquid block removals + 1 new Liquid block + CSS deletions |
| `snippets/predictive-search.liquid` | 5 | Liquid block removal (`.predictive-search-form__footer`) |

No new files. No deletions beyond specific Liquid/CSS blocks. No theme-setting schema changes.

---

## Task 1: Cap product results at 9

**Files:**
- Modify: `assets/predictive-search.js:331`

**Why first:** one-line change, zero coupling, unambiguous verification (network request inspection).

- [ ] **Step 1: Pre-verify (confirm bug)**

Open preview URL at desktop width (≥ 750px). Open the search drawer. Open DevTools → Network → filter by `suggest.json`. Type "pedal" (or any query guaranteed to match ≥ 9 products). Click the fired `suggest.json` request. Confirm the query string contains `resources%5Blimit%5D=8` (URL-encoded `resources[limit]=8`). In the drawer, count product cards: should be 8, rendering as 2 full rows + 2 orphans in the 3-column grid.

- [ ] **Step 2: Edit the limit**

```
File: /Users/ollepaulsson/MUG/assets/predictive-search.js
old_string:    url.searchParams.set('resources[limit]', '8');
new_string:    url.searchParams.set('resources[limit]', '9');
```

The file contains two `resources[limit]` calls (line 331 for search, line 368 for recently-viewed with `'24'`). **Only line 331 should change.** If using `replace_all`, do not — use a targeted edit with enough surrounding context to uniquely identify line 331. Recommended context:

```
old_string:    url.searchParams.set('resources[limit_scope]', 'each');
    url.searchParams.set('resources[limit]', '8');
new_string:    url.searchParams.set('resources[limit_scope]', 'each');
    url.searchParams.set('resources[limit]', '9');
```

- [ ] **Step 3: Post-verify**

Reload the preview page (hard-refresh to clear cached JS). Re-open the search drawer. Re-type "pedal". Confirm:
- Network request now shows `resources%5Blimit%5D=9`.
- Drawer renders exactly 9 product cards.
- Grid reads as 3 full rows × 3 columns, no orphan row.
- Recently-viewed state (close drawer, reopen *without* typing) still shows up to 24 products (line 368 untouched).

- [ ] **Step 4: Commit and push**

```bash
cd /Users/ollepaulsson/MUG
git add assets/predictive-search.js
git commit -m "$(cat <<'EOF'
feat(search-drawer): cap products at 9 for clean 3x3 grid

resources[limit] 8 -> 9 on the search path only. Recently-viewed
path (resources[limit]=24) is unchanged. Fills the 3-column grid
with exactly 3 rows, no orphan row.

Spec: docs/superpowers/specs/2026-04-21-search-drawer-refinements-design.md
EOF
)"
git push origin main
```

---

## Task 2: Upgrade thumbnail resolution (500 → 1000)

**Files:**
- Modify: `snippets/predictive-search-products-list.liquid` — three `image_width: 500` call sites at lines 66, 83, 113

**Why here:** pure single-file mechanical change, no CSS, no layout impact.

- [ ] **Step 1: Pre-verify (confirm bug)**

Open preview URL at desktop width. Open search drawer, type a query with product results. In DevTools Elements tab, inspect any `<img>` inside a `.predictive-search-results__card--product`. Confirm the `src` contains `width=500` (Shopify image CDN serves the requested width in the URL). On a Retina (2×+) display, thumbnails will look soft because the browser is upscaling 500px → ~250px × 2-3× display pixel ratio.

- [ ] **Step 2: Confirm the three call sites**

Run (via Grep tool, NOT bash):

```
Grep pattern: image_width: 500
Grep path: /Users/ollepaulsson/MUG/snippets/predictive-search-products-list.liquid
Grep output_mode: content
Grep -n: true
```

Expected: exactly 3 matches at lines 66, 83, 113. If not, **stop and escalate** — the file has drifted from the spec and needs re-verification before proceeding.

- [ ] **Step 3: Replace all three**

```
File: /Users/ollepaulsson/MUG/snippets/predictive-search-products-list.liquid
old_string: image_width: 500
new_string: image_width: 1000
replace_all: true
```

- [ ] **Step 4: Post-verify**

Re-run the same Grep:
- Expected: zero matches for `image_width: 500`.
- Run a second Grep for `image_width: 1000` — expect 3 matches at the same line numbers.

Hard-refresh preview. Re-open drawer, re-query. DevTools → inspect a product `<img>` src. Confirm `width=1000` now appears. Visual: thumbnails should be visibly crisper on a Retina display. Also verify recently-viewed thumbnails: close drawer, reopen without typing, inspect thumbnails there — they should also have `width=1000` in the src (both paths flow through this snippet).

- [ ] **Step 5: Commit and push**

```bash
cd /Users/ollepaulsson/MUG
git add snippets/predictive-search-products-list.liquid
git commit -m "$(cat <<'EOF'
feat(search-drawer): upgrade product thumbnails to image_width 1000

Three call sites (lines 66, 83, 113) bumped from 500 to 1000.
Line 113 is the actual search-results render path; 66/83 are the
recently-viewed path. All three get the upgrade for consistency.
image_aspect_ratio: '5 / 5' kept — concern was blurriness, not crop.

Spec: docs/superpowers/specs/2026-04-21-search-drawer-refinements-design.md
EOF
)"
git push origin main
```

---

## Task 3: Remove product text list above the grid (fixes scroll jank)

**Files:**
- Modify: `sections/predictive-search.liquid:94-120` — delete the entire `{% if predictive_search.resources.products.size > 0 %}` block that renders products as a `.predictive-search-results__textlist`

**Why here:** one-block deletion, no replacement needed (products already render as a grid below).

- [ ] **Step 1: Pre-verify (confirm two bugs at once)**

Open preview URL at desktop width. Open search drawer. Type a query with ≥ 3 product matches. Observe:
- **Bug A (item #4):** Above the visual product grid there is a **"PRODUCTS"** heading with products listed as clickable text rows (product name on the left, vendor name on the right) — this is the redundant textlist. The same products also render below as the visual grid.
- **Bug B (item #1, the jank):** Scroll from the top of the results to the last product row. The scroll "sticks" or requires extra wheel/swipe force mid-scroll. (Easier to feel on a trackpad.)

- [ ] **Step 2: Locate the block to delete**

Read `sections/predictive-search.liquid:94-120`. The block should look exactly like:

```liquid
          {% if predictive_search.resources.products.size > 0 %}
            {%- liquid
              assign title = 'content.search_results_resource_products' | t
              assign products = predictive_search.resources.products
              assign search_query = predictive_search.terms | downcase
            -%}
            <div class="predictive-search-results__group">
              <h4 class="predictive-search-results__heading">PRODUCTS</h4>
              <ul class="predictive-search-results__textlist list-unstyled">
                {% for product in predictive_search.resources.products %}
                  {% assign product_title = product.title | downcase %}
                  {% if product_title contains search_query %}
                    <li>
                      <div class="search_pred">
                        <a href="{{ product.url }}">
                          {{ product.title | highlight: predictive_search.terms }}
                        </a>
                        <p class="search_pred__type">
                          {% if product.vendor %}{{ product.vendor }}{% else %}Product{% endif %}
                        </p>
                      </div>
                    </li>
                  {% endif %}
                {% endfor %}
              </ul>
            </div>
          {% endif %}
```

If the block content differs meaningfully (e.g. structure changed since spec was written), **stop and escalate.**

- [ ] **Step 3: Delete the block**

Use the Edit tool with the full block above as `old_string` and an empty `new_string`. Preserve the surrounding whitespace by including one blank line above the `{% if %}` and deleting the block cleanly:

```
File: /Users/ollepaulsson/MUG/sections/predictive-search.liquid
old_string: (the 27-line block above, starting with "          {% if predictive_search.resources.products.size > 0 %}" and ending with "          {% endif %}")
new_string: (empty string)
```

Keep the blank line between the preceding Pages block (ending around line 92) and the following Pages block (starting around line 122). The file has a known duplicate Pages block — **leave both Pages blocks intact**; only the PRODUCTS block is to be removed.

- [ ] **Step 4: Post-verify**

Hard-refresh preview. Re-open drawer, re-query:
- Confirm no "PRODUCTS" text heading appears.
- Confirm no text rows for products above the grid.
- Confirm **the visual product grid still renders** (it's rendered by a different block further down at line 154-160).
- Confirm Pages, Collections, and Articles text lists **still render** (they have their own `{% if %}` blocks that are untouched).
- Scroll test: scroll from top of results area to the last product row. Should complete in a single natural gesture — no mid-scroll stall.

- [ ] **Step 5: Commit and push**

```bash
cd /Users/ollepaulsson/MUG
git add sections/predictive-search.liquid
git commit -m "$(cat <<'EOF'
fix(search-drawer): remove product text list above grid (fixes jank + dupe)

Deletes the {% if predictive_search.resources.products.size > 0 %}
textlist block at lines 94-120 that was rendering products as text
rows ABOVE the visual grid. Products still render as a grid via the
predictive-search-products-list render further down. Same data was
showing twice.

The extra sibling block between the sticky header and the scroll
area was also the source of the scroll-jank: an additional layout
reflow on every morph() update was stalling scroll halfway down.
Removing it restores smooth scroll to the last row.

Pages/Collections/Articles text lists untouched (still useful —
they link to non-product pages).

Spec: docs/superpowers/specs/2026-04-21-search-drawer-refinements-design.md
EOF
)"
git push origin main
```

---

## Task 4: Replace pills with "Förslag" text list

**Files:**
- Modify: `sections/predictive-search.liquid:36-56` — delete pills block
- Modify: `sections/predictive-search.liquid:374-401` — delete `.predictive-search-results__pill*` CSS rules
- Modify: `sections/predictive-search.liquid:421-425` — delete `.predictive-search-results__wrapper.predictive-search-results__wrapper-queries` CSS rule (no longer needed once the pills UL is gone)
- Modify: `sections/predictive-search.liquid` — add new Förslag block between Collections (ends line 74) and Pages (starts line 76)

**Why here:** multi-site within a single file, but all changes land in the same file so they commit cleanly.

- [ ] **Step 1: Pre-verify (confirm current state)**

Open preview URL at desktop width. Open search drawer. Type a query that yields multiple matches (e.g. "fender"). Observe:
- At the **top of the results area**, above Collections, a row of pill-shaped elements renders with suggested completions like "fender telecaster", "fender amp", etc. These are Shopify's `queries` resource rendered as pills.
- No "FÖRSLAG" labeled section exists.

- [ ] **Step 2: Add the new Förslag block (before deleting pills)**

Reason for order: add the replacement first, so at no point does the drawer lack a way to surface `queries` content. Adding first also makes it easy to visually compare before/after.

Edit `sections/predictive-search.liquid`. Locate the end of the Collections block at line 74 (`          {% endif %}`) and the start of the first Pages block at line 76 (`          {% if predictive_search.resources.pages.size > 0 %}`). Insert the new block between them:

```
old_string:            </div>
          {% endif %}

          {% if predictive_search.resources.pages.size > 0 %}
new_string:            </div>
          {% endif %}

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

          {% if predictive_search.resources.pages.size > 0 %}
```

The context includes the preceding `{% endif %}` and the following `{% if pages %}` so the edit is unambiguous even if line numbers have drifted.

Note: the Collections block ends with `</div>` then `{% endif %}`, not the other way around. The `old_string` above reflects that. Double-check by re-reading lines 70-78 before editing.

- [ ] **Step 3: Interim verify — both pills and Förslag appear**

Hard-refresh preview. Re-open drawer, re-query. Expected: pills at top AND new "FÖRSLAG" labeled text list between Collections and Pages. The duplicated appearance is intentional for this interim step — confirms the Förslag block works before we remove pills.

If Förslag doesn't appear: check that the query yields `queries` results via the Network tab (the `suggest.json` response should include a `queries` array). If the array exists but Förslag still doesn't render, the Liquid block is likely in the wrong place — re-read lines 70-90 to confirm placement.

- [ ] **Step 4: Delete the pills block**

Read `sections/predictive-search.liquid:36-56` to confirm the block is still intact (no drift from Step 2's edit). Then delete:

```
old_string:          {% if predictive_search.resources.queries.size > 0 %}
            {% assign shared_results_index = shared_results_index | plus: predictive_search.resources.collections.size %}
            <ul
              class="predictive-search-results__list predictive-search-results__wrapper predictive-search-results__wrapper-queries list-unstyled"
              role="listbox"
              aria-labelledby="predictive-search-queries"
            >
              {%- for resource in predictive_search.resources.queries -%}
                <li
                  class="predictive-search-results__card--query"
                  ref="resultsItems[]"
                  data-search-result-index="search-results-{{ shared_results_index | plus: forloop.index }}"
                  on:keydown="/onSearchKeyDown"
                >
                  <a class="pills__pill predictive-search-results__pill" href="{{ resource.url }}">
                    <span aria-label="{{ resource.text }}">{{ resource.styled_text }}</span>
                  </a>
                </li>
              {% endfor %}
            </ul>
          {% endif %}

new_string: (empty string — preserve blank line above and below by including surrounding context)
```

Safer form with surrounding context:

```
old_string:          {% assign shared_results_index = 0 %}

          {% if predictive_search.resources.queries.size > 0 %}
            {% assign shared_results_index = shared_results_index | plus: predictive_search.resources.collections.size %}
            <ul
              class="predictive-search-results__list predictive-search-results__wrapper predictive-search-results__wrapper-queries list-unstyled"
              role="listbox"
              aria-labelledby="predictive-search-queries"
            >
              {%- for resource in predictive_search.resources.queries -%}
                <li
                  class="predictive-search-results__card--query"
                  ref="resultsItems[]"
                  data-search-result-index="search-results-{{ shared_results_index | plus: forloop.index }}"
                  on:keydown="/onSearchKeyDown"
                >
                  <a class="pills__pill predictive-search-results__pill" href="{{ resource.url }}">
                    <span aria-label="{{ resource.text }}">{{ resource.styled_text }}</span>
                  </a>
                </li>
              {% endfor %}
            </ul>
          {% endif %}

          {% if predictive_search.resources.collections.size > 0 %}
new_string:          {% assign shared_results_index = 0 %}

          {% if predictive_search.resources.collections.size > 0 %}
```

- [ ] **Step 5: Delete the pill-related CSS**

Read `sections/predictive-search.liquid:374-401` to confirm the CSS block is intact. Delete it:

```
old_string:.predictive-search-results__pill {
  font-weight: 500;
  white-space: nowrap;
  color: var(--color-foreground);
  transition:
    background-color var(--animation-speed-medium) var(--animation-timing-hover),
    box-shadow var(--animation-speed-medium) var(--animation-timing-bounce),
    transform var(--animation-speed-medium) var(--animation-timing-bounce);
  margin: 2px;
}
.predictive-search-results__pill:hover {
  transform: scale(1.03);
  box-shadow: 0 2px 5px rgb(0 0 0 / var(--opacity-8));
}
.predictive-search-results__pill mark {
  background-color: transparent;
  font-weight: 200;
  color: rgb(var(--color-foreground-rgb) / var(--opacity-80));
}
.predictive-search-results__pill:focus,
.predictive-search-results__pill:hover,
.predictive-search-results__card--query:is([aria-selected='true'], :focus-within) .predictive-search-results__pill {
  --pill-background-color: rgb(var(--color-foreground-rgb) / var(--opacity-8));
  background-color: var(--pill-background-color);
  outline: var(--border-width-sm) solid var(--color-border);
  border: var(--border-width-sm);
  text-decoration: none;
}

new_string: (empty string)
```

Then delete the `__wrapper-queries` container rule at lines 421-425:

```
old_string:.predictive-search-results__wrapper.predictive-search-results__wrapper-queries {
  margin-bottom: var(--margin-lg);
  padding-inline: var(--padding-xl);
  gap: var(--gap-2xs);
}

new_string: (empty string)
```

- [ ] **Step 6: Post-verify**

Hard-refresh preview. Re-open drawer, re-query:
- **No pill-shaped elements** render anywhere in the drawer. The top of the results (above Collections) shows straight to the Collections heading.
- **"FÖRSLAG" labeled section** renders between Collections and Pages.
- FÖRSLAG heading style visually matches COLLECTION / PAGES / ARTICLES headings (same typography, same padding, same letter-spacing).
- Each FÖRSLAG row behaves like a Pages/Collections row: full-width hover background, clickable, navigates to `resource.url` when clicked.
- Highlighted substring (the `<mark>` inside `styled_text`) renders with `.mark` styling (de-emphasized — see `sections/predictive-search.liquid` stylesheet for `.predictive-search-results__pill mark` which we deleted; `styled_text`'s `<mark>` will now pick up the theme's default `<mark>` styling, which should still be a reasonable highlight).
- **Mobile check** (resize viewport to ≤749px): no visual regression. The drawer's mobile appearance should be identical apart from pills not rendering.

- [ ] **Step 7: Commit and push**

```bash
cd /Users/ollepaulsson/MUG
git add sections/predictive-search.liquid
git commit -m "$(cat <<'EOF'
feat(search-drawer): replace query pills with FÖRSLAG text list

- Delete the .predictive-search-results__wrapper-queries pills block
  at lines 36-56 (rendered queries resource as pill-shaped anchors).
- Add a new FÖRSLAG labeled text list between Collections and Pages,
  rendering predictive_search.resources.queries (limit 5) with the
  same .predictive-search-results__textlist + .search_pred styling
  the Pages/Collections lists use.
- Delete the now-orphan CSS: .predictive-search-results__pill*
  rules (lines 374-401) and the wrapper-queries rule (421-425).

Labeled "FÖRSLAG" not "Märken" because Shopify's queries resource
returns a mix of completions and vendor-adjacent phrases, not strictly
vendor names. Honest label beats aspirational one.

Spec: docs/superpowers/specs/2026-04-21-search-drawer-refinements-design.md
EOF
)"
git push origin main
```

---

## Task 5: Replace sticky footer with inline view-all link

**Files:**
- Modify: `snippets/predictive-search.liquid:119-127` — delete `.predictive-search-form__footer` markup
- Modify: `sections/predictive-search.liquid:570-586` — delete `.predictive-search-form__footer` CSS
- Modify: `sections/predictive-search.liquid` — add inline link at the end of `.predictive-search-results__inner`, after the products-list render (near line 158-160) and before the close of `.predictive-search-results__inner` (around line 233)
- Modify: `assets/predictive-search.js:343, 474, 497-513` — remove `#updateFooter()` method and both call sites (the inline link is Liquid-rendered and the href stays in sync via `morph()`)

**Why last:** most coupled change — touches three files, requires JS audit.

- [ ] **Step 1: Pre-verify (confirm current state and the clickability bug)**

Open preview URL at desktop width. Open search drawer. Type a query. Observe:
- A **sticky "VISA ALLA PRODUKTER" button** appears near the bottom of the drawer with a gradient fade above it. It remains fixed to the bottom even when scrolling.
- Click test: try clicking a product card in the bottom row (the row closest to the sticky button). Some clicks land on the product, but clicks near the top of the last row — where the gradient fades over the card — **get swallowed** and no navigation happens. (This is the spec's documented bug: `margin-top: -80px` makes the footer overlap the last row; even with `pointer-events: none`, the browser's hit-testing can still hit the footer's stacking context.)

- [ ] **Step 2: Add the inline link (before removing the sticky one)**

Locate the end of the `{% if predictive_search.performed %}{%- if search_results_count > 0 -%}` branch in `sections/predictive-search.liquid`. Currently this branch ends around line 190 (the last `{% endif %}` before `{% else %}` at line 191). The products-list render is at line 154-160; the carousels are at 162-190.

Add the inline link **after all carousels** (i.e. at the end of the branch, just before the `{% else %}` for the no-results case). Read lines 185-195 first to confirm placement:

```
Read: sections/predictive-search.liquid, offset: 180, limit: 20
```

Look for the closing `{% endif %}` of the articles-carousel block (should be around line 190), followed immediately by `        {% else %}` (around line 191, which opens the no-results branch).

Edit between them:

```
old_string:          {% if predictive_search.resources.articles.size > 0 %}
            {% assign shared_results_index = shared_results_index | plus: predictive_search.resources.pages.size %}
            {% assign resource_title = 'content.search_results_resource_articles' | t %}
            {% render 'predictive-search-resource-carousel',
              title: resource_title,
              resource_type: 'article',
              resources: predictive_search.resources.articles
            %}
          {% endif %}
        {% else %}
new_string:          {% if predictive_search.resources.articles.size > 0 %}
            {% assign shared_results_index = shared_results_index | plus: predictive_search.resources.pages.size %}
            {% assign resource_title = 'content.search_results_resource_articles' | t %}
            {% render 'predictive-search-resource-carousel',
              title: resource_title,
              resource_type: 'article',
              resources: predictive_search.resources.articles
            %}
          {% endif %}

          <div class="predictive-search-results__view-all">
            <a
              href="{{ routes.search_url }}?q={{ predictive_search.terms | url_encode }}"
              class="button button-primary predictive-search__view-all-button"
              ref="viewAllButton"
            >
              VISA ALLA RESULTAT
            </a>
          </div>
        {% else %}
```

Then add the associated CSS inside the section's `{% stylesheet %}` block. Locate the stylesheet's end (around line 588, the `{% endstylesheet %}` tag) and add rules immediately before it:

```
old_string:/* ── Footer: always at bottom of flex column layout ── */
.predictive-search-form__footer {
new_string:/* Inline view-all link — lives at the end of .predictive-search-results__inner,
   flows naturally after the last result group. Replaces the old sticky footer. */
.predictive-search-results__view-all {
  display: flex;
  justify-content: center;
  padding: var(--padding-xl) var(--padding-xl) var(--padding-2xl);
}

.predictive-search__view-all-button {
  min-width: 240px;
}

/* ── Footer: always at bottom of flex column layout ── */
.predictive-search-form__footer {
```

- [ ] **Step 3: Interim verify — both links appear**

Hard-refresh preview. Re-query. Expected: inline "VISA ALLA RESULTAT" link at the bottom of the results area (after Articles carousel), AND the old sticky "VISA ALLA PRODUKTER" button still hovering at the bottom. Both visible — intentional for this step.

Click the inline link. Should navigate to `/search?q=<query>` (Shopify default search page, showing all resource types).

- [ ] **Step 4: Delete the sticky footer markup**

Open `snippets/predictive-search.liquid`. Read lines 115-130 to confirm the footer is at 119-127:

```liquid
    <div class="predictive-search-form__footer">
      <a
        href="{{ routes.search_url }}?type=product"
        class="button button-primary predictive-search__search-button"
        ref="viewAllButton"
      >
        VISA ALLA PRODUKTER
      </a>
    </div>
```

Delete it. Safer form with surrounding context:

```
old_string:    </div>

    <div class="predictive-search-form__footer">
      <a
        href="{{ routes.search_url }}?type=product"
        class="button button-primary predictive-search__search-button"
        ref="viewAllButton"
      >
        VISA ALLA PRODUKTER
      </a>
    </div>
  </form>
new_string:    </div>
  </form>
```

- [ ] **Step 5: Delete the sticky footer CSS**

Open `sections/predictive-search.liquid`. Read lines 565-590 to confirm the footer CSS block is still intact at 570-586. Delete:

```
old_string:/* ── Footer: always at bottom of flex column layout ── */
.predictive-search-form__footer {
  flex-shrink: 0;
  /* Gradient fades scrollable content into solid background at button level */
  background: linear-gradient(to bottom, transparent 0%, var(--color-background) 55%);
  padding: 80px var(--padding-lg) var(--padding-lg);
  display: flex;
  justify-content: center;
  pointer-events: none;
  margin-top: -80px; /* pull up so gradient overlaps bottom of scroll area */
  position: relative;
  z-index: 2; /* above content-wrapper which has transform stacking context */
}

.predictive-search-form__footer .button {
  pointer-events: auto;
}

new_string: (empty string)
```

Also delete any other reference to `.predictive-search-form__footer` in the same file. Grep to find them all:

```
Grep pattern: predictive-search-form__footer
Grep path: /Users/ollepaulsson/MUG/sections/predictive-search.liquid
Grep output_mode: content
Grep -n: true
```

Expected after deletion: zero matches. If any remain (e.g. inside `@media` blocks for mobile), delete those too — the sticky footer is fully replaced.

Also check `snippets/predictive-search.liquid`'s stylesheet for footer rules:

```
Grep pattern: predictive-search-form__footer
Grep path: /Users/ollepaulsson/MUG/snippets/predictive-search.liquid
Grep output_mode: content
Grep -n: true
```

Delete any matches found there too (expected: the `.predictive-search-form__footer` block at lines 202-226, and the `predictive-search-component:has(...)` selector referencing it at 223-226).

- [ ] **Step 6: Remove `#updateFooter()` and its two call sites**

Open `assets/predictive-search.js`. Three edits:

**Edit A — remove call site at line 343:**

```
old_string:      .then((resultsMarkup) => {
        if (!resultsMarkup || abortController.signal.aborted) return;
        morph(predictiveSearchResults, resultsMarkup);
        this.#updateFooter();
        // ↓↓↓ Cap total text suggestions to 4 across all groups
        this.#limitTextSuggestions();
new_string:      .then((resultsMarkup) => {
        if (!resultsMarkup || abortController.signal.aborted) return;
        morph(predictiveSearchResults, resultsMarkup);
        // ↓↓↓ Cap total text suggestions to 4 across all groups
        this.#limitTextSuggestions();
```

**Edit B — remove call site at line 474:**

```
old_string:    morph(predictiveSearchResults, parsedEmptySectionMarkup);
    this.#updateFooter();
    // In empty state there may be no text groups, but safe to run:
new_string:    morph(predictiveSearchResults, parsedEmptySectionMarkup);
    // In empty state there may be no text groups, but safe to run:
```

**Edit C — remove the method definition at lines 494-513:**

```
old_string:  /**
   * Update the persistent footer button text and href based on current results.
   */
  #updateFooter() {
    const footer = this.querySelector('.predictive-search-form__footer');
    if (!footer) return;
    const link = /** @type {HTMLAnchorElement | null} */ (footer.querySelector('.predictive-search__search-button'));
    if (!link) return;

    const resultsEl = this.refs.predictiveSearchResults.querySelector('#predictive-search-results');
    const terms = resultsEl?.dataset.searchTerms ?? '';

    if (terms) {
      link.href = `${Theme.routes.search_url}?q=${terms}&type=product`;
      link.textContent = 'VISA ALLA RESULTAT';
    } else {
      link.href = `${Theme.routes.search_url}?type=product`;
      link.textContent = 'VISA ALLA PRODUKTER';
    }
  }

new_string: (empty string)
```

Verify no other references remain:

```
Grep pattern: updateFooter
Grep path: /Users/ollepaulsson/MUG/assets/predictive-search.js
Grep output_mode: content
Grep -n: true
```

Expected: zero matches.

- [ ] **Step 7: Post-verify (all acceptance criteria)**

Hard-refresh preview. Re-open drawer. Verify:

**Empty state (no query typed):**
- No "VISA ALLA RESULTAT" link renders.
- No sticky footer.
- Recently-viewed products render as before (Task 2 unaffected).

**Query with results:**
- Exactly ONE "VISA ALLA RESULTAT" link renders — the inline one at the end of the scrollable results.
- No sticky footer, no gradient overlay.
- The inline link's href is `/search?q=<url-encoded-terms>` (no `&type=product`).
- Clicking the link navigates to `/search?q=...` which shows Shopify's default mixed-resource search page.

**Click-through test (the main bug this task fixes):**
- Click products in the top row → navigates.
- Click products in the middle rows → navigates.
- Click products in the **bottom row** (the row that was previously under the sticky gradient) → **navigates on every click**. Test at least 3 different cards in the bottom row to be sure.
- Click the "FÖRSLAG" rows (Task 4) → navigates.
- Click Pages/Collections/Articles rows → navigates.

**No-results state (query with 0 matches, e.g. "xyzzyz"):**
- No "VISA ALLA RESULTAT" link renders (the `{% if search_results_count > 0 %}` branch isn't entered, so the new link block never runs).
- The "no results" message renders normally.

**Mobile check (resize to ≤749px):**
- Drawer still opens full-screen.
- No sticky footer.
- Inline link appears at the bottom of the results.
- Click-through works for all product cards.

- [ ] **Step 8: Commit and push**

```bash
cd /Users/ollepaulsson/MUG
git add snippets/predictive-search.liquid sections/predictive-search.liquid assets/predictive-search.js
git commit -m "$(cat <<'EOF'
feat(search-drawer): replace sticky footer with inline view-all link

- Delete .predictive-search-form__footer markup in snippets/predictive-search.liquid.
- Delete .predictive-search-form__footer CSS in sections/predictive-search.liquid.
- Add inline <a class="button button-primary predictive-search__view-all-button">
  at the end of .predictive-search-results__inner, rendered only when
  search_results_count > 0. Href is {{ routes.search_url }}?q={{ terms }}
  (no &type=product) so it goes to Shopify's default search page showing
  all resource types — matches the drawer's content model.
- Remove #updateFooter() method and both call sites (lines 343, 474).
  The inline link is server-rendered via morph() on each keystroke, so
  the href stays in sync with predictive_search.terms without JS.

Side-effect: bottom-row products are now reliably clickable. The old
sticky footer used margin-top: -80px to overlap the last row with a
gradient fade; even with pointer-events: none, hit-testing could still
land on the footer's stacking context and swallow clicks intended for
cards underneath. Removing the overlap fixes this end-to-end.

Spec: docs/superpowers/specs/2026-04-21-search-drawer-refinements-design.md
EOF
)"
git push origin main
```

---

## Final end-to-end verification

After all 5 tasks are complete, walk through the full spec Success Criteria checklist (`docs/superpowers/specs/2026-04-21-search-drawer-refinements-design.md` → "Success criteria (full set)") on the preview theme:

1. [ ] No product text list above the grid
2. [ ] 9 product cards in 3×3 when search has ≥9 matches
3. [ ] No sticky/fixed footer anywhere
4. [ ] Exactly one inline "VISA ALLA RESULTAT" link at bottom of results (when ≥1 result), `/search?q=...` href
5. [ ] "FÖRSLAG" labeled list appears above Pages
6. [ ] No pill-shaped query suggestions
7. [ ] Thumbnails crisp on 3× DPR
8. [ ] Every product card clickable at every scroll position
9. [ ] Scroll top → inline link completes in a single natural gesture
10. [ ] Mobile UX visually and behaviorally identical

If any fail, document which criterion, which task introduced/didn't fix it, and escalate.

---

## Rollback procedure

Each task is a single commit on `main`. To roll back any individual task:

```bash
cd /Users/ollepaulsson/MUG
git log --oneline -10  # find the SHA of the task's commit
git revert <sha>
git push origin main
```

Tasks are ordered so later tasks do not strictly depend on earlier ones *except*:
- Task 5's click-through fix depends on Task 3 having removed the product textlist (otherwise there's still a tall sibling block above the scroll area that affects layout).

If reverting Task 3 while keeping Task 5, re-verify click-through manually — the interaction between the two has not been tested.
