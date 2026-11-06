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