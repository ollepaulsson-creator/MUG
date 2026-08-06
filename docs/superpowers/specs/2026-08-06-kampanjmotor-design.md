# Kampanjmotor i Bakhuvudet — designspec

**Datum:** 2026-08-06 (rev 2 efter granskning)
**Status:** Utkast för granskning
**Beställare:** Olle (MUG)

## 1. Syfte

En kampanj ska kunna skapas på ETT ställe och därefter leva live i båda säljvärldarna samtidigt:

- **Webbshopen (Shopify):** äkta kampanjpriser överallt — produktkort, sök, produktsida, varukorg, kassa, Google-feed och strukturerad data — med jämförpris överstruket.
- **Butikskassan (Sitoo):** samma rabatt slår in automatiskt i kassan under kampanjperioden.
- **Temat:** kampanjbadge på produktkort och notis på produktsidan tänds/släcks automatiskt.

Bakgrund: Shopifys automatiska rabatter påverkar inte visade priser i butiken (syns först i kassan), och MUG:s rabattredigerare saknar Shopifys nya prisvisningsfunktion. Temats kampanjbadge (byggd 2026-08-06) visar kampanjen men ändrar inga priser. Butiks- och webbkampanjer hanteras i dag i två separata system med manuella steg.

## 2. Ordlista

| Term | Betydelse |
|---|---|
| Kampanj | Ett objekt i Bakhuvudet: namn, procent, produkturval, start, slut |
| Prisswap | Temporär ändring av Shopify-varianters `price`/`compareAtPrice` med sparade originalvärden |
| Snapshot | Den frysta listan av varianter (SKU + originalpriser) som togs vid kampanjstart |
| Voucher | Sitoos kampanjobjekt (`ProductDiscountX`, vouchertype 210) |
| Körning | En aktiverings- eller avslutsprocess som håller körningslåset |

## 3. Avgränsningar (utanför scope, v1)

- Endast **procentrabatt** (inga kronrabatter, paketpriser eller köp-X-få-Y)
- Endast **en aktiv kampanj åt gången** (motorn vägrar starta en andra — se §9)
- Ingen kundsegmentering (kampanjen gäller alla kunder)
- Inga schemalagda framtida kampanjer i kö (en kampanj kan skapas med framtida startdatum, men bara en i taget)
- Ingen ändring av en pågående kampanj (avbryt + skapa ny är arbetsflödet)
- Presentkortsprodukter exkluderas alltid ur urvalet

## 4. Kampanjobjektet

```
Campaign {
  id            string   (ulid)
  name          string   t.ex. "30 % på Teenage Engineering"
  percent       integer  1–90 (spärr mot orimliga värden)
  selection     { type: "collection", handle: string }        // v1: Shopify-kollektion, används ENDAST vid snapshot
  starts_at     ISO 8601 (Europe/Stockholm anges i UI, lagras UTC)
  ends_at       ISO 8601
  rounding      "whole" | "nearest_5" | "nearest_10"          // default nearest_5; se §7
  badge_text    string   kortbadge, t.ex. "30 %"
  notice_text   string   produktsidesnotis
  status        "draft" | "scheduled" | "activating" | "active"
                | "ending" | "ended" | "aborted" | "error"
  sitoo_voucher_id  integer | null
  created_at / updated_at / state_log[]
}
```

**Snapshot-post (en per variant, skrivs FÖRE första prisändringen):**

```
SnapshotItem {
  campaign_id, variant_gid, product_gid, sku
  original_price, original_compare_at
  campaign_price                      // det uträknade, avrundade kampanjpriset
  swap_status: "pending" | "swapped" | "restored" | "skipped" | "conflict"
  error: string | null
}
```

**Körningslås (lease):**

```
Lease { campaign_id, run_id (ulid), operation: "activate"|"end"|"abort", heartbeat_at }
```

## 5. Arkitektur

