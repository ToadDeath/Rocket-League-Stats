# Rocket League Stats

A public league analytics dashboard for player ratings, team standings, and weekly Rocket League performance.

## Divisions

- Premier
- Championship
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

1. Add each original weekly player export as a `.csv` under `data/imports/season-11/`.
2. Include the week number and division in the filename, for example `week-02-premier.csv` or `week-02-championship.csv`.
3. Commit the file to `main`. GitHub Actions processes every CSV under `data/imports/` and deploys the updated dashboard.
4. The importer detects comma-, semicolon-, tab-, and pipe-delimited files.

### Master roster, teams, and aliases

- `data/players.csv` is the permanent player directory. It stores each player's canonical name, rank, aliases, and Tracker URL once.
- `data/roster.csv` stores season-specific team membership and status. Its columns are `Season,Team,Player,Status`. Keep historical seasons in this file. Use `Active` or `Inactive`; inactive players remain in the permanent directory and retain their history, but are not counted as current team members.
- `data/current-season.txt` identifies the season whose roster is currently displayed. Update it when starting a new season.
- `data/voided-matches.csv` records administrative voids. The original weekly exports remain preserved, but player rows belonging to either side of a voided fixture are excluded from calculations.
- Keep one row per player in `data/players.csv`. Leave `Rank` blank when the player has no listed rank.
- Put multiple alternate player names in the `Aliases` column, separated by `|` (vertical bar). Example: `Canti57|OldName`.
- Alias matching is case-sensitive. Every alias must belong to only one player, and aliases cannot conflict with another player's canonical name.
- `data/teams.csv` is the master team list. Its columns are `League,Team Name,Aliases`.
- Set `League` to `Premier` or `Championship`. This determines the division shown on the website, so filenames do not need to determine the division.
- Put multiple alternate team names in `Aliases`, separated by `|` (vertical bar), just like player aliases. Leave it blank when there are no aliases.
- Team and player alias matching is case-sensitive. Each alias must be unique and cannot conflict with another canonical team or player name.

The current dashboard reports individual player-game statistics. It does not infer best-of-five series standings from player game wins.
