# Search as a Right-Side Slide-In Drawer

**Date:** 2026-04-20
**Project:** MUG (mug.se) — Shopify Horizon theme

---

## Overview

Move the desktop predictive-search overlay from a centred "drop-down" modal to a right-side slide-in drawer that mirrors the cart drawer's UX: same width, same height, same open/close animation, same close-button placement. The search input replaces the cart's title slot at the top of the drawer. Mobile behaviour is unchanged.

---

## Goals

- On viewports ≥750px, open the search as a right-anchored drawer that slides in from the right edge (same animation as the cart).
- Drawer geometry (width, height, border, shadow, padding rhythm) matches `.cart-drawer__dialog`.
- The search input sits where the cart drawer's heading sits — at the top of the drawer, sticky, with a close button on its right.
- Desktop experience becomes visually and behaviourally close to the current mobile search (sticky search header at top, results scroll below).

## Non-goals

- Mobile (≤749px) is **not** changed. The existing full-screen dialog experience stays exactly as today.
- No new JS custom element, no new JS file. All behaviour is reached by re-skinning existing markup + reusing existing animation classes.
- Color scheme stays on `settings.popover_color_scheme` (unchanged). Not switched to `drawer_color_scheme`.
- Theme-editor block registration is unchanged (`.search-modal` class and `id="search-modal"` preserved).

---

## Architecture (Approach 1 — in-place edit)

Primary changes in **`snippets/search-modal.liquid`** (markup + stylesheet).

Secondary cleanup in **`assets/custom.css`** to remove legacy `!important` overrides that would fight the new drawer geometry (see *Files that must change* below). Aside from this cleanup, no other stylesheet is touched.

The existing structure is kept:

```liquid
<dialog-component id="search-modal" class="search-modal" ...>
  <dialog ref="dialog" class="search-modal__content dialog-modal ..." scroll-lock>
    {%- render 'predictive-search', ... -%}
  </dialog>
</dialog-component>
```

The existing `<dialog-component>` (from `assets/dialog.js`) continues to handle `showDialog`/`closeDialog`, body scroll-lock, outside-click dismissal, and Escape key. On close, `dialog.js` adds `.dialog-closing` (verified: `assets/dialog.js:76`). We layer drawer styling and animation on top of this existing behaviour.

Why this works without a new component: `dialog-component` already calls `dialog.showModal()` and toggles `.dialog-closing` for exit. The drawer animation in `assets/base.css:1249–1266` is already keyframed against `.dialog-drawer[open]` (opening) and `.dialog-drawer.dialog-closing` (closing). Adding the `dialog-drawer` class to the existing `<dialog>` at desktop is therefore enough to get the right slide animation without any JS changes.

### Animation direction — confirmed correct

The bare `.dialog-drawer` class (no `--right` modifier) uses the `slideInLeft`/`slideOutLeft` keyframes. Those keyframes (`assets/base.css:2810` and `2846`) are:

```css
@keyframes slideInLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes slideOutLeft { from { transform: translateX(0); } to { transform: translateX(100%); } }
```

Starting at `translateX(100%)` and ending at `0`, combined with `inset: 0 0 0 auto` pinning the dialog to the right edge, produces a slide-in from the right edge — the same visual behaviour as the cart drawer, which also uses bare `.dialog-drawer` (`snippets/cart-drawer.liquid:34`). No `dialog-drawer--right` modifier needed.

---

## Markup changes

Three edits inside `snippets/search-modal.liquid`:

1. **Add `dialog-drawer` to the inner `<dialog>`**. New class list:
   ```
   search-modal__content dialog-modal dialog-drawer search-bar--header
   ```
   The `dialog-drawer` class is harmless on mobile — it only sets two animation-name CSS variables (`--dialog-drawer-opening-animation`, `--dialog-drawer-closing-animation`). On mobile, our existing `search-element-slide-in-bottom` animation rule wins via its own `≤749px` media query (higher specificity + later in cascade).

