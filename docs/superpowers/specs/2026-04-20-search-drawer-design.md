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

One file changes: **`snippets/search-modal.liquid`**.

The existing structure is kept:

```liquid
<dialog-component id="search-modal" class="search-modal" ...>
  <dialog ref="dialog" class="search-modal__content dialog-modal ..." scroll-lock>
    {%- render 'predictive-search', ... -%}
  </dialog>
</dialog-component>
```

The existing `<dialog-component>` (from `assets/dialog.js`) continues to handle `showDialog`/`closeDialog`, body scroll-lock, outside-click dismissal, and Escape key. We layer drawer styling and animation on top of it.

Why this works without a new component: `dialog-component` already calls `dialog.showModal()` and toggles a `.dialog-closing` class for exit. The drawer animation in `base.css` is already keyframed against `.dialog-drawer[open]` (open) and `.dialog-drawer.dialog-closing` (close). Adding the `dialog-drawer` class to the existing `<dialog>` at desktop is therefore enough to get the right slide animation without any JS changes.

---

## Markup changes

Three edits inside `snippets/search-modal.liquid`:

1. **Add `dialog-drawer` to the inner `<dialog>`**. New class list:
   ```
   search-modal__content dialog-modal dialog-drawer search-bar--header
   ```
   The `dialog-drawer` class is harmless on mobile — it only sets two animation-name CSS variables. Mobile's `search-element-slide-in-bottom` animation is applied in a ≤749px media query and wins on mobile via its own rule.

2. **Remove the custom top-right close button**:
   ```html
   <button class="search-modal__close" ...>✕</button>
   ```
   It becomes redundant once the predictive-search form's built-in `.predictive-search__close-modal-button` is unhidden on desktop (see CSS below). One close button, one code path.

3. **Keep `scroll-lock` and the rest of the predictive-search rendering as-is.** The inline focus-on-open script at the bottom of `snippets/predictive-search.liquid` continues to work because the dialog element still receives `[open]` and still adds `.dialog-closing` on exit, which the script watches via `MutationObserver` + `transitionend`.

No new wrappers, no new elements, no new attributes beyond the one class token.

---

## CSS strategy

All CSS lives inside the existing `{% stylesheet %}` and `<style>` blocks in `search-modal.liquid`. Split cleanly by viewport:

### ≤749px (mobile) — no functional change

The existing rules remain:
- Dialog opens via `search-element-slide-in-bottom` (unchanged keyframe).
- Width 100%, border-radius 0, hidden UA `::backdrop`.
- `.predictive-search__close-modal-button` already visible here; no change.

Only adjustment: the rule that hides `.predictive-search__close-modal-button` at `min-width: 750px` gets removed/flipped so the close button is visible on desktop too.

### ≥750px (desktop) — new work

Three CSS blocks to add, structured like `.cart-drawer__dialog`.

**1. Drawer geometry** — replaces the current desktop dropdown block (`top: 310px`, `72% width`, `max-height: calc(100dvh - 320px)`, etc.):

```css
@media screen and (min-width: 750px) {
  .search-modal__content.dialog-modal.search-bar--header {
    position: fixed;
    inset: 0 0 0 auto;                 /* pin to right edge */
    width: var(--sidebar-width);        /* same variable as cart */
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
}
```

No new CSS variables. `--sidebar-width`, `--style-border-drawer`, `--shadow-drawer` are already defined in the theme and used by the cart drawer.

**2. Animation override** — stop the desktop dialog from running `search-element-slide-in-bottom` and let the `.dialog-drawer[open]` keyframe (from `base.css`, `slideInLeft`, `translateX(100%) → 0`) take over. Because the drawer is pinned right, that keyframe visually slides in from the right edge:

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

Closing already works out of the box because `dialog.js` adds `.dialog-closing` and `.dialog-drawer.dialog-closing` is keyframed in `base.css`.

**3. Header composition** — re-skin `.predictive-search-form__header` inside the drawer so the search input sits at the cart heading's padding rhythm, sticks to the top during scroll, and exposes the form's own close button:

```css
@media screen and (min-width: 750px) {
  .search-modal__content .predictive-search-form__header {
    padding: var(--cart-drawer-padding-desktop);
    position: sticky;
    top: 0;
    background: var(--color-background);
    border-bottom: var(--style-border-width) solid var(--color-border);
    z-index: 1;
  }
  .search-modal__content .predictive-search__close-modal-button {
    display: flex;
  }
}
```

