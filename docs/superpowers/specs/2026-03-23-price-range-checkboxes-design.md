# Price Range Checkboxes Design

## Goal

Replace the min/max text input price filter with predefined price range checkboxes. Ranges are dynamic (based on the collection's `filter.range_max`) and use clean, even numbers. Multiple ranges can be selected simultaneously.

## Breakpoints

Defined in Liquid as a fixed string split into an array, in **Swedish kronor (kr)**:

```liquid
assign breakpoints = '0,500,1000,2000,5000,10000,20000,50000' | split: ','
```

Shopify stores all price values in **cents** (e.g. 22 495 kr = `2249500`). When comparing against `filter.range_max` or `filter.min_value.value`, multiply kr values by 100. When writing to hidden inputs, also use cent values.

Example rendered for a collection with `range_max` = 2 249 500 (22 495 kr):

- 0 – 500 kr
- 500 – 1 000 kr
- 1 000 – 2 000 kr
- 2 000 – 5 000 kr
- 5 000 – 10 000 kr
- 10 000 – 20 000 kr
- 20 000 kr+

A bucket is rendered only if `lower_bound_kr * 100 < filter.range_max`. The last visible bucket always becomes "X kr+".

## Multi-range combination

Shopify accepts a single `filter.v.price.gte` / `filter.v.price.lte` pair. When multiple checkboxes are checked, JS merges: **lowest checked GTE → highest checked LTE**.

**Known limitation:** On reload, Shopify only returns the merged range. The pre-check Liquid logic restores all buckets fully contained within the stored range — intermediate buckets the user never checked may also be pre-checked. This is an accepted limitation of Shopify's filter API.

## Markup structure (`snippets/price-filter.liquid`)

Keep the existing `accordion-custom` + `details` + `summary` + `floating-panel-component` wrapper.

Replace the `price-facet-component` block entirely with:

```html
<facet-inputs-component
  on:change="/updateFilters"
  id="facet-inputs-component-price"
  data-price-range-filter
>
  <ul class="facets__inputs-list">
    <!-- one <li> per visible bucket, see below -->
  </ul>

  <!-- One GTE hidden input, shared across all buckets -->
  <input type="hidden" name="{{ filter.min_value.param_name }}" ref="priceGte"
    value="{% if filter.min_value.value %}{{ filter.min_value.value }}{% endif %}">

  <!-- One LTE hidden input, shared across all buckets -->
  <input type="hidden" name="{{ filter.max_value.param_name }}" ref="priceLte"
    value="{% if filter.max_value.value %}{{ filter.max_value.value }}{% endif %}">

  <!-- Keep existing clear button -->
  {% if should_render_clear %}...{% endif %}
</facet-inputs-component>
```

Each `<li>` contains a standard checkbox + label (plain HTML, not `checkbox.liquid`):

```html
<li class="facets__inputs-list-item">
  <label class="checkbox">
    <input
      type="checkbox"
      class="checkbox__input"
      data-gte="{{ lower_kr | times: 100 }}"
      data-lte="{{ upper_kr | times: 100 }}"  <!-- empty string for last bucket -->
      {% if is_active %}checked{% endif %}
    >
    <span class="checkbox__label-text">
      {% if is_last_bucket %}
        {{ lower_kr | times: 100 | money_without_currency }} kr+
      {% else %}
        {{ lower_kr | times: 100 | money_without_currency }} – {{ upper_kr | times: 100 | money_without_currency }} kr
      {% endif %}
    </span>
  </label>
</li>
```

**Important:** `checkbox.liquid` is NOT used because it ties `name`/`value` directly to one filter input. Price buckets need `data-gte`/`data-lte` attributes on the checkbox and two shared hidden inputs — a pattern the snippet does not support.

## Active-state on load (Liquid)

A bucket is pre-checked (`checked` attribute set) when:
- It is NOT the last bucket: `filter.min_value.value <= lower_kr * 100` AND `filter.max_value.value >= upper_kr * 100`
- It IS the last bucket: `filter.min_value.value <= lower_kr * 100` AND `filter.max_value.value` is blank/nil (no upper bound stored)

The two shared hidden inputs are pre-populated from `filter.min_value.value` / `filter.max_value.value` directly in Liquid (as shown in the markup above).

## JavaScript (inline `<script>` at bottom of snippet)

Wrapped in `document.addEventListener('DOMContentLoaded', () => { ... })`.

One function `syncPriceHiddenInputs(container)` that:

1. Finds all checked checkboxes in `container` (the `facet-inputs-component[data-price-range-filter]`).
2. If none checked:
   - Set `priceGte.value = ''` and `priceLte.value = ''`.
3. If one or more checked:
   - Collect all `data-gte` values → compute `minGte = Math.min(...all data-gte values)`.
   - Collect all non-empty `data-lte` values → compute `maxLte = Math.max(...all non-empty data-lte values)` (or `''` if last bucket is the highest checked).
   - Set `priceGte.value = minGte` and `priceLte.value = maxLte`.

Attach a `change` listener to each `[data-price-range-filter]` container. On change:
1. Call `syncPriceHiddenInputs(container)`.
2. Dispatch `new Event('change', { bubbles: true })` on `priceGte` to trigger `facet-inputs-component`'s `on:change="/updateFilters"` binding.

On `DOMContentLoaded`, call `syncPriceHiddenInputs` for all `[data-price-range-filter]` containers to ensure consistency with the Liquid-pre-checked state.

## Clear button behaviour

`facet-clear-component.clearFilter()` finds the nearest `facet-inputs-component` ancestor, then:
- Sets all `[type="checkbox"]:checked` to unchecked.
- Sets all `input` values to `''` — this clears `priceGte` and `priceLte`.
- Calls `facetsForm.updateFilters()` directly.

No changes needed to `facet-clear-component` or `facets.js`.

## `facet-status-component`

The existing `facet-status-component` in the summary queries for `ref="minInput"` and `ref="maxInput"` on `price-facet-component`. Since `price-facet-component` is removed, it will silently show nothing. The active-range badge in the summary is **out of scope** for this change — the section header and caret are sufficient.

## Files changed

| File | Change |
|------|--------|
| `snippets/price-filter.liquid` | Rewrite inner content; keep accordion + floating-panel wrapper |

No CSS changes needed.
