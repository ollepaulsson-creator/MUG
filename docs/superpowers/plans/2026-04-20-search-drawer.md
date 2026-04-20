# Search-as-Right-Side-Drawer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the desktop predictive-search overlay from a centred drop-down to a right-anchored slide-in drawer at 750px wide with a 250ms ease-in-out slide. Mobile (≤749px) is unchanged.

**Architecture:** Re-skin the existing `<dialog-component id="search-modal">` by adding the `dialog-drawer` class to its inner `<dialog>`, replacing the custom close button with the predictive-search form's built-in one, and rewriting the desktop stylesheet block to mirror `.cart-drawer__dialog` geometry. Also strip two legacy `!important` blocks in `assets/custom.css` (a centred-modal override and a dead close-button hide) that would fight the new drawer. No JS changes.

**Tech Stack:** Shopify Horizon theme — Liquid snippets, `{% stylesheet %}` scoped CSS, existing `dialog-component` custom element (`assets/dialog.js`), existing `.dialog-drawer` keyframes (`assets/base.css`). No build step; edits deploy directly via Shopify CLI / theme sync.

**Spec:** @docs/superpowers/specs/2026-04-20-search-drawer-design.md

---

## Context for the implementer

This is a Shopify theme, not a Node/Python project. Consequences:

- **No automated test suite for this change.** Acceptance is visual/interaction verification in a browser. The spec's [Testing plan](../../superpowers/specs/2026-04-20-search-drawer-design.md#testing-plan) is the acceptance checklist.
- **Preview environment:** the user runs the theme locally (Shopify CLI preview) or via Shopify Admin → Preview theme. Do not push to production during implementation.
- **TDD adaptation:** Because there are no unit tests, each task's "test" is a concrete browser check — type this, click that, observe X. Do the browser check before committing.
- **File locations referenced below use the line numbers at the time the spec was written.** If a line has shifted, re-read the file to locate the block.

Files the implementation touches:

| File | Role |
|------|------|
| `snippets/search-modal.liquid` | Primary: markup + `<style>` + `{% stylesheet %}` all change |
| `assets/custom.css` | Remove lines 433–454 (legacy `!important` blocks) |

Files the implementation **reads from** but does not modify:

- `snippets/cart-drawer.liquid` — reference for drawer behaviour
- `snippets/header-actions.liquid` — reference for `.cart-drawer__dialog` CSS pattern
- `snippets/predictive-search.liquid` — provides the form header, built-in close button, focus-on-open script
- `sections/predictive-search.liquid:296–306` — cross-file `.search-modal` rules we override (not edit)
- `assets/dialog.js` — handles `showDialog`/`closeDialog`/`.dialog-closing` toggle
- `assets/base.css` — provides `.dialog-drawer` animation rules and `slideInLeft`/`slideOutLeft` keyframes

---

## Task 1: Remove legacy `!important` overrides in `assets/custom.css`

**Rationale:** `custom.css` currently contains two blocks (lines 433–449 and 451–454) that target `.search-modal__content` and `.search-modal__close`. The first uses `!important` to pin the modal centred on the page with `position: fixed; top: 20%; left: 50%; transform: translate(-50%, -50%); width: 50%; max-width: 1000px; height: 100%; max-height: 73%; border-radius: 10px; box-shadow: ...`. The second hides the custom close button on mobile. Both belong to the older centred-modal design and will conflict with the drawer geometry we're adding in Task 2. Removing them first keeps Task 2's diff focused.

**Intermediate state warning:** After this commit but before Task 2 is committed, the search modal will render at `width: 72%; top: 310px; max-height: calc(100dvh - 320px)` (the rules inside `snippets/search-modal.liquid` take over with the `!important` block gone). It's still usable, just visually transitional. Do not deploy to production between Task 1 and Task 2.

**Files:**
- Modify: `assets/custom.css` lines 433–454

### Steps

- [ ] **Step 1: Re-read the block to confirm line numbers**

