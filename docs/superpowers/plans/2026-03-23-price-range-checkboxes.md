# Price Range Checkboxes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the min/max text input price filter with predefined, dynamic price range checkboxes that support multi-range selection.

**Architecture:** `snippets/price-filter.liquid` is rewritten to render `facet-inputs-component` containing a list of checkboxes (one per visible price bucket), two shared hidden inputs for GTE/LTE, and an inline `<script>`. The script registers a single capture-phase delegated listener on `document` (guarded by `window.__priceRangeListenerAttached`) so it survives Shopify's AJAX section re-renders. On checkbox change the listener syncs the hidden inputs then calls `facetsForm.updateFilters()` directly — `stopImmediatePropagation()` prevents the facet component from also seeing the raw checkbox event. The outer accordion/details/summary/floating-panel wrappers are kept exactly as-is.

**Tech Stack:** Shopify Liquid, vanilla JS (inline `<script>`), existing `facets-form-component` / `facet-inputs-component` custom elements from `assets/facets.js`.

---

## File map

| File | Action |
|------|--------|
| `snippets/price-filter.liquid` | Rewrite content inside `floating-panel-component`; delete old `{% stylesheet %}` block |

---

## Key facts about the codebase

- **Shopify prices are in cents.** `filter.range_max`, `filter.min_value.value`, `filter.max_value.value` are all in cents. A breakpoint of 1 000 kr must be compared as `100000` cents.
- **`facet-inputs-component`** triggers form submission by having `on:change="/updateFilters"`. The component framework listens for `change` events in **capture phase** at the `document` level. Calling `updateFilters()` directly on the `facets-form-component` element is equivalent.
- **`facet-clear-component.clearFilter()`** finds the nearest `facet-inputs-component`, sets all `[type="checkbox"]:checked` to unchecked and all `input` values to `''`, then calls `facetsForm.updateFilters()`. Our two hidden `[data-price-gte]` / `[data-price-lte]` inputs are `type="hidden"` and are `input` elements — they get cleared correctly. No changes to `facets.js` needed.
- **AJAX re-renders:** Shopify's section rendering API replaces section HTML after each filter change. Inline `<script>` tags in re-rendered HTML do NOT re-execute via `innerHTML`. A delegated `document` listener registered once on page load (with a `window` flag guard) survives all re-renders.

---

### Task 1: Rewrite `snippets/price-filter.liquid`

**Files:**
- Modify: `snippets/price-filter.liquid`

- [ ] **Step 1: Read the current file**

Open `snippets/price-filter.liquid`. The structure is:

```
accordion-custom
  details.facets__panel
    summary.facets__summary        ← KEEP exactly as-is
    floating-panel-component       ← KEEP the opening/closing tag
      price-facet-component        ← DELETE this entire block
        ...text inputs...
        ...highest-price text...
        facet-clear-component
{% stylesheet %}...{% endstylesheet %}  ← DELETE entirely
```

- [ ] **Step 2: Replace the entire file with the content below**

The `accordion-custom`, `details`, `summary`, and `floating-panel-component` tags are identical to the original. Only the content inside `floating-panel-component` changes, and the `{% stylesheet %}` block is removed.

