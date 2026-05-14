# MUG - Priskoll: Designspecifikation

**Datum:** 2026-05-14  
**Status:** Godkänd av användaren  
**Ägare:** ollepaulsson@gmail.com

---

## Översikt

MUG - Priskoll är en intern webbapp som automatiskt justerar priser på utvalda Shopify-produkter baserat på konkurrenters priser. Appen skrapar konkurrenters webbplatser, matchar produkter och sätter priset till det lägsta konkurrentpriset — dock aldrig under ett prisgolv baserat på kostnadspris + 15% marginal. Priser justeras också uppåt om tillämpbart. Alla priser avrundas till närmaste 10-tal SEK.

---

## Tech Stack

| Komponent | Val |
|---|---|
| Framework | Next.js (App Router) |
| Hosting | Vercel |
| Databas | Supabase (PostgreSQL) |
| Autentisering | Supabase Auth med Google OAuth |
| UI-bibliotek | shadcn/ui + Tailwind CSS |
| Skrapning | axios + cheerio (HTML-parsing) + JSON-LD/Schema.org |
| Schemaläggning | Vercel Cron Jobs (fast schema i vercel.json) |
| Språk | Svenska |
| Valuta | SEK |

---

## Arkitektur

### Övergripande flöde

```
Shopify Admin API ←→ Next.js på Vercel ←→ Supabase (PostgreSQL)
                           ↑
                   Vercel Cron Job (nattlig, kl 03:00 UTC+2)
                   + manuell trigger via POST /api/scrape
                           ↓
               axios + cheerio / JSON-LD per konkurrent
                           ↓
                    Produktmatchning
                           ↓
                      Prislogik
                           ↓
                  Uppdatera Shopify-pris
                  Spara historik i Supabase
```

### Skrapningsflöde

1. Cron Job eller POST `/api/scrape` triggar körning
2. Hämta alla produkter taggade "priskoll" från Shopify Admin API
3. För varje produkt: hämta matchade konkurrenturlar från `competitor_product_urls`
4. För varje konkurrent-URL: hämta sidan med axios, försök JSON-LD/Schema.org först (om `use_json_ld = true`), annars CSS-selektor
5. Spara funnet pris i `price_comparisons` (inklusive produktsidans URL och matchidentifierare)
6. Prislogik körs per produkt (se nedan)
7. Om priset ska ändras: uppdatera via Shopify Admin API
8. Spara rad i `price_history`
9. Uppdatera `competitors.last_scraped_at` och `last_status`

### URL-discovery för konkurrentprodukter

Produkters konkurrenturlar hanteras i `competitor_product_urls`-tabellen. Urlar kan läggas till på två sätt:
- **Manuellt:** Administratör klistrar in URL direkt i produktens detaljvy
- **Automatisk sökning:** Appen försöker hitta produkten via konkurrentens sök-URL (konfigureras per konkurrent som `search_url_template`, t.ex. `https://konkurrent.se/search?q={ean}`) — resultatet föreslås för godkännande

### Prislogik

- **Kostnadspris:** Hämtas från Shopify Admin GraphQL API via `inventoryItem.unitCost.amount` (returneras i SEK som decimal, konverteras till ören genom `Math.round(amount * 100)`). Fältet är Shopifys inbyggda "Cost per item"-fält. Om `unitCost` är null eller 0 för en produkt behandlas det som saknat kostnadspris.
- **Prisgolv:** `kostnadspris_i_ören × (1 + marginal / 100)` — standardmarginal 15%
- **Mål:** Lägsta konkurrentpris − 0 kr (vi matchar exakt, ej underskrider), avrundat nedåt till 10-tal
- **Uppåtjustering:** Om lägsta konkurrentpris > nuvarande pris, sätt nytt pris = `Math.floor(lägsta_konkurrent / 10) * 10`. Taket är `price_history.original_price` — priset kan aldrig höjas över det ursprungliga priset vid taggning.
- **Prisgolvskontroll:** Om beräknat pris < prisgolv, sätt pris = `Math.ceil(prisgolv / 10) * 10`
- **Saknar kostnadspris:** Produkten flaggas med varning och priset ändras inte
- **Ingen konkurrentmatch:** Priset lämnas oförändrat

**Avrundningsregel (nedåt):** `Math.floor(pris / 10) * 10`  
**Avrundningsregel (prisgolv uppåt):** `Math.ceil(prisgolv / 10) * 10`

### Produktmatchning mot konkurrenter

