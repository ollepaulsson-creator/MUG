/**
 * MUG — Sälj/byt in form relay.
 *
 * Receives the multipart form from /pages/ladda-upp-bilder, then:
 *   1. Emails order@mug.se (TO_EMAIL) with all fields + photos attached.
 *   2. Emails a copy (without attachments) to the submitter.
 *
 * Runs on Cloudflare Workers, sends via Resend (https://resend.com).
 * Required environment variables (wrangler secret / vars):
 *   RESEND_API_KEY  — Resend API key
 *   TO_EMAIL        — where submissions go, e.g. order@mug.se
 *   FROM_EMAIL      — verified sender, e.g. "Musik Utan Gränser <formular@mug.se>"
 */

const ALLOWED_ORIGINS = [
  'https://www.mug.se',
  'https://mug.se',
  'https://mug-musik-utan-granser.myshopify.com',
];

const MAX_FILES = 10;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // Resend's email cap is 40MB total

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // GET /img?u=<url> — CORS passthrough for image luminance sampling on the
    // storefront (the chat pill's contrast detection). Some image CDNs used on
    // the site (cdn.instant.so) don't send CORS headers, which taints the
    // canvas; this echoes the image with ACAO so it can be sampled.
    const reqUrl = new URL(request.url);
    if (request.method === 'GET' && reqUrl.pathname === '/img') {
      let target;
      try {
        target = new URL(reqUrl.searchParams.get('u') || '');
      } catch {
        return new Response('bad url', { status: 400 });
      }
      const allowedHosts = ['cdn.instant.so', 'cdn.shopify.com'];
      if (target.protocol !== 'https:' || !allowedHosts.includes(target.host)) {
        return new Response('forbidden', { status: 403 });
      }
      const upstream = await fetch(target.toString(), { cf: { cacheEverything: true, cacheTtl: 86400 } });
      const headers = new Headers();
      headers.set('Content-Type', upstream.headers.get('Content-Type') || 'image/jpeg');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Cache-Control', 'public, max-age=86400');
      return new Response(upstream.body, { status: upstream.status, headers });
    }

    // GET /local-inventory.tsv?key=... — Google Merchant Center local product
    // inventory feed: which products are in stock in the physical store.
    // Built from the Shopify "Finns i butik" location (synced from Sitoo) via
    // a bulk operation (3 API calls total), cached at the edge for 4h. The
    // cron trigger keeps the cache warm so Google's fetch is instant.
    if (request.method === 'GET' && reqUrl.pathname === '/local-inventory.tsv') {
      if (reqUrl.searchParams.get('key') !== env.FEED_KEY) {
        return new Response('forbidden', { status: 403 });
      }
      const cache = caches.default;
      const cacheKey = new Request('https://feed.internal/local-inventory');
      let res = await cache.match(cacheKey);
      if (!res) {
        try {
          const tsv = await buildLocalInventoryFeed(env);
          res = feedResponse(tsv);
          await cache.put(cacheKey, res.clone());
        } catch (e) {
          return new Response('feed error: ' + (e && e.message), { status: 503 });
        }
      }
      return res;
    }

    if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405, cors);

    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ ok: false, error: 'bad-form' }, 400, cors);
    }

    // Honeypot: real users never fill this hidden field.
    if ((form.get('company') || '') !== '') return json({ ok: true }, 200, cors);

    const field = (n) => (form.get(n) || '').toString().trim();
    const name = field('name');
    const email = field('email');
    const phone = field('phone');
    const model = field('model');
    const description = field('description');

    if (!name || !email.includes('@') || !model) {
      return json({ ok: false, error: 'missing-fields' }, 422, cors);
    }

    // Collect attachments
    const files = form.getAll('images').filter((f) => typeof f === 'object' && f.size > 0);
    let total = 0;
    const attachments = [];
    for (const f of files.slice(0, MAX_FILES)) {
      total += f.size;
      if (total > MAX_TOTAL_BYTES) return json({ ok: false, error: 'too-large' }, 413, cors);
      attachments.push({
        filename: f.name || 'bild.jpg',
        content: toBase64(new Uint8Array(await f.arrayBuffer())),
      });
    }

    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rows = [
      ['Namn', name],
      ['E-post', email],
      ['Telefon', phone || '—'],
      ['Märke och modell', model],
      ['Beskrivning', description || '—'],
      ['Antal bilder', String(attachments.length)],
    ];
    const table =
      '<table style="border-collapse:collapse;font:14px/1.5 sans-serif">' +
      rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 16px 4px 0;font-weight:600;vertical-align:top;white-space:nowrap">${k}</td>` +
            `<td style="padding:4px 0">${esc(v).replace(/\n/g, '<br>')}</td></tr>`
        )
        .join('') +
      '</table>';

    console.log(JSON.stringify({ files: files.length, attachments: attachments.length, totalBytes: total, b64Lens: attachments.map((a) => a.content.length) }));

    // 1) To the store — with photos attached
    const storeMail = await sendEmail(env, {
      from: env.FROM_EMAIL,
      to: [env.TO_EMAIL],
      reply_to: email,
      subject: `Sälj/byt in: ${model} — ${name}`,
      html: `<h2 style="font:600 18px sans-serif">Ny intresseanmälan – Sälj eller byt in</h2>${table}`,
      attachments,
    });
    console.log('resend store response: ' + storeMail.status + ' ' + (await storeMail.clone().text()).slice(0, 300));
    if (!storeMail.ok) {
      // Surface Resend's error message (no secrets in it) to ease debugging.
      const detail = await storeMail.text().catch(() => '');
      return json({ ok: false, error: 'send-failed', detail: detail.slice(0, 300) }, 502, cors);
    }

    // 2) Copy to the submitter — without attachments (they have the photos)
    await sendEmail(env, {
      from: env.FROM_EMAIL,
      to: [email],
      subject: 'Kopia på din intresseanmälan – Musik Utan Gränser',
      html:
        `<p style="font:14px/1.6 sans-serif">Hej ${esc(name)},</p>` +
        `<p style="font:14px/1.6 sans-serif">Tack för din intresseanmälan! Vi har tagit emot dina uppgifter` +
        ` (${attachments.length} bild${attachments.length === 1 ? '' : 'er'}) och återkommer med ett prisförslag.</p>` +
        table +
        `<p style="font:14px/1.6 sans-serif">Vänliga hälsningar<br>Musik Utan Gränser<br>031-711 03 09 · order@mug.se</p>`,
    });

    return json({ ok: true }, 200, cors);
  },

  // Cron (see wrangler.toml): regenerate the local inventory feed and warm
  // the edge cache so Merchant Center's scheduled fetch never waits.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const tsv = await buildLocalInventoryFeed(env);
        const cache = caches.default;
        await cache.put(new Request('https://feed.internal/local-inventory'), feedResponse(tsv));
        console.log('local inventory feed refreshed: ' + tsv.split('\n').length + ' lines');
      })().catch((e) => console.log('feed refresh failed: ' + (e && e.message)))
    );
  },
};

