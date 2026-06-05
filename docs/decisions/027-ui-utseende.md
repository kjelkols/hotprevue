# ADR-027: UI-utseende — temabytte og tekststørrelse

**Status:** Utkast  
**Dato:** 2026-06-05

---

## Kontekst

Siste typografigjennomgang krevde endringer i 16 filer for å flytte én fargetrinn —
fra `text-gray-400` til `text-gray-300` for sekundær tekst. Det er for
mye friksjon for en enkelt semantisk beslutning.

Årsaken er at hele kodebasen bruker **Tailwinds leksikalske fargeklasser** direkte
i JSX: `text-gray-400`, `bg-gray-800`, `border-gray-800` osv. Det finnes ingen
semantisk lag — ingen abstraksjon mellom «hva fargen betyr» og «hvilken farge det er».
Dette er Tailwinds designfilosofi: unngå abstraksjon, skriv hvert stillag der det brukes.

Det fungerer bra for rask utvikling og en stil. Det skalerer dårlig til:
- **Temabytte** (mørk ↔ lys ↔ system)
- **Tetthetsjustering** (tekst- og komponentstørrelse)
- **Fremtidige utseendeendringer** som skal gjelde hele applikasjonen

I tillegg ønsker brukeren å kunne velge tema og tekststørrelse fra innstillinger,
med valget lagret på tvers av sesjoner.

---

## Analyse av plattformens begrensninger

### Tailwind v3 og theming

Tailwind v3 er utility-first og anti-abstraksjon by design. Det finnes tre
tilnærminger til theming i Tailwind:

**Alternativ 1: `dark:`-variant på hvert element**

```tsx
<div className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
```

Krever at *hvert eneste* fargereferanse i kodebasen dobles med en `dark:`-variant.
Kodebasen har 500+ eksplisitte fargereferanser. Resultatet er verbose, vanskelig
å lese, og fremtidige justeringer rammer fortsatt mange filer.

Dette alternativet avvises — det løser problemet med for mye friksjon ved å
introdusere dobbelt så mye friksjon.

**Alternativ 2: CSS custom properties som semantiske tokens (anbefalt)**

Definer et semantisk lag i CSS:
```css
:root[data-theme="dark"] {
  --clr-bg-base:     theme('colors.gray.950');
  --clr-text-primary: theme('colors.gray.100');
  /* … */
}
:root[data-theme="light"] {
  --clr-bg-base:     #ffffff;
  --clr-text-primary: theme('colors.gray.900');
  /* … */
}
```

Extend Tailwind med semantiske utilities:
```js
colors: {
  'bg-base':      'var(--clr-bg-base)',
  'text-primary': 'var(--clr-text-primary)',
  /* … */
}
```

Komponenter bruker `bg-bg-base`, `text-text-primary` osv. Temabytte skjer
ved å sette ett `data-theme`-attributt på `<html>`. En fremtidig justering
av «sekundær tekst» er én linje i CSS — ikke 16 filer.

**Alternativ 3: Migrering til shadcn/ui**

shadcn/ui er et komponentbibliotek bygget på nøyaktig Radix UI (allerede delvis
i bruk) + Tailwind med innebygde CSS-variabelbaserte tokens. Det har mørkt/lyst
tema ut av boksen.

Fordeler: professionelt resultat, intet vedlikehold av token-system.
Ulemper: stor migreringsjobb (alle eksisterende komponenter byttes ut),
pre-designede komponenter matcher ikke alltid eksakt ønsket utseende.

Avvises som primærvalg for eksisterende kodebase — aktuelt ved en fremtidig
større redesign.

---

## Alternativ for tekststørrelse

Tailwind v3 bruker **rem** for alle typografi-utilities:

| Klasse       | Størrelse |
|-------------|-----------|
| `text-xs`    | 0.75 rem  |
| `text-sm`    | 0.875 rem |
| `text-base`  | 1 rem     |
| `text-lg`    | 1.125 rem |

Spacing-utilities (`p-4`, `gap-2`, `w-64` osv.) bruker også rem.

Konsekvens: Å endre `font-size` på `<html>` skalerer *all* tekst og *alt* spacing
proporsjonalt. Dialogen blir fysisk større — ikke bare teksten i den. Det er
nøyaktig oppførselen brukeren forventer av «stor» modus.

```
Kompakt:  html { font-size: 14px }  →  text-sm = 12.25px, p-4 = 14px
Standard: html { font-size: 16px }  →  text-sm = 14px,    p-4 = 16px  ← nåværende
Stor:     html { font-size: 18px }  →  text-sm = 15.75px, p-4 = 18px
```

Dette krever *ingen* endringer i komponentkode — bare én verdi endres globalt.

---

## Beslutning

### 1. Semantisk token-lag

Definer et lite sett semantiske fargetokens som CSS custom properties.
Tokens grupperes i kategorier:

| Token | Mørk (default) | Lys |
|-------|---------------|-----|
| `--clr-bg-base` | gray-950 | white |
| `--clr-bg-surface` | gray-900 | gray-50 |
| `--clr-bg-elevated` | gray-800 | gray-100 |
| `--clr-bg-input` | gray-800 | white |
| `--clr-border` | gray-800 | gray-200 |
| `--clr-text-primary` | gray-100 | gray-900 |
| `--clr-text-secondary` | gray-300 | gray-600 |
| `--clr-text-muted` | gray-400 | gray-400 |
| `--clr-text-faint` | gray-500 | gray-300 |
| `--clr-text-disabled` | gray-600 | gray-300 |
| `--clr-accent` | blue-600 | blue-600 |
| `--clr-accent-hover` | blue-500 | blue-500 |
| `--clr-destructive` | red-400 | red-600 |

