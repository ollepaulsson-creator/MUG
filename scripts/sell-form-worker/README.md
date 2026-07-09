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