Modul i **Bakhuvudet** (`~/mug-priskoll`): Next.js 16 + Supabase (Postgres) på Vercel. Följer appens befintliga mönster: `lib/campaigns/` för logiken, `app/api/campaigns/` för UI-endpoints, `app/api/cron/campaigns-tick` registrerad i `vercel.json` (befintlig cron-katalog; sfkr-sale-scan kör redan `*/15` — kampanjticken kör `*/5` om planen tillåter, annars `*/15` vilket räcker: start/slut får då ±15 min slack utöver sidcachens ±60 min).

```
┌──────────────────────────────────────┐
│  Bakhuvudet (Next.js/Vercel)         │
│  - Sida i (app): Kampanjer           │
│  - lib/campaigns + api-routes        │
│  - Supabase: state + transaktioner   │
│  - vercel.json-cron: campaigns-tick  │
└──────┬───────────┬──────────────┬────┘
       │           │              │
   Shopify       Sitoo         Shopify
   Admin API     Vouchers API  metafält
   (prisswap)    (kampanj)     (badge-styrning)
```

**Lagring:** Supabase Postgres-tabeller (`campaigns`, `campaign_snapshot_items`, `campaign_leases`, `campaign_tx_log`). Postgres-transaktioner bär snapshot-invarianten (§10) och lease-atomiciteten naturligt.

**Shopify-scopes (ny eller utökad Dev Dashboard-app):** `read_products`, `write_products` (prisswap + produkt-metafält), `write_metafields`, `read_discounts` (dubbelrabattspärren §9.1 — primärspår). Beviljas `read_discounts` inte ersätts spärren av en intygs-checkbox i UI:t (fallback, §9.1). Medvetet INTE `write_discounts` — motorn rör aldrig Shopifys rabattsystem.

**Sitoo-auth:** Bakhuvudet har redan SITOO_-miljövariabler (bl.a. `SITOO_SPI_TOKEN`). Verifiera i Bakhuvudet vilken token som gäller Sitoos Admin API (vouchers) — SPI-token är för plugin-gränssnittet och är sannolikt INTE samma behörighet. Endpoints: `POST/PUT/DELETE /sites/{siteid}/vouchers` + `POST /sites/{siteid}/vouchers/{id}/products?product_identifier=sku`.

## 6. Tillståndsmaskin och flöden

```
draft ──(Schemalägg, eller Starta nu med framtida starts_at)──▶ scheduled
draft ──(Starta nu, starts_at ≤ nu)──▶ activating ──▶ active
scheduled ──(cron: starts_at passerad)──▶ activating ──▶ active
active ──(cron: ends_at passerad / Avsluta i förtid)──▶ ending ──▶ ended
draft/scheduled ──(Avbryt)──▶ aborted
activating/ending ──(ohanterat fel efter retries)──▶ error
error ──(Återuppta)──▶ activating/ending (samma operation som felade)
error ──(Skippa felande rader)──▶ fortsätter samma operation, felrader → skipped
error ──(Avbryt med rollback)──▶ ending (lease-operation "abort") ──▶ aborted   // §6.2-flödet återanvänds; inget eget status
```

**Körningslås:** varje körning (cron eller UI-knapp) tar leasen genom att skriva `Lease` med nytt `run_id` — bara om ingen lease finns, eller befintlig lease har `heartbeat_at` äldre än 15 min (död körning övertas). Körningen förnyar heartbeat efter varje batch. All swap-/restore-logik villkorar sina skrivningar på att den fortfarande äger leasen. Detta gör cron + manuell knapp säkra att köra parallellt.

### 6.1 Aktivering (`activating`)

1. **Ta leasen** (operation `activate`).
2. **Spärrkontroller** (§9). Avbryt med tydligt fel om någon fallerar.
3. **Snapshot:** hämta alla varianter i kollektionen (paginerat). Skriv SnapshotItem-rader med originalpriser och uträknade kampanjpriser. Committa till D1 **innan** någon extern ändring görs. Urvalet är därmed fryst — senare kollektionsändringar påverkar inte kampanjen (§8).
4. **Sitoo-voucher (idempotent tvåfas):**
   a. Sök befintlig voucher med `vouchercode == campaign.id` — finns en: återanvänd, hoppa till 4c.
   b. Skapa `ProductDiscountX`-voucher: `value_x = percent`, `vouchercode = campaign.id` (idempotensnyckel + rapportgruppering), `vouchername = campaign.name` (syns på kvittot), `datestart`/`dateend` = kampanjens datum konverterade till butikens lokala dygn (se §6.5), inget `voucherpassword` (auto-aktivering).
   c. Koppla SKU-listan (`product_identifier=sku`). Spara `sitoo_voucher_id`.
