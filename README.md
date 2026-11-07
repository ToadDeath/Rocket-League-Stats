# Rocket League Stats

A public league analytics dashboard for player ratings, team standings, and weekly Rocket League performance.

## Divisions

- Premier League
- Second Division
- All Divisions

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deployment

The GitHub Actions workflow builds the Vite app and deploys it to GitHub Pages whenever changes are pushed to `main`.

In the repository settings, open **Pages** and set the build and deployment source to **GitHub Actions**.

## Data

The dashboard intentionally starts with empty states. Import the official weekly exports and confirmed roster/rating data before showing league statistics. The weekly CSV exports may use semicolons as delimiters, so data ingestion should detect the delimiter rather than assuming commas.

Because this repository is public, any CSV, JSON, or other data committed here will also be publicly accessible.

## Adding weekly exports

1. Add each original weekly player export as a `.csv` under `data/imports/2026/`.
2. Include the week number and division in the filename, for example `week-02-premier.csv` or `week-02-second.csv`.
3. Commit the file to `main`. GitHub Actions processes every CSV under `data/imports/` and deploys the updated dashboard.
4. The importer detects comma-, semicolon-, tab-, and pipe-delimited files.

### Master roster and player aliases

- `data/roster.csv` is the master player list. Its columns are `Team,Player,Rank,Aliases`.
- Keep one row per player. Leave `Rank` blank when the player has no listed rank.
- Put multiple alternate player names in the `Aliases` column, separated by `|` (vertical bar). Example: `Canti57|OldName`.
- Alias matching is case-sensitive. Every alias must belong to only one player, and aliases cannot conflict with another player's canonical name.
- `data/team-aliases.csv` is optional. Only add a mapping when an export/lobby uses a genuinely different team name, not just different capitalization.

The current dashboard reports individual player-game statistics. It does not infer best-of-five series standings from player game wins.
