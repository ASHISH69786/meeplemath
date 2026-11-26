# MeepleMath

Free board game score calculators at **meeplemath.org**. A fully static site: Astro + TypeScript + Tailwind, with
a small Preact island for each calculator. No backend, no login.

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # outputs dist/
npm run preview    # serve dist/ (needed to test the PWA / offline mode)
npx astro check    # type-check
```

## Adding a game

Add one JSON file to `src/content/games/`. The filename becomes the URL:
`wingspan.json` → `/wingspan-score-calculator/`. The page, sitemap entry, home-page card and offline cache are all
generated from it. The schema lives in `src/lib/game-schema.ts`, and the build fails if a file doesn't match it.

Category types:

| type     | player enters                 | points                                         | example                     |
| -------- | ----------------------------- | ---------------------------------------------- | --------------------------- |
| `number` | one number                    | `floor(value / divisor) × multiplier`          | eggs, 7 Wonders coins, debt |
| `bonus`  | a checkbox                    | `points` (`exclusive: true` = one holder only) | Longest Road                |
| `counts` | how many of each item         | `Σ count × item.points`                        | Ticket to Ride route lengths |
| `sets`   | how many of each symbol       | `Σ count² + min(counts) × perSetBonus`         | 7 Wonders science           |

Expansions can add categories and remove base ones (`"removes": ["largest-army"]`).

Content rules: write the rules text in your own words, use game names only, and never use box art, logos or card
images. The `rules` and `faq` text is what Google indexes and what AdSense reviewers read, so make it substantial.

## Where things live

- `src/lib/scoring.ts`: all scoring maths (shared by the calculator and the saved results)
- `src/components/Calculator.tsx`: the calculator. In-progress scores are kept in `localStorage` so a refresh loses nothing
- `src/lib/db.ts`: saved games and player stats in IndexedDB
- `src/lib/share-image.ts`: draws the results PNG on a canvas and shares or downloads it
- `astro.config.mjs`: site URL, sitemap, PWA manifest and offline precache

## Deploying to Cloudflare Pages

1. Push this repo, then in Cloudflare go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Set the framework preset to **Astro**, the build command to `npm run build` and the output directory to `dist`.
   `.node-version` pins Node 24.
3. Add the custom domain `meeplemath.org` (and redirect `www`).
4. Turn on **Web Analytics** for the site in the Cloudflare dashboard. No code is needed.
5. Submit `https://meeplemath.org/sitemap-index.xml` in Google Search Console.

## AdSense

Apply once you have roughly 20+ games with full rules text. When approved:

1. In Cloudflare Pages, set the environment variable `PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX` and redeploy.
   This adds the AdSense script to every page and fills in `/ads.txt`.
2. In AdSense, go to **Privacy & messaging** and publish the **European regulations** message (Google's certified
   TCF consent banner, required for EEA/UK/Swiss visitors).
3. Turn on Auto ads, and keep ads away from the calculator inputs to avoid accidental clicks.