```liquid
{%- doc -%}
  Renders a price filter as predefined range checkboxes.

  @param {object} filter - The filter object to render.
  @param {string} filter_style - The filter style, can be 'horizontal' or 'vertical'.
  @param {boolean} [autofocus] - Whether to autofocus the first checkbox.
  @param {boolean} [should_render_clear] - Whether to render the clear button.
{%- enddoc -%}

<accordion-custom
  class="facets__item"
  {% if filter_style == 'horizontal' %}
    data-disable-animation-on-desktop="true"
    data-close-with-escape="true"
  {% endif %}
  open-by-default-on-mobile
  {% if filter_style == 'vertical' %}
    open
    open-by-default-on-desktop
  {% endif %}
>
  <details
    class="facets__panel"
    {% if filter_style == 'horizontal' %}
      data-auto-close-details="desktop"
    {% endif %}
  >
    <summary class="facets__summary">
      <span class="facets__label">{{ filter.label }}</span>
      <facet-status-component class="facets__status">
        <template ref="moneyFormat">{{ shop.money_format }}</template>
        <span
          class="hide-when-empty"
          ref="facetStatus"
          data-currency="{{ localization.country.currency.iso_code }}"
          data-range-max="{{ filter.range_max }}"
        >
          {%- if filter.min_value.value != null or filter.max_value.value != null %}
            {%- if filter.min_value.value != null and filter.max_value.value != null %}
              {{- filter.min_value.value | money | strip_html -}}–{{- filter.max_value.value | money | strip_html -}}
            {%- elsif filter.min_value.value != null -%}
              {{ filter.min_value.value | money | strip_html }}–{{ filter.range_max | money | strip_html }}
            {%- elsif filter.max_value.value != null -%}
              {{- 0 | money | strip_html -}}–{{- filter.max_value.value | money | strip_html -}}
            {%- endif -%}
          {%- endif -%}
        </span>
      </facet-status-component>
      <span class="svg-wrapper icon-caret icon-animated">
        {{- 'dropdown-svgrepo-com.svg' | inline_asset_content -}}
      </span>
    </summary>

    <floating-panel-component
      {% unless filter_style == 'vertical' %}
        data-close-on-resize
      {% endunless %}
      class="facets__panel-content details-content{% if filter_style == 'horizontal' %} color-{{ settings.popover_color_scheme }}{% endif %}"
    >
      {%- liquid
        assign breakpoints       = '0,500,1000,2000,5000,10000,20000,50000' | split: ','
        assign breakpoint_labels = '0,500,1 000,2 000,5 000,10 000,20 000,50 000' | split: ','
        assign last_i            = breakpoints | size | minus: 1
      -%}

      <facet-inputs-component
        on:change="/updateFilters"
        id="facet-inputs-component-{{ filter.param_name | escape | replace: '.', '-' }}"
        data-price-range-filter
      >
        <div class="facets__inputs facets__inputs-wrapper">
          <ul class="facets__inputs-list">
            {%- for i in (0..last_i) -%}
              {%- liquid
                assign lower_kr    = breakpoints[i] | plus: 0
                assign lower_cents = lower_kr | times: 100
                assign next_i      = i | plus: 1
                assign upper_kr    = breakpoints[next_i] | plus: 0
                assign upper_cents = upper_kr | times: 100

                # Stop rendering if this bucket's lower bound is at or above range_max
                if lower_cents >= filter.range_max
                  break
                endif

                # Last bucket = either the final breakpoint OR the next bucket would exceed range_max
                assign is_last_bucket = false
                if i == last_i
                  assign is_last_bucket = true
                elsif upper_cents >= filter.range_max
                  assign is_last_bucket = true
                endif

                # Pre-check if the stored price range covers this bucket
                assign is_active = false
                if is_last_bucket
                  # Active when: filter starts at or below this bucket AND either
                  #   (a) no upper bound stored (open-ended, only last bucket selected), or
                  #   (b) upper bound reaches into this bucket (e.g. adjacent bucket + last bucket selected)
                  if filter.min_value.value != null and filter.min_value.value <= lower_cents
                    if filter.max_value.value == null or filter.max_value.value >= lower_cents
                      assign is_active = true
                    endif
                  endif
                else
                  if filter.min_value.value != null and filter.max_value.value != null
                    if filter.min_value.value <= lower_cents and filter.max_value.value >= upper_cents
                      assign is_active = true
                    endif
                  endif
                endif

                assign lower_label = breakpoint_labels[i]
                assign upper_label = breakpoint_labels[next_i]
              -%}
              <li class="facets__inputs-list-item">
                <div class="checkbox">
                  <input
                    type="checkbox"
                    id="price-range-{{ section.id }}-{{ forloop.index }}"
                    class="checkbox__input"
                    data-gte="{{ lower_cents }}"
                    data-lte="{% unless is_last_bucket %}{{ upper_cents }}{% endunless %}"
                    {% if is_active %}checked{% endif %}
                    {% if autofocus and forloop.first %}autofocus{% endif %}
                  >
                  <label class="checkbox__label" for="price-range-{{ section.id }}-{{ forloop.index }}">
                    {{- 'icon-checkmark.svg' | inline_asset_content -}}
                    <span class="checkbox__label-text">
                      {%- if is_last_bucket -%}
                        {{ lower_label }} kr+
                      {%- else -%}
                        {{ lower_label }} – {{ upper_label }} kr
                      {%- endif -%}
                    </span>
                  </label>
                </div>
              </li>
            {%- endfor -%}
          </ul>
        </div>

        <input
          type="hidden"
          name="{{ filter.min_value.param_name }}"
          data-price-gte
          value="{% if filter.min_value.value %}{{ filter.min_value.value }}{% endif %}"
        >
        <input
          type="hidden"
          name="{{ filter.max_value.param_name }}"
          data-price-lte
          value="{% if filter.max_value.value %}{{ filter.max_value.value }}{% endif %}"
        >

        {%- assign has_active_price = false -%}
        {%- if filter.min_value.value != null or filter.max_value.value != null -%}
          {%- assign has_active_price = true -%}
        {%- endif -%}

        {% if should_render_clear %}
          <facet-clear-component
            class="clear-filter"
            tabindex="{% if has_active_price %}0{% else %}-1{% endif %}"
            on:click="/clearFilter"
            on:keydown="/clearFilter"
          >
            <div
              class="facets__clear {% if has_active_price %}facets__clear--active{% endif %}"
              ref="clearButton"
            >
              {{- 'actions.clear' | t -}}
            </div>
          </facet-clear-component>
        {% endif %}
      </facet-inputs-component>

      <script>
      (function () {
        function syncPriceHiddenInputs(container) {
          var checked  = Array.from(container.querySelectorAll('input[data-gte]:checked'));
          var gteInput = container.querySelector('input[data-price-gte]');
          var lteInput = container.querySelector('input[data-price-lte]');
          if (!gteInput || !lteInput) return;

          if (checked.length === 0) {
            gteInput.value = '';
            lteInput.value = '';
            return;
          }

          var gteValues = checked.map(function (cb) { return parseInt(cb.dataset.gte, 10); });
          var lteValues = checked
            .map(function (cb) { return cb.dataset.lte; })
            .filter(function (v) { return v !== ''; });

          gteInput.value = Math.min.apply(null, gteValues);
          lteInput.value = lteValues.length > 0
            ? Math.max.apply(null, lteValues.map(Number))
            : '';
        }

        // Sync on every (re-)render — runs immediately when script is parsed
        document.querySelectorAll('[data-price-range-filter]').forEach(function (container) {
          syncPriceHiddenInputs(container);
        });

        // Delegated listener — registered once, survives all AJAX re-renders.
        // IMPORTANT: Uses capture phase so it fires before facets.js (type="module", deferred)
        // registers its own capture-phase listener. stopImmediatePropagation() then prevents
        // facet-inputs-component from also calling updateFilters() on the raw checkbox event.
        // This ordering is guaranteed by the HTML spec: inline scripts run before deferred modules.
        if (!window.__priceRangeListenerAttached) {
          window.__priceRangeListenerAttached = true;

          document.addEventListener('change', function (e) {
            if (!(e.target instanceof HTMLInputElement) || e.target.type !== 'checkbox') return;
            var container = e.target.closest('[data-price-range-filter]');
            if (!container) return;

            // Stop component from also seeing this event (prevents double updateFilters call)
            e.stopImmediatePropagation();

            syncPriceHiddenInputs(container);

            // Call updateFilters directly on the form component
            var facetsForm = container.closest('facets-form-component');
            if (facetsForm && typeof facetsForm.updateFilters === 'function') {
              facetsForm.updateFilters();
            }
          }, true); // true = capture phase
        }
      })();
      </script>
    </floating-panel-component>
  </details>
</accordion-custom>
```