2. **Remove the custom top-right close button**:
   ```html
   <button class="search-modal__close" ...>✕</button>
   ```
   It becomes redundant once the predictive-search form's built-in `.predictive-search__close-modal-button` is unhidden on desktop (see CSS below). One close button, one code path. The built-in button calls `on:click="dialog-component/closeDialog"` (`snippets/predictive-search.liquid:88`), which resolves to the same `<dialog-component id="search-modal">` wrapper — confirmed to work.

3. **Keep `scroll-lock` and the rest of the predictive-search rendering as-is.** The inline focus-on-open script at the bottom of `snippets/predictive-search.liquid` continues to work because the dialog element still receives `[open]` and still adds `.dialog-closing` on exit, which the script watches via `MutationObserver` + `transitionend`.

No new wrappers, no new elements, no new attributes beyond the one class token.

---

## Files that must change

| File | Change | Why |
|------|--------|-----|
| `snippets/search-modal.liquid` | Markup + stylesheet edit (see below) | Primary drawer conversion |
| `assets/custom.css` lines 433–449 | **Remove** the `@media(min-width: 789px) { .search-modal__content { ... !important ... } }` block | Existing `!important` rules set `position: fixed; top: 20%; left: 50%; transform: translate(-50%, -50%); width: 50%; max-width: 1000px; height: 100%; max-height: 73%; border-radius: 10px; box-shadow: ...` — these would fight the drawer geometry on desktop. They are a leftover from an older centred-modal design and are now dead weight. |
| `assets/custom.css` lines 451–454 | **Remove** `@media (max-width: 768px) { button.search-modal__close { display: none; } }` | The `.search-modal__close` button itself is being deleted (markup change #2), so the selector has nothing to target. |

Everything else stays untouched.

---

## CSS strategy

All new CSS lives inside the existing `{% stylesheet %}` and `<style>` blocks in `search-modal.liquid`. Split cleanly by viewport:

### ≤749px (mobile) — no functional change

The existing rules remain:
- Dialog opens via `search-element-slide-in-bottom` (unchanged keyframe).
- Width 100%, border-radius 0, hidden UA `::backdrop`.
- `.predictive-search__close-modal-button` already visible here; no change.

No change required in the mobile block.

### ≥750px (desktop) — new work

**Breakpoint normalization.** The existing file uses `768px`/`769px` mobile-desktop splits. The rest of the theme (including cart drawer, predictive-search internals) uses `749px`/`750px`. We adopt `749px`/`750px` throughout `search-modal.liquid` to match.

Four CSS blocks to add, structured like `.cart-drawer__dialog`.

**1. Drawer geometry** — replaces the current desktop dropdown block (`top: 310px`, `72% width`, `max-height: calc(100dvh - 320px)`, etc.):

```css
@media screen and (min-width: 750px) {
  .search-modal__content.dialog-modal.search-bar--header {
    position: fixed;
    inset: 0 0 0 auto;                 /* pin to right edge */
    width: 750px;                       /* wider than cart (--sidebar-width = 25rem) */
    max-width: 95vw;                    /* safety net on narrow tablet widths */
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
}
```

No new CSS variables. `--style-border-drawer` and `--shadow-drawer` are already theme-global (same variables used by the cart drawer). The width is an explicit `750px` rather than `var(--sidebar-width)` — intentional deviation from the cart to give the search results area more room. On viewports <790px the `max-width: 95vw` caps the drawer so it never crowds the edge; on viewports ≥790px the drawer is a fixed 750px, leaving the rest of the page visible behind the backdrop.

**2. Animation override** — stop the desktop dialog from running `search-element-slide-in-bottom` and let the `.dialog-drawer[open]` rule (from `base.css:1260–1262`, using `slideInLeft` → right-edge slide) take over:

```css
@media screen and (min-width: 750px) {
  .dialog-modal[open].search-modal__content {
    /* unset the mobile slide-from-bottom animation on desktop */
    animation: none;
    transform-origin: initial;
  }
  /* .dialog-drawer[open] rule in base.css now applies, using the
     theme's --drawer-animation-speed and --animation-easing vars. */
}
```

Closing already works out of the box because `dialog.js` adds `.dialog-closing` and `.dialog-drawer.dialog-closing` is keyframed in `base.css:1264–1266`.

**3. Header composition** — re-skin `.predictive-search-form__header` inside the drawer so the search input sits at the cart heading's padding rhythm, sticks to the top during scroll, and exposes the form's own close button. Also **unset the existing input-box styling** that `predictive-search.liquid:302–317` applies to this element (it currently has `background-color: var(--color-input-background)`, a full `border`, `border-radius: var(--style-border-radius-inputs)`, and `border-bottom: 1px solid #D3D3D3` — all of which would make the drawer header look like a rounded input field rather than a drawer heading bar):

```css
@media screen and (min-width: 750px) {
  .search-modal__content .predictive-search-form__header {
    /* inline the cart's desktop padding rhythm; var(--cart-drawer-padding-desktop)
       is scoped inside .cart-drawer and does NOT resolve here (verified:
       snippets/header-actions.liquid:31). */
    padding: var(--padding-xl) var(--padding-2xl);
    position: sticky;
    top: 0;
    z-index: 1;

    /* override the input-field styling inherited from predictive-search.liquid */
    background-color: var(--color-background);
    border: 0;
    border-bottom: var(--style-border-width) solid var(--color-border);
    border-radius: 0;
  }

  .search-modal__content .predictive-search__close-modal-button {
    display: flex;
  }
}
```

The search input sits inside the sticky header; the form's built-in close button sits to its right (it already has `margin-inline-start: var(--margin-sm)` from `predictive-search.liquid:490`). Everything below (suggestions list, results grid, "Visa alla produkter" footer) flows and scrolls below the sticky header, matching how `.cart-drawer__content` scrolls under its sticky header.

**4. Scroll container and cross-file overrides** — two cross-file rules currently cap the search content area assuming the old dropdown geometry and must be overridden for the full-height drawer:

- `sections/predictive-search.liquid:300`: `@media (min-width: 750px) { .search-modal .predictive-search-form__content-wrapper { height: fit-content; } }`
- `sections/predictive-search.liquid:306`: `.search-modal .predictive-search-form__content { max-height: var(--modal-max-height); }` (65dvh)

Both assume a short dropdown. For the drawer, the content wrapper should fill the remaining flex height below the sticky header, and the content inside should scroll within that. Override inside `search-modal.liquid`'s desktop block:

```css
@media screen and (min-width: 750px) {
  /* Component and form fill dialog height as flex column (keep existing rules,
     normalize breakpoint from 769px to 750px) */
  .search-modal__content predictive-search-component,
  .search-modal__content .predictive-search-form {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  /* Content wrapper takes remaining space and scrolls.
     Override position:absolute from base, height:fit-content from
     sections/predictive-search.liquid:300, and let it fill the flex column. */
  .search-modal__content .predictive-search-form__content-wrapper {
    position: static;
    flex: 1;
    min-height: 0;
    height: auto;
    max-height: none;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* Content fills wrapper height; override max-height from
     sections/predictive-search.liquid:306. */
  .search-modal__content .predictive-search-form__content {
    max-height: none;
    overflow: visible;
  }
}
```

These rules are a 1:1 replacement for the flex-column block currently at `snippets/search-modal.liquid:194–217` plus the two additional overrides for `height` and `max-height`.

---

## Edge cases & compatibility

- **Theme editor** — `assets/theme-editor.js` targets `.search-modal` by class/id. Unchanged, editor continues to find and manipulate the block.
- **Trigger** — `snippets/search.liquid`'s `on:click="#search-modal/showDialog"` still resolves to the same `<dialog-component id="search-modal">`. Unchanged.
- **`scroll-lock`** — kept. `dialog.js` fixes `document.body` on open and restores scroll on close independently of the `scroll-lock` attribute (the attribute drives a separate `toggle` listener path). Both paths continue to work for the drawer the same way they do today for the modal.
- **`showModal()` centring** — the UA default centres dialog elements. The cart drawer overrides this with `position: fixed; inset: 0 0 0 auto; margin: 0 0 0 auto`; our block 1 copies the same overrides so the drawer pins right rather than centring.
- **Backdrop** — the UA dialog `::backdrop` is already styled by `.dialog-modal::backdrop { backdrop-filter: brightness(1); }` in `base.css:1225`, which applies to both the cart drawer and the search modal/drawer because both carry the `dialog-modal` class. Existing mobile rule that hides the backdrop at ≤749px is kept. No extra work needed on desktop — backdrop matches cart drawer automatically.
- **Focus on open** — the focus-on-open script at the bottom of `snippets/predictive-search.liquid` keeps working because the dialog still emits `[open]` and toggles `.dialog-closing`, which the script watches.
- **`/` keyboard shortcut, Escape to close** — unchanged; handled by existing predictive-search + dialog code.
- **"Visa alla produkter" footer** — `.predictive-search-form__footer` is `position: absolute; bottom: 0` inside `.predictive-search-form` (which is `position: relative`). In the drawer, the form now fills the full drawer height (flex: 1), so the footer pins to the bottom of the drawer. Current show/hide logic (based on whether results exist) still works.
- **Color scheme** — `settings.popover_color_scheme` stays (Decision A from brainstorming; smaller blast radius; not switched to `drawer_color_scheme`).

---

## Risks & open questions

- **`--drawer-animation-speed` availability at the search dialog's cascade root.** `.dialog-drawer[open]` uses `var(--drawer-animation-speed)` and `var(--animation-easing)`. These are theme-global. If either fails to resolve inside `.search-modal__content` (unlikely but possible), the keyframe falls back to the browser default (0s = instant). Verification step during implementation: open the drawer and confirm the slide animation runs at the same duration as the cart drawer.

- **Cart drawer regression risk.** We do not touch `snippets/cart-drawer.liquid`, `snippets/header-actions.liquid`, or the `.dialog-drawer*` rules in `assets/base.css`. The only shared touchpoint is that both drawers now use the bare `.dialog-drawer` class from `base.css`. Verification step: after the change, open and close the cart drawer and confirm its animation is unchanged.

- **`custom.css:433–449` removal.** This block is `!important`-heavy and targets `.search-modal__content` globally. Grep confirms it is the only place those rules live (no other selector depends on them). Removing it is safe for the drawer conversion but should be verified by a visual pass of any page that opens the search (home, collection, product, search results).

- **Stale skin on the `.predictive-search-form__header-inner`.** At ≥750px, `predictive-search.liquid:301` already sets `border: 0` on `.dialog-modal .predictive-search-form__header-inner`. Good — the inner input wrapper will render borderless against our new transparent header. No additional override needed.

---

## Testing plan

Manual verification on a staging preview (Shopify admin → Preview theme):

1. **Desktop ≥1024px**
   - Click header search icon → drawer slides in from right edge.
   - Drawer is 750px wide (intentionally wider than the cart drawer, which stays at `--sidebar-width: 25rem`), capped by `max-width: 95vw` on narrower viewports.
   - Slide-in duration matches cart drawer (both use `--drawer-animation-speed`).
   - Close button (predictive-search's built-in) is visible top-right and closes the drawer.
   - Escape key closes the drawer.
   - Click outside the drawer closes it.
   - Search input is auto-focused on open.
   - Type a query → results render below the sticky search header; results area scrolls; header stays pinned.
   - "Visa alla produkter" footer appears after typing, is pinned to drawer bottom, and is clickable.
   - Open cart drawer → still works, still slides from right, unchanged duration and easing.
2. **Tablet 750–1023px**
   - Same behaviour as desktop.
3. **Mobile ≤749px**
   - Open/close animation, layout, close button — all identical to current behaviour (visual regression check).
4. **Theme editor**
   - Open the theme editor → confirm the search-modal block is still listed and selectable.
5. **Page scroll restoration**
   - Scroll down a long page → open drawer → close → body scroll position is restored (existing `dialog.js` behaviour).
6. **Cart drawer regression**
   - Open cart drawer → confirm animation, width, and close button behaviour are unchanged from before this feature.
