# Price Range Checkboxes Design

## Goal

Replace the min/max text input price filter with predefined price range checkboxes. Ranges are dynamic (based on the collection's `filter.range_max`) and use clean, even numbers. Multiple ranges can be selected simultaneously.

## Breakpoints

Defined in Liquid as a fixed array:

```
0, 500, 1000, 2000, 5000, 10000, 20000, 50000
```

Rendered labels (e.g. for a collection with `range_max` = 22 495 kr):

- 0 – 500 kr
- 500 – 1 000 kr
- 1 000 – 2 000 kr
- 2 000 – 5 000 kr
- 5 000 – 10 000 kr
- 10 000 – 20 000 kr
- 20 000 kr+

Only buckets where the lower bound is below `range_max` are rendered. The last visible bucket always becomes "X kr+" to catch everything above.

## Multi-range combination

Shopify's price filter accepts a single `filter.v.price.gte` / `filter.v.price.lte` pair. When multiple checkboxes are checked, JavaScript merges them: lowest selected min → highest selected max. Example: selecting 500–1 000 + 2 000–5 000 submits as 500–5 000.

## Mechanics

### Liquid (`snippets/price-filter.liquid`)

- Keep the existing `accordion-custom` + `details` + `summary` wrapper unchanged.
- Replace the `price-facet-component` and its two text inputs with a `<ul>` of checkboxes.
- Each list item contains:
  - A visible `<input type="checkbox">` + `<label>` (reuses existing `.filter-option` + `.checkbox` classes)
  - Two hidden `<input type="hidden">` elements holding the GTE and LTE values for that bucket
- A `data-price-range-filter` attribute on the `<ul>` for the JS hook.

### Active state on load

A checkbox is pre-checked if the current `filter.min_value.value` and `filter.max_value.value` cover its range — specifically if:
- `filter.min_value.value <= bucket_min` AND `filter.max_value.value >= bucket_max` (or it is the last bucket and `filter.max_value` is nil/range_max)

### JavaScript (inline `<script>` in snippet)

1. On `change` of any checkbox in `[data-price-range-filter]`:
   - Collect all checked checkboxes' GTE/LTE hidden inputs
   - If none checked: clear both price params (set inputs to empty)
   - If one or more checked: merge to `min(all GTE)` and `max(all LTE)`
   - Write merged values into `filter.min_value.param_name` and `filter.max_value.param_name` hidden inputs that the existing form submits
2. Trigger form submission via the existing `facets-form-component` `change` event pattern.

### Form submission

Reuses the existing `facets-form-component` — no new form or fetch logic needed. The hidden GTE/LTE inputs are named `filter.v.price.gte` and `filter.v.price.lte` respectively, which is what Shopify expects.

## Files changed

| File | Change |
|------|--------|
| `snippets/price-filter.liquid` | Rewrite inner content; keep accordion wrapper |

No CSS changes needed — existing `.filter-option` and `.checkbox` snippet classes cover the styling.