5. **Shopify-prisswap:** gruppera snapshot-rader per `product_gid`; en `productVariantsBulkUpdate`-mutation per produkt (alla dess varianter i samma anrop): `price = campaign_price`, `compareAtPrice = original_price`. I samma batchloop: sätt produkt-metafältet `product.metafields.mug.campaign = campaign.id` (`metafieldsSet`, ≤25/anrop). Markera varje rad `swapped`. Vid delfel: fortsätt övriga, markera felrader, retry ×3, därefter status `error` (vouchern lämnas aktiv — kampanjen ÄR delvis live; operatören väljer väg i §6.4).
6. **Shop-metafält:** skriv `shop.metafields.mug.campaign` (JSON: `id`, `active: true`, `badge_text`, `notice_text`, `starts_at`, `ends_at`). Skrivs SIST så badgen aldrig visas före priserna.
7. Släpp leasen, sätt `active`. Aktiveringsrapport till personalen (antal swappade/skippade, ev. avrundningsskippade per §7).

### 6.2 Avslut (`ending`)

1. **Ta leasen** (operation `end`).
2. **Badge av FÖRST:** sätt `active: false` i shop-metafältet — badgen får aldrig visas mot återställda priser.
3. **Sitoo:** sätt vouchern `activepos = false` (hängslen — `dateend` ska redan ha dödat den; vid förtida avslut är detta primära mekanismen).
4. **Shopify-återställning med diff-koll:** per `swapped`-rad, läs aktuellt pris.
   - Pris == `campaign_price` → återställ `price` = `original_price`, `compareAtPrice` = `original_compare_at`, rensa produkt-metafältet → `restored`.
   - Pris ≠ `campaign_price` (personal har ändrat under kampanjen) → återställ ENDAST `compareAtPrice` = `original_compare_at` och rensa produkt-metafältet (inget stalet strykpris får ligga kvar), rör inte `price`, markera `conflict`.
5. När alla rader är `restored`/`conflict`/`skipped` → släpp leasen, `ended`. Slutrapport till personalen (mejl via samma utskicksmönster som sell-form-workern): antal återställda, konflikter med adminlänkar och båda prisvärdena för manuell granskning.

### 6.3 Cron (var 5:e minut)

- `scheduled` + `starts_at` passerad → aktivering
- `active` + `ends_at` passerad → avslut
- `activating`/`ending` med död lease (heartbeat > 15 min) → överta leasen, återuppta från senaste ofärdiga rad (resumebarhet är kärnkravet: varje rad bär sitt eget tillstånd; jobbet kan dö och återupptas godtyckligt många gånger; voucher-steget är idempotent via `vouchercode`-uppslaget)

### 6.4 Vägar ur `error`

Operatören väljer i UI:t:

- **Återuppta** — kör om samma operation; transienta fel (rate limits, nätverk) läker.
- **Skippa felande rader** — rader med permanenta fel (t.ex. raderad produkt/variant) markeras `skipped`, operationen fortsätter till komplett. Skippade rader listas i rapporten.
- **Avbryt med rollback** (endast från fel under aktivering) — kör avslutsflödet (§6.2) över de rader som hann bli `swapped`, inaktivera vouchern (`activepos=false`), släck metafältet → `aborted`. Kampanjen är därefter helt återställd.

### 6.5 Datum mot Sitoo

Sitoos `datestart`/`dateend` antas ha dygnsgranularitet i butikens lokala tid (verifieras i byggsteg 0, §9.4). Konvertering: `datestart` = kampanjens startdatum (lokalt dygn), `dateend` = kampanjens slutdatum (lokalt dygn). Klockslagsprecision inom dygnet garanteras INTE på Sitoo-sidan — kampanjer bör starta/sluta vid dygnsgränser om butiksprecision är viktig; webbsidan följer exakt klockslag. Förtida avslut stänger alltid via `activepos=false` (§6.2 steg 3), aldrig via datumändring.

