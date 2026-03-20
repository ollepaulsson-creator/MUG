# Search Results Collection Layout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the existing `search-results` section on the search page so it renders with the same filters, product grid, and product cards as collection pages.

**Architecture:** `templates/search.json` controls which sections are active on the search page. The `main` section (`search-results.liquid`) already has filters, product grid, and product cards fully wired — it just has `"disabled": true`. Three legacy custom-liquid sections that handled the old rendering need to be disabled. No Liquid or JS changes needed.

**Tech Stack:** Shopify JSON template, Liquid sections

---

### Task 1: Update `templates/search.json`

**Files:**
- Modify: `templates/search.json`

- [ ] **Step 1: Enable the `main` section**

In `templates/search.json`, find the `"main"` key inside `"sections"`. It currently has `"disabled": true` in its object. Remove that property (or set it to `false`).

Before:
```json
"main": {
  "type": "search-results",
  "blocks": { ... },
  "disabled": true,
  "settings": { ... }
}
```

After:
```json
"main": {
  "type": "search-results",
  "blocks": { ... },
  "settings": { ... }
}
```

- [ ] **Step 2: Disable `custom_liquid_pYjBdr`** (the legacy renderer that calls `{% render 'search-page-result' %}`)

Find `"custom_liquid_pYjBdr"` in `"sections"` and add `"disabled": true`:

```json
"custom_liquid_pYjBdr": {
  "type": "custom-liquid",
  "disabled": true,
  ...
}
```

- [ ] **Step 3: Disable `custom_liquid_EgnEdD`** (legacy CSS for the old renderer)

Find `"custom_liquid_EgnEdD"` in `"sections"` and add `"disabled": true`:

```json
"custom_liquid_EgnEdD": {
  "type": "custom-liquid",
  "disabled": true,
  ...
}
```

- [ ] **Step 4: Verify the JSON is valid**

Run:
```bash
cd /Users/ollepaulsson/MUG && python3 -c "import json; json.load(open('templates/search.json')); print('valid')"
```
Expected: `valid`

- [ ] **Step 5: Commit**

```bash
git add templates/search.json
git commit -m "feat: enable collection-style layout on search results page

Enable search-results section (filters + product grid) and disable
legacy custom-liquid renderer on the search page."
```

- [ ] **Step 6: Push and deploy**

```bash
git push origin main
```

Then run `shopify theme push` interactively in the terminal.

- [ ] **Step 7: Verify on preview URL**

Open `https://mug-musik-utan-granser.myshopify.com/search?q=fender&type=product&preview_theme_id=199662698845` and confirm:
- Filter bar appears (Filtrera left, Sortera right)
- Products render in a 4-column grid with the same cards as collection pages
- No articles or pages appear in results
- Sorting works
- Pagination works