The search input sits inside the sticky header; the form's built-in close button sits to its right. Everything below (suggestions list, results grid, "Visa alla produkter" footer) flows and scrolls below the sticky header, matching how `.cart-drawer__content` scrolls under its sticky header.

**4. Scroll container** — the existing rules at the bottom of `search-modal.liquid` (which already flex-fill the remaining height inside `.predictive-search-form__content-wrapper`) stay as-is. Those rules continue working because the dialog is now full viewport height, so the flex column behaves as intended.

---

## Edge cases & compatibility

- **Theme editor** — `assets/theme-editor.js:180` targets `.search-modal` by class/id. Unchanged, editor continues to find and manipulate the block.
- **Trigger** — `snippets/search.liquid`'s `on:click="#search-modal/showDialog"` still resolves to the same `<dialog-component id="search-modal">`. Unchanged.
- **`scroll-lock`** — kept. `dialog.js` continues to fix `document.body` on open and restore scroll on close for the drawer the same way it does today for the modal.
- **`showModal()` centring** — the UA default centres dialog elements. The cart drawer already overrides this with `position: fixed; inset: 0 0 0 auto; margin: 0 0 0 auto`; we copy the same overrides so the drawer pins right rather than centring.
- **Backdrop** — the UA dialog `::backdrop` shows by default on desktop (no `display: none` rule applies at ≥750px), matching cart behaviour. No extra work.
- **Focus on open** — the focus-on-open script at the bottom of `snippets/predictive-search.liquid` keeps working because the dialog still emits `[open]` and toggles `.dialog-closing`, which the script watches.
- **`/` keyboard shortcut, Escape to close** — unchanged; handled by existing predictive-search + dialog code.
- **"Visa alla produkter" footer** — current rules hide/show it based on whether results are present. Still works; it sits inside the scrollable content, no changes needed.
- **Color scheme** — `settings.popover_color_scheme` stays. Decision A from brainstorming (smaller blast radius; not switched to `drawer_color_scheme`).

---

## Risks & open questions

- **Animation variable reuse**: `.dialog-drawer[open]` uses `var(--drawer-animation-speed)` (defined by the theme). If that variable is not defined at the search modal's cascade root, the keyframe falls back to the browser default (0s). Verification step during implementation: confirm the variable resolves inside `.search-modal__content` (if not, copy `--drawer-animation-speed` onto `.search-modal` or the dialog).
- **Cascade collision with `slideInLeft` / `slideOutLeft` in `assets/custom.css`**: there are existing overrides in `custom.css` (lines ~4372–4397) that set `transform: translateX(-100%)` on base `.dialog-drawer:not(.dialog-drawer--right)` and `transform: translateX(100%)` on `.dialog-drawer--right`. The cart drawer (base, no `--right`) relies on these. Adding our drawer in the same family means we should not append `--right`; the base behaviour already slides from the right when combined with the theme's right-anchored geometry. Verification step: confirm cart still opens/closes correctly after the change (nothing should regress since we don't touch `custom.css`).
- **Desktop `top: 310px` / `max-height` overrides**: the existing block at the very end of `search-modal.liquid` (the `@media (min-width: 769px)` block) explicitly sets `top: 310px; max-height: calc(100dvh - 320px)`. Those rules must be removed or scoped away — leaving them in would fight the drawer geometry. This is part of the desktop CSS replacement.

---

## Testing plan

Manual verification on a staging preview (Shopify admin → Preview theme):

1. **Desktop ≥1024px**
   - Click header search icon → drawer slides in from right edge.
   - Drawer width matches the cart drawer visually.
   - Close button (predictive-search's built-in) is visible top-right and closes the drawer.
   - Escape key closes the drawer.
   - Click outside the drawer closes it.
   - Search input is auto-focused on open.
   - Type a query → results render below the sticky search header; results area scrolls; header stays pinned.
   - "Visa alla produkter" footer appears after typing and is clickable.
   - Open cart → still works, still slides from right.
2. **Tablet 750–1023px**
   - Same behaviour as desktop.
3. **Mobile ≤749px**
   - Open/close animation, layout, close button — all identical to current behaviour (visual regression check).
4. **Theme editor**
   - Open the theme editor → confirm the search-modal block is still listed and selectable.
5. **Page scroll restoration**
   - Scroll down a long page → open drawer → close → body scroll position is restored (existing `dialog.js` behaviour).