## 7. Prisberäkning

```
raw = original_price × (1 − percent/100)
campaign_price = avrunda(raw) enligt kampanjens rounding-regel
```

- `"whole"` = närmaste hela krona; `"nearest_5"` / `"nearest_10"` = närmaste 5- resp. 10-krona. Vid exakt mellanläge avrundas NEDÅT. Örespriser förekommer aldrig i kampanjpriser.
- Avrundning får aldrig ge `campaign_price ≥ original_price` (kan hända för billiga varor + nearest_10) → sådana varianter markeras `skipped` och listas i aktiveringsrapporten.
- Varianter med pris 0 (t.ex. dolda specialprodukter) → `skipped`.
- **Varianter som redan har `compareAtPrice` (pågående rea):** kampanjpriset räknas på `price` — dvs. kampanjprocenten läggs OVANPÅ pågående rea. Detta är avsett (kampanj slår rea), och UI:t visar en varningsrad vid aktivering om urvalet innehåller rea-varianter, med totalrabatten utskriven (t.ex. "3 varianter har redan rea — total rabatt blir upp till 44 %").
- **Prisinformation (Omnibus):** under kampanjen sätts `compareAtPrice = original_price` — det pris kunden faktiskt såg före kampanjen (för rea-varianter: reapriset, inte ursprungligt ordinarie). Strykpriset ljuger därmed aldrig uppåt. Originalets båda värden återställs efter kampanjen så reans utseende överlever.

## 8. Temakoppling

Badge-sanningen är **snapshoten**, inte live-kollektionen — kollektionsdrift under kampanjen kan varken tända badge utan kampanjpris eller tvärtom:

- Vid swap sätts `product.metafields.mug.campaign = campaign.id` per produkt; vid återställning rensas det (§6.1/§6.2).
- `snippets/product-card-badges.liquid`: badge om `product.metafields.mug.campaign == shop.metafields.mug.campaign.value.id` och shop-metafältets `active` är sant och nu ∈ [starts_at, ends_at] (datumfönstret behålls som hängslen).
- `blocks/buy-buttons.liquid`: notisen på samma villkor.
- Dagens temainställningar (Kampanjbadge, settings_schema) tas bort i samma temaändring — en sanningskälla. Badge-/notistexter kommer från shop-metafältet.
- Eftersom prisswappen ger äkta priser visar temat överstruket jämförpris automatiskt (befintlig `compare_at`-rendering). Kampanjbadgen ersätter Rea-badgen för kampanjprodukter via befintlig prioritetskedja.
- **Känd eftersläpning:** Shopifys sidcache (~30–60 min) gör att priser/badge inte slår igenom atomärt för alla besökare vid start och slut. Detta är förväntat; nämns i personaldokumentationen så det inte felanmäls.

## 9. Spärrar vid aktivering

1. **Dubbelrabattspärr:** lista aktiva/schemalagda automatiska Shopify-rabatter (`read_discounts`) och blockera om någon träffar urvalets produkter. Fallback utan scope: obligatorisk intygs-checkbox i UI:t ("Jag har kontrollerat att ingen Shopify-rabatt träffar dessa produkter").
2. **En kampanj åt gången:** vägra om annan kampanj är `scheduled`/`activating`/`active`/`ending`/`error`.
3. **Urvalsvalidering:** kollektionen finns, ≤ 500 varianter (v1-tak), inga presentkort.
4. **Sitoo-verifiering (engångs, byggsteg 0):** testvoucher på testprodukt + provköp i kassan bekräftar (a) att voucher utan `voucherpassword` slår in automatiskt, (b) `datestart`/`dateend`-granularitet och tidszon (§6.5), (c) att `vouchercode` kan bära kampanj-id:t som idempotensnyckel, (d) att dubbel-POST av samma SKU till `/vouchers/{id}/products` är ofarlig (idempotent SKU-koppling vid resume). Om auto-aktivering INTE fungerar: fallback = Sitoo-prislisteswap (`PricelistActivate`-spåret) — designas då separat innan bygget fortsätter.

