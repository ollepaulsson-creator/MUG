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

    // 1) To the store — with photos attached
    const storeMail = await sendEmail(env, {
      from: env.FROM_EMAIL,
      to: [env.TO_EMAIL],
      reply_to: email,
      subject: `Sälj/byt in: ${model} — ${name}`,
      html: `<h2 style="font:600 18px sans-serif">Ny intresseanmälan – Sälj eller byt in</h2>${table}`,
      attachments,
    });
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
};

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
