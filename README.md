# Bridge Snap

A 1v1 tactical browser duel: race Rusty the bot across a crumbling rope bridge, snap planks in his path, and survive edge-grabs. Randomized bridges, pickups, win streaks, S–C grades, and a daily bridge.

No database, no API keys, no environment variables. All player data (win streaks, daily-bridge best times, settings) is stored in the browser via `localStorage`.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Push this folder to a GitHub repository (the repo root must contain `package.json` — it already does in this zip).
2. Go to https://vercel.com/new and import the repository.
3. Vercel auto-detects **Next.js** — leave every setting at its default (build command `next build`, output handled automatically).
4. Click **Deploy**. No environment variables are required.

That's it. Every later `git push` redeploys automatically.

## Tech notes

- Next.js App Router, plain JavaScript, zero extra dependencies (`next`, `react`, `react-dom` only).
- Game logic is vanilla DOM in `app/game.js`, mounted by the client component in `app/page.js`.
- Styles live in `app/globals.css`; fonts load from Google Fonts.