## 10. Felhantering och observerbarhet

- Transaktionslogg i D1: varje externt API-anrop (system, operation, variant/SKU, resultat, run_id) — grunden för resume och felsökning
- Status `error` → mejlalarm till personalen med kampanj-id, senaste fel och länk till UI:t där §6.4-valen finns
- Admin-UI visar per kampanj: status, antal pending/swappade/återställda/skippade/konflikter, aktiv lease, senaste cron-körning
- **Invariant (testas explicit, §12.7):** ingen extern skrivning (Shopify-pris, Sitoo-voucher, metafält) sker någonsin utan committad snapshot- respektive tillståndsrad i D1 först

## 11. Admin-UI (v1, minimal)

Formulär i Bakhuvudet: namn, procent, kollektionsväljare (hämtar Shopifys kollektioner), datum/tid start+slut, avrundningsregel, badgetext, notistext. Förhandsvisning före start: antal varianter, antal som skippas (avrundning/pris 0/presentkort), antal med pågående rea (varning per §7). Knappar: Spara utkast / Starta nu / Schemalägg / Avbryt / Avsluta i förtid / Återuppta / Skippa felande / Avbryt med rollback (de tre sista endast vid `error`). Lista över historiska kampanjer med rapporter.

## 12. Testplan

1. **Byggsteg 0:** Sitoo-testvoucher + provköp i butikskassan — auto-aktivering, datumgranularitet, vouchercode-uppslag (§9.4)
2. Enhet: prisberäkning/avrundning (tabelltest inkl. skipped-fall och rea-ovanpå-fall), tillståndsövergångar inkl. §6.4-vägarna
3. Integration mot test-urval (2–3 testprodukter): aktivera → verifiera priser + compareAt + produkt- och shop-metafält + Sitoo-voucher → avsluta → verifiera fullständig återställning
4. Kraschtest A: döda körningen mitt i prisswappen → cron-resume via död lease → komplett utan dubbletter
5. Kraschtest B (voucher-idempotens): döda körningen mellan voucher-POST och D1-skrivning → resume återanvänder vouchern via `vouchercode`-uppslag — ingen andra voucher skapas
6. Konflikttest: ändra ett pris manuellt under aktiv kampanj → avslut → varianten får `conflict`, `compareAtPrice` återställd, `price` orörd, övriga `restored`
7. Invarianttest: simulera D1-skrivfel före extern skrivning → ingen extern ändring sker
8. Kollektionsdrift: lägg till/ta bort produkt i kollektionen under aktiv kampanj → badge och priser opåverkade (snapshot styr)
9. Samtidighet: trigga "Starta nu" och cron-aktivering parallellt → exakt en körning vinner leasen
10. Spärrar: dubbelkampanj, presentkort, aktiv Shopify-autorabatt på urvalet

## 13. Öppna frågor

1. ~~Var bor koden?~~ **Besvarad:** modul i `~/mug-priskoll` (Bakhuvudet, Next.js/Vercel/Supabase) — se §5.
2. **Delvis besvarad:** SITOO_-miljövariabler finns i appen; Bakhuvudet-sessionen verifierar om befintlig token täcker Admin API/vouchers eller om en ny behövs (SPI-token räcker sannolikt inte).
3. Räcker det att kampanjen syns i butikskassan via vouchernamnet på kvittot, eller behöver personalen något mer?
4. Slutrapport per mejl till `order@mug.se` — rätt mottagare? (Bakhuvudet har egna digest-mönster, t.ex. digest-sfkr-stale — återanvänd den kanalen?)

## 14. Ansvarsfördelning vid bygge

- **Bakhuvudet-sessionen (MUG/Bakhuvudet):** hela appmodulen — datamodell, cron, Sitoo- och Shopify-integrationerna, UI.
- **Temasessionen (denna):** temaändringarna i §8 (badge/notis läser metafält, borttagning av temainställningarna) — koordineras när appens metafältsskrivning finns; metafältets JSON-format i §6.1 steg 6 är kontraktet mellan oss.
