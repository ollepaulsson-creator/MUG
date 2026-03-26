# Error Pages Design — 404

**Date:** 2026-03-26
**Scope:** 404 error page only (Shopify does not support custom 500-level error templates)

---

## Overview

Redesign the 404 error page for the MUG Shopify theme to match the approved mockup: a clean, centered layout with breadcrumb navigation, a vintage polaroid-style image, a Swedish h1 heading, and a body paragraph linking back to the start page.

---

## Layout

- **Header** and **Footer** — rendered by the existing theme layout (`theme.liquid`), no changes
- **Breadcrumb** — `Start / 404`, rendered by the existing `sections/breadcrumbs.liquid`
- **Main content** — centered flex-column: image → h1 → body paragraph

---

## Files Changed

### 1. `sections/breadcrumbs.liquid`

Two targeted edits:

**a) Remove 404 from the exclusion condition (line 45):**

Before:
```liquid
{%- unless template == 'index' or template == 'cart' or template == 'list-collections' or template == '404' -%}
```
After:
```liquid
{%- unless template == 'index' or template == 'cart' or template == 'list-collections' -%}
```

**b) Add a `when '404'` case in the template switch (before the `{%- else -%}` fallback):**
```liquid
{%- when '404' -%}
  <li class="breadcrumbs__item">
    <span class="breadcrumbs__link" aria-current="page">404</span>
  </li>
```

A `<span>` is used (not an `<a>`) because this is a non-navigable current-page crumb — linking to the 404 URL itself has no utility and `request.path` on a 404 page resolves to the broken URL, not `/404`.

---

### 2. `sections/main-404.liquid`

Full rewrite as a static, hardcoded section. The existing block-based structure (using `{% content_for 'blocks' %}`, `layout-panel-flex`, and admin settings) is replaced because the mockup is a fixed design and admin configurability is explicitly out of scope for this page.

**Structure** (Shopify applies `section-wrapper` automatically via the schema `class` field):
```html
<section>                          <!-- schema class="section-wrapper" applied by Shopify -->
  <div class="error-page">
    <div class="error-page__inner">
      <div class="error-page__image">
        <img src="{{ 'mug-404.jpg' | asset_url }}" alt="MUG skylt" width="500">
      </div>
      <h1>Här blev det fel! – Sidan saknas (404)</h1>
      <p>Sidan du letar efter verkar saknas. Använd vår navigering ovan eller
        <a href="{{ routes.root_url }}">klicka här</a> för att återgå till startsidan.
      </p>
    </div>
  </div>
</section>
```

**Styles (via `{% stylesheet %}`, consistent with other sections in this theme):**
- `.error-page` — `padding-block: 80px; padding-inline: var(--page-margin, 40px); max-width: var(--normal-page-width, 1400px); margin-inline: auto` (horizontal centering via CSS custom properties — the `page-width-*` class system only works inside `.section` grid elements)
- `.error-page__inner` — `display: flex; flex-direction: column; align-items: center; text-align: center; gap: 24px`
- `.error-page__image` — `max-width: 500px; width: 100%`
- `.error-page__image img` — `width: 100%; height: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.12)`
- `.error-page__inner h1` — inherits theme typography; scoped to avoid affecting other pages
- `.error-page__inner p` — `max-width: 600px`; scoped to avoid affecting other pages
- `.error-page__inner a` — inherits theme link styles (underline)

**Schema:** minimal — name and class only, no settings.

---

### 3. `templates/404.json`

Two changes:
1. Remove the `product_list_iA96Tq` section (not in the mockup)
2. Add the breadcrumbs section with `home_label` set to `"Start"` (the schema default is `"Home"` — must be set explicitly)

Result:
```json
{
  "sections": {
    "breadcrumbs": {
      "type": "breadcrumbs",
      "settings": {
        "home_label": "Start"
      }
    },
    "main": {
      "type": "main-404",
      "settings": {}
    }
  },
  "order": ["breadcrumbs", "main"]
}
```

---

### 4. Image asset

**Implementer dependency:** `assets/mug-404.jpg` must be placed in the `assets/` directory before the section can be tested. The file is the vintage polaroid-style photo of people mounting the MUG sign, provided by the client. The white polaroid border is part of the image file itself — no CSS border needed, only the `box-shadow` above.

---

## Content (Swedish)

| Element | Text |
|---|---|
| Breadcrumb home | Start |
| Breadcrumb current | 404 |
| H1 | Här blev det fel! – Sidan saknas (404) |
| Body | Sidan du letar efter verkar saknas. Använd vår navigering ovan eller klicka här för att återgå till startsidan. |
| Link text | klicka här |
| Link destination | `{{ routes.root_url }}` (start page) |

---

## Out of Scope

- 500-level errors (not customizable in Shopify)
- Product recommendations on the error page (removed per mockup)
- Shopify admin editor configurability for this section