Run: `Grep -n "search-modal" assets/custom.css` (or use the editor's Grep tool).

Expected output: matches at lines 434 and 452. If the line numbers have shifted since the spec was written, adjust the range in Step 2 accordingly — the goal is to delete the `@media(min-width: 789px)` block containing `.search-modal__content` with `!important` rules, and the `@media (max-width: 768px)` block containing `button.search-modal__close { display: none; }`. Note that the `.media-fit-contain` rule inside the second `@media` block must be preserved (see Step 2).

- [ ] **Step 2: Delete the two blocks**

Open `assets/custom.css`. Delete lines 433–449 in full:

```css
@media(min-width: 789px){
      .search-modal__content {
      position: fixed !important;
      top: 20% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      width: 50% !important;
      max-width: 1000px !important;
      height: 100% !important;
      max-height: 73% !important;
      background: #fff;
      border-radius: 10px;
      overflow-y: auto;
      padding: 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      }
}
```

Then, inside the `@media (max-width: 768px)` block that starts at line 451, delete the three lines of `button.search-modal__close { display: none; }`. Keep the `.media-fit-contain` rule that follows inside the same `@media` block. The result should look like:

```css
@media (max-width: 768px){
.media-fit-contain :is(img, video, iframe, .deferred-media__poster-image) {
    object-fit: contain;
    width: 60% !important;
    height: 70% !important;
}
}
```

- [ ] **Step 3: Verify no other rules target `.search-modal__close` or `.search-modal__content` in `custom.css`**

Run: `Grep -n "search-modal" assets/custom.css`

Expected: no matches. If there are remaining matches, they were not in the spec's scope — stop and ask the user.

- [ ] **Step 4: Browser verification — modal still opens**

Start the Shopify local preview (`shopify theme dev` or equivalent). Open the storefront in a browser at desktop width (≥1024px).

- Click the header search icon.
- **Expected:** the modal opens. It will appear as a wide bar starting ~310px from the top at roughly 72% viewport width (this is the intermediate visual state — that's fine).
- Type a query → results render.
- Press Escape → modal closes.
- Open at mobile width (<750px) → modal still opens full-screen (unchanged).

If the modal does not open at all, or JavaScript errors appear in the console, stop and inspect — something outside the spec is going on.

- [ ] **Step 5: Commit**

```bash
git add assets/custom.css
git commit -m "$(cat <<'EOF'
Remove legacy !important overrides on .search-modal__content

The @media(min-width: 789px) block pinned the search modal centred
with !important rules; this conflicts with the drawer geometry being
added next. Also drop the now-dead .search-modal__close hide rule,
since the button itself is being deleted in the next commit.
EOF
)"
```

---

## Task 2: Convert `snippets/search-modal.liquid` to right-side drawer

**Rationale:** Single coherent edit: the markup gains the `dialog-drawer` class, the custom close button is deleted (the predictive-search form's built-in button takes over on desktop), and the stylesheet is rewritten to produce the drawer geometry, 250ms ease-in-out slide, sticky drawer-style header, and a full-height scrollable content area. Mobile is unchanged.

The file ends up simpler than it started: one `<style>` block disappears entirely (its rules conflicted with the drawer width), and the `{% stylesheet %}` block is reorganized into a clean mobile (`≤749px`) / desktop (`≥750px`) split.

**Files:**
- Modify: `snippets/search-modal.liquid` (full rewrite; content shown in Step 2)

### Steps

- [ ] **Step 1: Open the file for reference**

Read `snippets/search-modal.liquid` in full (221 lines as of the spec date). You'll overwrite this with the new content in Step 2. Before doing so, confirm three anchors still exist:

1. The `<dialog-component id="search-modal">` wrapper (near line 6).
2. The inner `<dialog class="search-modal__content dialog-modal search-bar--header">` element (near line 14).
3. The `{% render 'predictive-search', ... %}` call (near line 31).

If any of these have moved materially, stop and read the file again — the rewrite below assumes they exist in this form.

- [ ] **Step 2: Overwrite the file with the drawer version**

Replace the entire contents of `snippets/search-modal.liquid` with:

```liquid
<script
  src="{{ 'dialog.js' | asset_url }}"
  type="module"
></script>

<dialog-component
  id="search-modal"
  class="search-modal"
  {{ block.shopify_attributes }}
  style="max-width: 100% !important;"
>
  <dialog
    ref="dialog"
    class="search-modal__content dialog-modal dialog-drawer search-bar--header"
    scroll-lock
  >
    {% render 'predictive-search',
      input_id: 'cmdk-input',
      search_test_id: 'search-component--modal',
      products_test_id: 'products-list-default--modal'
    %}
  </dialog>
</dialog-component>

{% stylesheet %}

/* Hide Shopify's predictive search reset (cancel) button */
.predictive-search__reset-button {
  display: none !important;
}

/* Remove default browser cancel (X) in search inputs */
input[type="search"]::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
  display: none;
}
input[type="search"]::-ms-clear {
  display: none;
  width: 0;
  height: 0;
}

/* ---------- Search modal base vars ---------- */
.search-modal {
  --search-border-radius: var(--style-border-radius-popover);
  --search-border-width: var(--style-border-width);
}

.search-modal__button {
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-modal__content {
  padding: 0;
  border: var(--style-border-popover);
}

.search-modal__content[open] {
  display: flex;
}

.search-modal__content :is(.predictive-search-dropdown, .predictive-search-form__content-wrapper) {
  position: relative;
}

/* ---------- Mobile (≤749px) — unchanged behaviour from before ---------- */
@media screen and (max-width: 749px) {
  .search-modal__content::backdrop {
    display: none;
  }

  .search-modal__content.dialog-modal {
    width: 100%;
    max-width: 100%;
    border-radius: 0;
  }

  .dialog-modal[open].search-modal__content {
    transform-origin: bottom center;
    animation: search-element-slide-in-bottom 300ms var(--ease-out-quad) forwards;
    box-shadow: var(--shadow-popover);
  }

  .dialog-modal.search-modal__content.dialog-closing {
    animation: search-element-slide-out-bottom 200ms var(--ease-out-quad) forwards;
  }

  /* Reset-button divider line */
  .dialog-modal
    .predictive-search-form__header:has(
      .predictive-search__reset-button:not(.predictive-search__reset-button[hidden])
    )::before {
    content: '';
    position: absolute;
    right: calc(var(--padding-sm) + var(--minimum-touch-target));
    top: 0;
    bottom: 0;
    width: var(--border-width-sm);
    background-color: var(--color-border);
  }

  .dialog-modal
    .predictive-search-form__header:has(
      .predictive-search__reset-button:not(.predictive-search__reset-button[hidden])
    )
    > .predictive-search__close-modal-button {
    &::before {
      content: none;
    }
  }
}

/* ---------- Desktop (≥750px) — right-side slide-in drawer ---------- */
@media screen and (min-width: 750px) {
  /* 1. Drawer geometry — mirrors .cart-drawer__dialog, but 750px wide. */
  .search-modal__content.dialog-modal.search-bar--header {
    position: fixed;
    inset: 0 0 0 auto;
    width: 750px;
    max-width: 95vw;
    height: 100dvh;
    margin: 0 0 0 auto;
    padding: 0;
    border: 0;
    border-left: var(--style-border-drawer);
    box-shadow: var(--shadow-drawer);
    border-radius: 0;
    overflow: hidden;
    flex-direction: column;
    display: flex;
  }

  /* 2. Animation override — kill the mobile slide-from-bottom and pin the
     right-edge slide at 250ms ease-in-out. */
  .dialog-modal[open].search-modal__content {
    animation: none;
    transform-origin: initial;
  }

  .search-modal__content.dialog-drawer[open] {
    animation: slideInLeft 250ms ease-in-out forwards;
  }

  .search-modal__content.dialog-drawer.dialog-closing {
    animation: slideOutLeft 250ms ease-in-out forwards;
  }

  /* 3. Header composition — drawer-style heading row. Overrides the
     input-field styling that predictive-search.liquid:302-317 applies
     to .predictive-search-form__header by default. Unhide the form's
     built-in close button on desktop (predictive-search.liquid:505-507
     hides it at ≥750px). */
  .search-modal__content .predictive-search-form__header {
    padding: var(--padding-xl) var(--padding-2xl);
    position: sticky;
    top: 0;
    z-index: 1;
    background-color: var(--color-background);
    border: 0;
    border-bottom: var(--style-border-width) solid var(--color-border);
    border-radius: 0;
  }

  .search-modal__content .predictive-search__close-modal-button {
    display: flex;
  }

  /* 4. Scroll container — component + form fill the drawer as a flex
     column; content wrapper scrolls within remaining space. Overrides
     position:absolute from predictive-search.liquid:249, height:fit-content
     from sections/predictive-search.liquid:300, and max-height:var(--modal-max-height)
     from sections/predictive-search.liquid:306. */
  .search-modal__content predictive-search-component,
  .search-modal__content .predictive-search-form {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .search-modal__content .predictive-search-form__content-wrapper {
    position: static;
    flex: 1;
    min-height: 0;
    height: auto;
    max-height: none;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .search-modal__content .predictive-search-form__content {
    max-height: none;
    overflow: visible;
  }
}

{% endstylesheet %}
```

**What this replaces:**

| Gone | Why |
|------|-----|
| `<!-- Custom Close button (top right) -->` + `<button class="search-modal__close">✕</button>` (original lines 21–29) | Replaced by `.predictive-search__close-modal-button` from the form, unhidden at ≥750px via the new CSS block 3. |
| `<style>` block at original lines 39–53 (`width: 72% !important`) | Conflicted with `width: 750px` in the drawer geometry block. |
| `/* ---------- Modal Close Button ---------- */ @media(min-width:770px){ ... }` block (original lines 75–94) | Styled a button that no longer exists. |
| `.search-modal__content { --modal-top-margin: ...; --modal-width: 66dvw; ... @media screen and (min-width: 750px) { width: var(--modal-width); margin-block-start: var(--modal-top-margin); overflow: hidden; } }` (original lines 108–121) | Replaced by the drawer geometry block. |
| `.dialog-modal[open].search-modal__content { ... border-radius: ...; box-shadow: ...; ... }` (original lines 130–139) | Scoped to mobile in the new file; desktop gets its own drawer-specific animation and box-shadow. |
| `@media only screen and (max-width: 768px) { dialog.search-modal__content.dialog-modal.search-bar--header { width: 100% !important; } }` (original lines 180–184) | Subsumed by the `@media (max-width: 749px)` mobile block in the new file. |
| `@media only screen and (min-width: 769px) { dialog.search-modal__content.dialog-modal.search-bar--header { top: 310px !important; max-height: calc(100dvh - 320px) !important; ... } ... }` (original lines 186–217) | Replaced by the drawer geometry + flex-column rules in the `@media screen and (min-width: 750px)` block. Breakpoint normalized from 769 → 750. |

- [ ] **Step 3: Browser verification — desktop drawer**

Open the storefront in a desktop browser (≥1024px wide).

1. Click the header search icon.
   - **Expected:** drawer slides in from the right edge at 750px wide, taking 250ms with a smooth ease-in-out feel.
2. Look at the top of the drawer.
   - **Expected:** the search input sits inside a sticky header bar with generous padding (`var(--padding-xl) var(--padding-2xl)`), a close ✕ button on its right, and a thin bottom border separating it from the content area.
   - **Expected:** the header does NOT look like a rounded input field (no `border-radius`, no input background colour). If it does, the override of `.predictive-search-form__header` in CSS block 3 isn't applying — re-check the selector.
3. Type `el` into the search box.
   - **Expected:** suggestions / results render below the sticky header; the results area is scrollable; the header stays pinned at top while scrolling.
   - **Expected:** the "VISA ALLA PRODUKTER" footer appears, pinned at the drawer bottom, and is clickable.
4. Press Escape.
   - **Expected:** drawer slides out to the right over 250ms.
5. Open again, click outside the drawer (on the backdrop).
   - **Expected:** drawer closes.
6. Open again, check focus.
   - **Expected:** search input is auto-focused.
7. Scroll the page down ~2000px, then open the drawer.
   - **Expected:** drawer opens; page behind is scroll-locked (body doesn't scroll when you scroll over the backdrop).
   - Close the drawer. **Expected:** page scroll position is restored to where you were.

If any of the above fails, stop and debug before proceeding. Common failure modes:
- Drawer animates from the wrong edge: check that you did NOT add `dialog-drawer--right` — bare `dialog-drawer` is correct because `slideInLeft` goes `translateX(100%) → 0`.
- Two close buttons visible: the old `<button class="search-modal__close">` wasn't fully deleted from the markup.
- Drawer full-width on desktop: the old `width: 72% !important` `<style>` block wasn't removed, or Task 1's `custom.css` cleanup didn't land.
- Content area doesn't scroll: check that `.search-modal__content .predictive-search-form__content-wrapper { height: auto; max-height: none }` applies. Inspect in devtools for an overriding rule from `sections/predictive-search.liquid`.

- [ ] **Step 4: Browser verification — mobile unchanged**

Resize the browser to <750px width (or use devtools mobile emulation).

1. Click the header search icon.
   - **Expected:** modal opens full-screen from the bottom with the original slide-up animation.
   - **Expected:** mobile close button is visible at top-right.
2. Type a query → results render.
3. Close with the X button.
   - **Expected:** slides out to the bottom.

This should be identical to the current (pre-change) mobile behaviour.

- [ ] **Step 5: Browser verification — cart drawer regression check**

Still on desktop:

1. Click the cart icon.
   - **Expected:** cart drawer slides in from the right, same as before. Its width (25rem = 400px), animation speed, and close button behaviour must be unchanged.
2. Close the cart drawer.
3. Open the search drawer.
   - **Expected:** search drawer is visibly wider (750px vs cart's 400px) and slides at 250ms (feel-test: a touch faster/snappier than the cart's animation).

If the cart drawer behaviour is altered, something leaked outside the `.search-modal__content` selector. Inspect.

- [ ] **Step 6: Theme-editor smoke check**

Open the Shopify theme editor (storefront URL with `?preview_theme_id=...` or Admin → Themes → Customize).

1. Confirm the `search-modal` block is listed and selectable in the editor's block tree.
2. Confirm its settings (color scheme etc.) are still editable.

If the block has disappeared from the editor, the `block.shopify_attributes` injection may have been disrupted.

- [ ] **Step 7: Commit**

```bash
git add snippets/search-modal.liquid
git commit -m "$(cat <<'EOF'
Convert search overlay to right-side slide-in drawer

Add dialog-drawer class to the inner <dialog>, remove the custom close
button in favour of the predictive-search form's built-in one, and
rewrite the desktop stylesheet block to mirror .cart-drawer__dialog
geometry at 750px wide with a hard-coded 250ms ease-in-out right-edge
slide. Mobile (≤749px) behaviour is preserved.

Spec: docs/superpowers/specs/2026-04-20-search-drawer-design.md
EOF
)"
```

---

## Post-implementation

- [ ] **Final regression sweep.** Visit, in desktop and mobile:
  - Home page
  - A collection page
  - A product page
  - The search results page (`/search?q=elgitarr`)

  On each, open the search drawer, type something, close it. Look for any visual glitch in the drawer OR in the underlying page after closing.

- [ ] **Cart regression second pass.** Open and close the cart on all four page types above. Confirm no change in its geometry or animation.

- [ ] **Push.** Once verification passes, push the branch / deploy the theme version per the user's normal workflow.

---

## Rollback

If something breaks in production:

```bash
git revert <task-2-sha> <task-1-sha>
```

Both commits are self-contained; reverting both returns the theme to the pre-change state.
