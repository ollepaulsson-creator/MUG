# MUG Sälj/byt in — form relay (Cloudflare Worker)

Receives submissions from `/pages/ladda-upp-bilder`, emails **order@mug.se**
with the photos attached, and sends a copy to the customer.

## One-time setup (~15 min)

1. **Resend** (email sender, free tier 3 000 mail/mån)
   - Create an account at https://resend.com
   - Add and verify the domain **mug.se** (Resend shows 3 DNS records —
     add them where mug.se's DNS is managed)
   - Create an API key (Sending access)

2. **Cloudflare** (hosts the worker, free tier is plenty)
   - Create an account at https://dash.cloudflare.com if you don't have one
   - In a terminal:

     ```sh
     cd scripts/sell-form-worker
     npx wrangler login          # opens browser
     npx wrangler secret put RESEND_API_KEY   # paste the Resend key
     npx wrangler deploy
     ```

   - The deploy prints the worker URL, e.g.
     `https://mug-sell-form.<account>.workers.dev`

3. **Theme**: paste the worker URL into the form section's
   "Endpoint URL" setting (Customize → the Ladda upp bilder page →
   Sälj/byt in-formulär section), or tell Claude the URL.

## Config

- `TO_EMAIL` / `FROM_EMAIL` live in `wrangler.toml` (FROM must be on the
  verified domain).
- Allowed origins (CORS) are listed at the top of `worker.js`.
- Limits: max 10 photos, 25 MB total (photos are also compressed
  client-side before upload).

## Spam

The form has a honeypot field; submissions that fill it are silently
accepted-and-dropped. If spam becomes a problem, add Cloudflare Turnstile
(free) — the worker runs on Cloudflare already.

## Google local inventory feed (`/local-inventory.tsv`)

Tells Google Merchant Center which products are in stock in the physical
store, so they can show as "i lager i butik" on Search/Maps. Data source:
the Shopify location **"Finns i butik"** (synced from Sitoo).

### One-time setup

1. **Shopify Admin API token** (read-only):
   - Admin → Inställningar → Appar och försäljningskanaler → Utveckla appar
     → Skapa app ("local-inventory-feed")
   - Konfigurera Admin API-omfång: `read_products`, `read_inventory`,
     `read_locations` → Spara → Installera appen
   - Kopiera **Admin API-åtkomsttoken** (visas en gång, börjar med `shpat_`)
   - Keep it to yourself, don't paste it in chat. In a terminal:

     ```sh
     cd scripts/sell-form-worker
     npx wrangler secret put SHOPIFY_ADMIN_TOKEN   # paste the token
     ```

2. **Merchant Center — link the store**:
   - Företagsinformation → Butiker → link the Google Business Profile for
     Kaserntorget 9. Set its **butikskod** to `MUG-GBG` (or change
     `STORE_CODE` in wrangler.toml to whatever code the profile has,
     then `npx wrangler deploy`).

3. **Merchant Center — register the feed**:
   - Datakällor → Lägg till datakälla → **Lokala produktlagerdata**
   - Schemalagd hämtning, daily, URL:
     `https://mug-sell-form.mug-se.workers.dev/local-inventory.tsv?key=<FEED_KEY from wrangler.toml>`

4. **Verify the offer id format**: open any product in Merchant Center and
   check that its item id looks like `shopify_SE_<numbers>_<numbers>`.
   If the prefix differs, adjust `OFFER_ID_PREFIX` in wrangler.toml.

The feed regenerates every 4 hours (cron) via a Shopify bulk operation and
is edge-cached; ~1 500 in-stock items, `in_stock` + quantity per row.
Products not in the feed count as out of stock locally, which is correct.