Matchning för att hitta konkurrentprodukt sker i prioritetsordning:
1. EAN/streckkod (exakt match)
2. SKU/artikelnummer (exakt match)
3. Produktnamn + leverantör (Jaro-Winkler fuzzy match, standardtröskel 0.85)

Tröskelvärdet för fuzzy match är globalt konfigurerbart via `settings`-tabellen (`fuzzy_match_threshold`, standardvärde `0.85`).

---

## Databas (Supabase/PostgreSQL)

### Tabeller

**`competitors`**
- `id` (uuid, PK)
- `name` (text)
- `url` (text) — roturlen till konkurrentens webbplats
- `logo_url` (text, nullable)
- `css_selector` (text, nullable) — CSS-selektor för priselement
- `use_json_ld` (boolean, default true)
- `search_url_template` (text, nullable) — t.ex. `https://konkurrent.se/search?q={ean}`
- `last_scraped_at` (timestamptz, nullable)
- `last_status` (text) — `ok` | `timeout` | `error`
- `created_at` (timestamptz)

**`competitor_product_urls`**
- `id` (uuid, PK)
- `competitor_id` (uuid, FK → competitors)
- `shopify_product_id` (text) — Shopify GID
- `product_page_url` (text) — den specifika produktsidans URL hos konkurrenten
- `match_method` (text) — `ean` | `sku` | `name` | `manual`
- `match_value` (text) — värdet som användes för matchningen (t.ex. EAN-numret)
- `verified` (boolean, default false) — manuellt godkänd av admin
- `created_at` (timestamptz)

**Regel:** Endast rader med `verified = true` används vid skrapning. Auto-upptäckta urlar (`verified = false`) visas i en granskningskö i konkurrentvyn och skrapas inte förrän en admin godkänner dem.

**`price_comparisons`**
- `id` (uuid, PK)
- `shopify_product_id` (text) — Shopify GID
- `competitor_id` (uuid, FK → competitors)
- `product_page_url` (text) — URL som skrapades
- `competitor_price` (integer) — pris i ören (undviker flyttal)
- `match_method` (text) — `json_ld` | `css_selector`
- `scraped_at` (timestamptz)

**`price_history`**
- `id` (uuid, PK)
- `shopify_product_id` (text)
- `original_price` (integer, ören) — Shopify-priset vid allra första skrapkörningen för produkten (hämtas via Shopify API vid det tillfället). Sätts en gång och ändras aldrig av appen. Produkter som ännu inte haft en körning har inget värde i kolumnen (NULL) och visas utan "Orig. pris" i UI:t.
- `old_price` (integer, ören) — pris innan denna körning
- `new_price` (integer, ören) — pris efter denna körning
- `lowest_competitor_price` (integer, nullable, ören)
- `competitor_id` (uuid, nullable, FK → competitors) — konkurrenten med lägst pris (nullable)
- `change_reason` (text) — `lowered` | `raised` | `no_change` | `missing_cost` | `no_match`
- `changed_at` (timestamptz)

**`invitations`**
- `id` (uuid, PK)
- `email` (text, unique)
- `invited_by` (uuid, FK → auth.users)
- `accepted_at` (timestamptz, nullable)
- `created_at` (timestamptz)

**`users`** (speglar auth.users med extra fält)
- `id` (uuid, PK, FK → auth.users)
- `email` (text)
- `display_name` (text, nullable)
- `role` (text) — `owner` | `member`
- `created_at` (timestamptz)

**`scrape_jobs`** (tillstånd för manuellt triggade skrapjobb)
- `id` (uuid, PK) — används som `jobId` i API-svaret
- `status` (text) — `running` | `done` | `error`
- `progress` (integer) — antal behandlade produkter
- `total` (integer) — totalt antal produkter att behandla
- `results` (jsonb, nullable) — sammanfattning av körningen vid `done`
- `error_message` (text, nullable) — felbeskrivning vid `error`
- `started_at` (timestamptz)
- `finished_at` (timestamptz, nullable)

POST `/api/scrape` skapar en rad i `scrape_jobs` och returnerar `{ jobId }`. Skraplogiken uppdaterar raden allteftersom. GET `/api/scrape/[jobId]` läser raden direkt från Supabase. Rader äldre än 7 dagar rensas automatiskt via en Supabase-funktion eller nästa cron-körning.

**`settings`** (globala inställningar, delade av alla användare)
- `key` (text, PK)
- `value` (text)

