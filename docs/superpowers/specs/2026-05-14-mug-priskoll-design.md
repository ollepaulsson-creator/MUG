# MUG - Priskoll: Designspecifikation

**Datum:** 2026-05-14  
**Status:** Godkänd av användaren  
**Ägare:** ollepaulsson@gmail.com

---

## Översikt

MUG - Priskoll är en intern webbapp som automatiskt justerar priser på utvalda Shopify-produkter baserat på konkurrenters priser. Appen skrapar konkurrenters webbplatser, matchar produkter och sätter priset till det lägsta konkurrentpriset minus minst ett steg — dock aldrig under ett prisgolv baserat på kostnadspris + 15% marginal. Priser justeras också uppåt om tillämpbart.

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
| Schemaläggning | Vercel Cron Jobs |
| Språk | Svenska |
| Valuta | SEK |

---

## Arkitektur

### Övergripande flöde

```
Shopify Admin API ←→ Next.js på Vercel ←→ Supabase (PostgreSQL)
                           ↑
                   Vercel Cron Job (nattlig)
                   + manuell trigger från UI
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

1. Cron Job triggas kl 03:00 varje natt (konfigurerbart), eller manuellt via knapp i UI
2. För varje konkurrent: försök hämta pris via Schema.org/JSON-LD först (om aktiverat), annars via konfigurerad CSS-selektor
3. Produktmatchning: kombinera produktnamn, leverantör, SKU/artikelnummer och EAN/streckkod
4. Prislogik körs för varje matchad produkt (se nedan)
5. Shopify Admin API uppdaterar priset om det har förändrats
6. Resultat sparas i `price_comparisons`-tabellen

### Prislogik

- **Mål:** Sätt priset till det lägsta konkurrentpriset, men avrunda nedåt till närmaste 10-tal SEK
- **Prisgolv:** `kostnadspris × (1 + marginal%)` — standardmarginal 15%, konfigurerbar i inställningar
- **Uppåtjustering:** Om lägsta konkurrentpris är högre än nuvarande pris, justera upp (avrundat till närmaste 10-tal)
- **Minsta steg:** 10 kr SEK — priser avrundas alltid till jämna 10-tal
- **Saknar kostnadspris:** Produkten flaggas med varning, priset ändras inte

**Avrundningsregel:** `Math.floor(pris / 10) * 10`

### Produktmatchning

Matchning sker i prioritetsordning:
1. EAN/streckkod (exakt match)
2. SKU/artikelnummer (exakt match)
3. Produktnamn + leverantör (fuzzy match, tröskelvärde konfigurerbart)

---

## Databas (Supabase/PostgreSQL)

### Tabeller

**`competitors`**
- `id`, `name`, `url`, `logo_url`
- `css_selector` — CSS-selektor för priselement
- `use_json_ld` (boolean) — försök Schema.org/JSON-LD först
- `last_scraped_at`, `last_status` (`ok` | `timeout` | `error`)
- `matched_products_count`

**`price_comparisons`**
- `id`, `product_id` (Shopify GID), `competitor_id`
- `competitor_price`, `competitor_url`
- `scraped_at`

**`price_history`**
- `id`, `product_id` (Shopify GID)
- `old_price`, `new_price`, `lowest_competitor_price`, `competitor_id`
- `change_reason` (`lowered` | `raised` | `no_change` | `missing_cost`)
- `changed_at`

**`invitations`**
- `id`, `email`, `invited_by`, `accepted_at`, `created_at`

**`settings`**
- `key`, `value` — generell nyckel/värde-tabell (margin_percent, cron_hour, min_step_kr)

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

**Stapeldiagram:** Prisändringar (sänkta/höjda) per dag, senaste 7 dagarna

**Senaste prisändringar:** Lista med miniatyrbild, produktnamn, gammalt pris → nytt pris, tidsstämpel

**Konkurrentstatus:** Lista med logo, namn, antal matchade produkter och statuspunkt (grön/gul/röd) per konkurrent

---

### Priser

Produkttabell för alla produkter taggade "priskoll" i Shopify. Data hämtas i realtid från Shopify Admin API.

**Kolumner:**
| Kolumn | Beskrivning |
|---|---|
| Miniatyrbild | Produktfoto (liten) |
| Produkt | Namn + leverantör |
| Kategori | Produkttyp/kategori |
| SKU / Art.nr | Shopify SKU |
| Streckkod | EAN/barcode |
| Orig. pris | Ursprungligt Shopify-pris |
| Kostnadspris | Från Shopify "Cost per item"-fält |
| Lägsta konkurrent | Lägsta funna pris + konkurrentnamn under |
| Nytt pris | Justerat pris efter prislogik |
| Status | Badge: Sänkt / Höjt / Oförändrat / Saknar kostnadspris |

**Statusbadges:**
- Grön — Sänkt
- Blå — Höjt
- Grå — Oförändrat
- Gul — Saknar kostnadspris (rad markeras med lätt gul bakgrund)

**Toolbar:**
- Sökfält (produktnamn, SKU, streckkod)
- Filter: kategori, leverantör, status
- CSV-export
- "Hämta priser nu"-knapp (topbar)

**Statusrad:** Senaste uppdatering, antal produkter, sammanfattning, antal varningar

**Paginering** i tabellens nederkant.

**Responsivitet:** Kolumner döljs progressivt vid smalare skärm (kategori, SKU, streckkod döljs först).

---

### Konkurrenter

Tabell över alla konkurrenter med deras skrapningskonfiguration.

**Kolumner:**
| Kolumn | Beskrivning |
|---|---|
| Logo | Konkurrentens logotyp |
| Konkurrent | Namn + URL |
| Skrapningskonfiguration | JSON-LD-badge och/eller CSS-selektor |
| Senaste körning | Tidsstämpel |
| Status | OK / Timeout / Fel med statuspunkt |
| Matchade produkter | Antal |
| Åtgärder | Redigera / Ta bort |

**Lägg till konkurrent:** Formulär som öppnas inline med fält för namn, URL, logo-URL, CSS-selektor och kryssruta för JSON-LD.

**Toolbar:** Sökfält, CSV-export.

---

### Inställningar

Fyra sektioner:

**1. Användare**
- Tabell: avatar, e-post, visningsnamn, roll (Ägare/Medlem), datum tillagd
- Ägaren (ollepaulsson@gmail.com) kan inte tas bort
- Inbjudningsfält: e-postadress → "Skicka inbjudan" skickar e-post via Supabase

**2. Inloggning**
- Google Auth: alltid aktiverat, visas som readonly
- Toggle: "Kräv inbjudan" — endast e-postadresser i användarlistan kan logga in

**3. Automatisk skrapning**
- Toggle: schemalagd körning på/av
- Tid för körning (standardvärde 03:00)
- Marginal i % (standardvärde 15)
- Minsta prisjustering i kr (standardvärde 10)

**4. Shopify-anslutning**
- Butiksdomän (`.myshopify.com`)
- Admin API-nyckel (dold, password-fält)
- "Testa anslutning"-knapp

---

## Autentisering & Åtkomstkontroll

- Inloggning sker uteslutande via Google OAuth (Supabase Auth)
- Inbjudningssystem: användare måste bjudas in via e-post av ägaren
- Ägarkonto: ollepaulsson@gmail.com — kan inte tas bort
- Ej inbjudna Google-konton nekas åtkomst även om de kan logga in med Google
- Row Level Security (RLS) i Supabase skyddar all data

---

## GitHub & Deployment

- Nytt GitHub-repo för projektet (separat från Shopify-tema-repot)
- Vercel kopplas till GitHub-repot för automatisk deployment vid push till `main`
- Miljövariabler i Vercel: Supabase URL/nyckel, Shopify API-nyckel, Google OAuth-credentials
- Vercel Cron Job konfigureras i `vercel.json`

---

## Design

- **Typsnitt:** Inter
- **Bakgrund:** Vit (`#ffffff`)
- **Primärfärg/knappar:** Svart (`#09090b`)
- **Gränssnittsspråk:** Svenska
- **Komponenter:** shadcn/ui med Tailwind CSS
- **Layout:** Vänster sidopanel (220px) + huvudinnehåll
- **Responsiv:** Kolumner döljs progressivt, sidopanel dold på mobil (hamburger-meny)