Tokens registreres i Tailwinds `theme.extend.colors` for å generere
`text-primary`, `bg-surface`, `border-border` osv. som vanlige Tailwind-utilities.

### 2. Migrasjonsstrategi — inkrementell

Eksisterende kode endres *ikke* i én operasjon. En fullstendig omskriving
av 500+ fargereferanser er risikabelt og gir liten umiddelbar verdi.

Strategi:
- **Nye komponenter** bruker semantiske tokens fra starten
- **Eksisterende komponenter** migreres opportunistisk, prioritert etter hvilke
  sider som besøkes mest
- Temabytte fungerer bare for migrerte komponenter — dette aksepteres midlertidig
- Fremtidige ADR-implementasjoner (søkeside, registreringsflyt osv.) leveres med
  semantiske tokens

En `clr-migration.md`-sjekkliste holder styr på status per komponent.

### 3. Tekststørrelse via root font-size

Tre faste størrelser tilbys:

| Alternativ | html font-size | Beskrivelse |
|-----------|---------------|-------------|
| Kompakt | 14px | For tette arbeidsflyter, liten skjerm |
| Standard | 16px | Nåværende utseende |
| Stor | 18px | For stor skjerm eller preferanse |

Ingen komponentkode endres. Root font-size settes i `<App>` basert på
innstilling hentet fra backend ved oppstart.

### 4. Temaalternativer

| Alternativ | Implementasjon |
|-----------|---------------|
| Mørkt | `data-theme="dark"` på `<html>` (nåværende) |
| Lyst | `data-theme="light"` + lyst tokensett |
| System | `prefers-color-scheme` media query, overstyres av eksplisitt valg |

System-default: mørkt (appens primærdesign og brukerens kontekst).

### 5. Persistering i settings

To nye felt i backend-innstillinger (`/settings`-endepunktet):

```json
{
  "ui_theme":     "dark" | "light" | "system",
  "ui_text_size": "compact" | "default" | "large"
}
```

Frontend henter disse ved oppstart (samme kall som andre innstillinger),
setter `data-theme` og `font-size` på `<html>` umiddelbart. Endringer i
innstillingssiden trer i kraft uten reload.

Fallback hvis innstilling ikke finnes: `dark` + `default`.

---

## Begrunnelse

**CSS custom properties fremfor `dark:`-varianter:** Én linje å endre vs. 16 filer.
Semantiske tokens er et velprøvd mønster i designsystemer og er det Tailwind v4
(kommende) beveger seg mot som standardtilnærming.

**Root font-size fremfor komponent-spesifikke størrelsesklasser:** All spacing
og typografi i Tailwind er rem-basert. Skalering på rotnivå er den eneste
løsningen som ikke krever parallelle utility-klasser per størrelse i komponentkode.
Det er «ett sted å endre» i høyeste potens.

**Inkrementell migrasjon fremfor big-bang:** Appen er i aktiv utvikling.
En storskala refaktor av alle fargereferanser blokkerer ny funksjonalitet.
Inkrementell migrasjon gir umiddelbar gevinst (nye komponenter er temabare)
uten å stoppe arbeidsflyten.

**shadcn/ui avvist for nå:** Biblioteket er utmerket, men krever at alle
eksisterende Radix-dialogs, forms og layout-komponenter byttes ut. Det er en
fullstendig komponentrewrite — ikke en passende avveiing for å løse
vedlikeholdsproblemet.

---

## Konsekvenser

### Frontend

1. **`index.css`**: Legg til `[data-theme="dark"]` og `[data-theme="light"]`
   blokkene med custom properties

2. **`tailwind.config.js`**: Registrer semantiske fargenavn som peker til
   CSS variables

3. **`src/lib/applyUiPrefs.ts`** (ny): Funksjon som setter `data-theme` og
   `html.style.fontSize` basert på innstillinger. Kalles fra App.tsx på oppstart
   og fra SettingsPage ved endring.

4. **`src/pages/SettingsPage.tsx`**: Legg til UI-seksjon med theme-velger
   (3 knapper: Mørkt / Lyst / System) og tekststørrelse-velger (3 knapper:
   Kompakt / Standard / Stor). Endringer lagres via `PATCH /settings` og
   trer i kraft umiddelbart.

5. **`clr-migration.md`** (ny fil i `frontend/`): Sjekkliste over komponenter,
   merket som migrert / ikke migrert. Oppdateres løpende.

### Backend

6. **`GET /settings` og `PATCH /settings`**: Legg til `ui_theme` og
   `ui_text_size` i settings-skjema. Ingen migrering nødvendig om settings
   lagres som JSON-blob (sjekk eksisterende implementasjon).

### Ikke i scope

- Egendefinert fargepalett (brukerdefinerte tokens)
- Høykontrastmodus (tilgjengelighet — vurderes separat)
- Per-sideinnstillinger (global preferanse kun)
- Font-valg utover Inter (fastlåst for konsistens)