Standardvärden i `settings`:
| key | defaultvärde |
|---|---|
| `margin_percent` | `15` |
| `min_step_kr` | `10` |
| `fuzzy_match_threshold` | `0.85` |
| `cron_enabled` | `true` |

---

## API-routes

| Route | Metod | Beskrivning |
|---|---|---|
| `/api/scrape` | POST | Triggar skrapning manuellt. Fire-and-forget: svarar omedelbart med `{ jobId }`. Klienten pollar `/api/scrape/[jobId]` för status. |
| `/api/scrape/[jobId]` | GET | Returnerar status för pågående/avslutad körning: `{ status: 'running' \| 'done' \| 'error', progress, results }` |
| `/api/cron/scrape` | GET | Anropas av Vercel Cron Job. Kontrollerar `settings.cron_enabled` innan körning. |
| `/api/shopify/products` | GET | Hämtar produkter taggade "priskoll" från Shopify Admin API |
| `/api/shopify/products/[id]/price` | PATCH | Uppdaterar pris för en produkt i Shopify |

Vercel Cron konfigureras i `vercel.json` med fast schema (`0 1 * * *` = 03:00 CET). Toggeln i UI sätter `settings.cron_enabled = false/true` — cron-endpointen respekterar denna flagga och avbryter om den är `false`. Klocktiden är alltså alltid 03:00 och kan inte ändras via UI utan en redeploy.

---

## Sidor

### Navigation (vänster sidopanel)

- **Dashboard** — statistik och aktivitet
- **Priser** — produkttabell (med varningsbadge vid saknat kostnadspris)
- **Konkurrenter** — konkurrenthantering
- **Inställningar** — användare, auth, schemaläggning, Shopify-koppling

Användarrad längst ner i sidopanelen med avatar och e-post.

---

### Dashboard

**Statistikkort (4 st):**
- Totalt produkter taggade "priskoll"
- Priser sänkta idag
- Priser höjda idag
- Produkter som saknar kostnadspris (med varningsfärg)

**Stapeldiagram:** Prisändringar (sänkta/höjda) per dag, senaste 7 dagarna. Data från `price_history`.

**Senaste prisändringar:** Lista med miniatyrbild, produktnamn, gammalt pris → nytt pris, tidsstämpel. Max 10 poster.

**Konkurrentstatus:** Lista med logo, namn, antal matchade produkter och statuspunkt (grön = ok, gul = timeout, röd = error) per konkurrent.

---

### Priser

Produkttabell för alla produkter taggade "priskoll". Produktdata (namn, leverantör, SKU, streckkod, miniatyrbild) hämtas från Shopify Admin API i realtid. Prisdata från `price_history` (senaste rad per produkt) och `price_comparisons`.

**"Orig. pris"** = priset registrerat i `price_history.original_price` vid första körningen för produkten. Sätts en gång och ändras aldrig av appen.

**Kolumner:**
| Kolumn | Källa |
|---|---|
| Miniatyrbild | Shopify |
| Produkt (namn + leverantör) | Shopify |
| Kategori | Shopify product_type |
| SKU / Art.nr | Shopify variant SKU |
| Streckkod | Shopify variant barcode |
| Orig. pris | `price_history.original_price` |
| Kostnadspris | Shopify `cost` (via Admin API) |
| Lägsta konkurrent | `price_comparisons` (lägsta per produkt + competitors.name) |
| Nytt pris | `price_history.new_price` (senaste) |
| Status | `price_history.change_reason` |

**CSV-export:** Exporterar aktuell filtrerad vy. Alla synliga kolumner inkluderas, priser i SEK (heltal).

**Toolbar:** Sökfält (produktnamn, SKU, streckkod), filter (kategori, leverantör, status), CSV-export, "Hämta priser nu"-knapp i topbar.

**Manuell skrapningstrigger:** Klick på "Hämta priser nu" → POST `/api/scrape` → UI visar progress-indikator, pollar `/api/scrape/[jobId]` var 3:e sekund tills `done` eller `error`.

**Paginering** i tabellens nederkant (25 produkter per sida).

**Responsivitet:** Kolumner döljs progressivt vid smalare skärm (kategori, SKU, streckkod, kostnadspris döljs först).

---

### Konkurrenter

Tabell över alla konkurrenter med deras skrapningskonfiguration.