- [ ] **Step 3: Verify — basic rendering**

Open a collection page with a price filter (e.g. `/collections/cymbaler`). Open the filter drawer and check the Pris section:

- Section header "Pris" is visible with caret, same style as Tillgänglighet/Varumärke ✓
- Checkboxes appear with correct labels up to the collection's max price ✓
- The last visible bucket shows "X 000 kr+" (e.g. "20 000 kr+" or the last bucket within range) ✓
- No text inputs visible ✓

- [ ] **Step 4: Verify — filtering and re-renders**

- Check one box (e.g. "1 000 – 2 000 kr") → URL contains `filter.v.price.gte=100000&filter.v.price.lte=200000`, products in range shown ✓
- **Check a second box** (e.g. "5 000 – 10 000 kr") → URL merges to `gte=100000&lte=1000000` ✓
- **Check a third box on the re-rendered page** (after step above) → URL updates correctly again (confirms re-render doesn't break the filter) ✓
- **Note (known limitation):** Selecting non-adjacent buckets (e.g. "1 000–2 000 kr" + "5 000–10 000 kr") stores a merged range in the URL. On re-render, intermediate buckets (e.g. "2 000–5 000 kr") may also appear pre-checked. This is an inherent constraint of Shopify's single GTE/LTE price filter API. ✓
- Check only the last bucket ("20 000 kr+" or similar) → URL has `filter.v.price.gte=2000000`, no `lte` param ✓
- Reload the filtered page → correct boxes are pre-checked ✓
- Click "Rensa" (clear) → all boxes unchecked, price params gone from URL ✓

- [ ] **Step 5: Commit**

```bash
git add snippets/price-filter.liquid
git commit -m "Replace price range text inputs with predefined range checkboxes"
git push
```