// ---------------------------------------------------------------------------
// Google local inventory feed
// ---------------------------------------------------------------------------

function feedResponse(tsv) {
  return new Response(tsv, {
    headers: {
      'Content-Type': 'text/tab-separated-values; charset=utf-8',
      'Cache-Control': 'public, max-age=14400', // 4h — matches the cron cadence
    },
  });
}

async function shopifyGraphQL(env, query) {
  const res = await fetch(`https://${env.SHOPIFY_SHOP}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_TOKEN,
    },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (data.errors) throw new Error('shopify: ' + JSON.stringify(data.errors).slice(0, 200));
  return data.data;
}

// Builds the TSV with a Shopify bulk operation: one mutation to start, a few
// status polls, one JSONL download — bounded API usage no matter how large
// the location's inventory is.
async function buildLocalInventoryFeed(env) {
  if (!env.SHOPIFY_ADMIN_TOKEN) throw new Error('SHOPIFY_ADMIN_TOKEN not set');

  const bulkQuery = `
    {
      location(id: "${env.STORE_LOCATION_GID}") {
        inventoryLevels {
          edges {
            node {
              quantities(names: ["available"]) { name quantity }
              item {
                variant {
                  legacyResourceId
                  product { legacyResourceId status }
                }
              }
            }
          }
        }
      }
    }`;

  const start = await shopifyGraphQL(
    env,
    `mutation { bulkOperationRunQuery(query: """${bulkQuery}""") {
       bulkOperation { id status } userErrors { field message } } }`
  );
  const errs = start.bulkOperationRunQuery.userErrors;
  // "already in progress" is fine — poll whatever operation is running.
  if (errs.length && !/already in progress/i.test(JSON.stringify(errs))) {
    throw new Error('bulk start: ' + JSON.stringify(errs).slice(0, 200));
  }

  let url = null;
  for (let i = 0; i < 35; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await shopifyGraphQL(
      env,
      '{ currentBulkOperation { status url errorCode } }'
    );
    const op = poll.currentBulkOperation;
    if (!op) continue;
    if (op.status === 'COMPLETED') {
      url = op.url;
      break;
    }
    if (op.status === 'FAILED' || op.status === 'CANCELED') {
      throw new Error('bulk ' + op.status + ': ' + op.errorCode);
    }
  }
  if (!url) throw new Error('bulk operation timed out');

  const jsonl = await (await fetch(url)).text();
  const lines = ['store_code\tid\tavailability\tquantity'];
  for (const line of jsonl.split('\n')) {
    if (!line) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const variant = row.item && row.item.variant;
    if (!variant || !variant.product) continue;
    if (variant.product.status !== 'ACTIVE') continue;
    const qty = ((row.quantities || [])[0] || {}).quantity || 0;
    if (qty <= 0) continue;
    const offerId = env.OFFER_ID_PREFIX + variant.product.legacyResourceId + '_' + variant.legacyResourceId;
    lines.push(env.STORE_CODE + '\t' + offerId + '\tin_stock\t' + qty);
  }
  if (lines.length < 2) throw new Error('feed came out empty — refusing to publish');
  return lines.join('\n') + '\n';
}

async function sendEmail(env, payload) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

function toBase64(bytes) {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