**Kolumner:** Logo, Konkurrent (namn + URL), Skrapningskonfiguration (JSON-LD-badge och/eller CSS-selektor), Senaste körning, Status, Matchade produkter, Åtgärder (Redigera/Ta bort).

**Lägg till konkurrent:** Formulär inline med fält för namn, URL, logo-URL, CSS-selektor, search_url_template och kryssruta för JSON-LD.

**CSV-export:** Alla konkurrenter, alla kolumner.

**Toolbar:** Sökfält, CSV-export.

---

### Inställningar

**1. Användare**
- Tabell: avatar, e-post, visningsnamn, roll (Ägare/Medlem), datum tillagd, Ta bort-knapp
- Ägaren (ollepaulsson@gmail.com, `role = owner`) kan inte tas bort — knappen visas ej
- Inbjudningsfält: e-postadress → "Skicka inbjudan" skapar rad i `invitations` och skickar e-post via Supabase

**2. Inloggning**
- Google Auth: alltid aktiverat, visas som readonly
- Toggle: "Kräv inbjudan" — styr `settings.require_invitation` (`true`/`false`)

**3. Automatisk skrapning**
- Toggle: schemalagd körning på/av (styr `settings.cron_enabled`)
- Informationstext: "Körning sker varje natt kl 03:00" (fast, ej redigerbar)
- Marginal i % (styr `settings.margin_percent`, standard 15)
- Minsta prisjustering i kr (styr `settings.min_step_kr`, standard 10)
- Fuzzy match-tröskel (styr `settings.fuzzy_match_threshold`, standard 0.85)

**4. Shopify-anslutning**
- Informationstext: "Shopify API-nyckeln konfigureras via Vercel-miljövariabler (`SHOPIFY_ADMIN_API_TOKEN`, `SHOPIFY_STORE_DOMAIN`)"
- "Testa anslutning"-knapp: anropar ett internt API-endpoint som testar Shopify-anslutningen och returnerar butikens namn vid lyckad test

---

## Autentisering & Åtkomstkontroll

- Inloggning sker uteslutande via Google OAuth (Supabase Auth)
- Inbjudningssystem: Next.js middleware (`middleware.ts`) kontrollerar vid varje request att den inloggade användarens e-post finns i `invitations`-tabellen med `accepted_at IS NOT NULL` ELLER i `users`-tabellen
- Ägarkonto (ollepaulsson@gmail.com) sätts upp manuellt vid deploy med `role = owner`
- Ej inbjudna Google-konton omdirigeras till en "Åtkomst nekad"-sida efter OAuth-callback
- Row Level Security (RLS) i Supabase: alla tabeller kräver autentiserad Supabase-session

### Inbjudningsflöde
1. Admin bjuder in e-post → rad skapas i `invitations` (accepted_at = null)
2. Inbjuden person klickar länk i e-post → OAuth med Google
3. OAuth-callback: om e-post matchar `invitations.email` → sätt `accepted_at`, skapa rad i `users`, omdirigera till dashboard
4. Om e-post ej matchar → omdirigera till "Åtkomst nekad"

---

## GitHub & Deployment

- Nytt GitHub-repo för projektet (separat från Shopify-tema-repot), namn: `mug-priskoll`
- Vercel kopplas till GitHub-repot, auto-deploy vid push till `main`
- Vercel Cron Job i `vercel.json`: `{ "crons": [{ "path": "/api/cron/scrape", "schedule": "0 1 * * *" }] }` (kl 03:00 CET)

**Miljövariabler i Vercel:**
| Variabel | Beskrivning |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase projekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon-nyckel |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-side only) |
| `SHOPIFY_ADMIN_API_TOKEN` | Shopify Admin API access token |
| `SHOPIFY_STORE_DOMAIN` | t.ex. `din-butik.myshopify.com` |
| `CRON_SECRET` | Hemlig nyckel som verifierar att cron-anrop kommer från Vercel |

---

## Design

- **Typsnitt:** Inter (Google Fonts)
- **Bakgrund:** Vit (`#ffffff`)
- **Primärfärg/knappar:** Svart (`#09090b`)
- **Gränssnittsspråk:** Svenska
- **Komponenter:** shadcn/ui med Tailwind CSS
- **Layout:** Vänster sidopanel (220px fast bredd) + scrollbart huvudinnehåll
- **Responsiv:** Kolumner döljs progressivt vid `< 900px`, sidopanel dold på `< 768px` (hamburger-meny)
- **Priser formateras** alltid som heltal med tusentalsavgränsare: `9 990 kr`
