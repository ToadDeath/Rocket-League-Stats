import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const importsRoot = path.join(root, 'data', 'imports');
const outputPath = path.join(root, 'public', 'data', 'league-data.json');

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      row.push(cell); cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(v => v.trim() !== '')) rows.push(row);
  return rows;
}
function detectDelimiter(text) {
  const line = text.split(/\r?\n/, 1)[0] || '';
  const choices = [',', ';', '\t', '|'];
  return choices.sort((a, b) => [...line].filter(c => c === b).length - [...line].filter(c => c === a).length)[0];
}
function readCsv(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseDelimited(raw, detectDelimiter(raw));
  if (!rows.length) return [];
  const headers = rows[0].map(v => v.trim().toLowerCase());
  return rows.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()])));
}
function readPlayerRoster(file) {
  if (!fs.existsSync(file)) throw new Error('Missing data/roster.csv.');
  const rows = readCsv(file), canonicalNames = new Set(), entries = [];
  for (const row of rows) {
    const player = (row.player || '').trim();
    if (!player) continue;
    if (canonicalNames.has(player)) throw new Error('Player "' + player + '" appears more than once in data/roster.csv.');
    canonicalNames.add(player);
    entries.push({ player, rank: (row.rank || '').trim(), trackerUrl: (row['tracker url'] || row['tracker.gg url'] || '').trim(), aliases: (row.aliases || '').split('|').map(v => v.trim()).filter(Boolean) });
  }
  const map = new Map();
  for (const { player } of entries) map.set(player, player);
  for (const { player, aliases } of entries) for (const alias of aliases) {
    if (canonicalNames.has(alias) && alias !== player) throw new Error('Alias "' + alias + '" conflicts with another canonical player name.');
    if (map.has(alias) && map.get(alias) !== player) throw new Error('Alias "' + alias + '" is assigned to more than one player.');
    map.set(alias, player);
  }
  return { aliases: map, ranks: Object.fromEntries(entries.map(({ player, rank }) => [player, rank])), trackerUrls: Object.fromEntries(entries.filter(({ trackerUrl }) => trackerUrl.startsWith('https://') || trackerUrl.startsWith('http://')).map(({ player, trackerUrl }) => [player, trackerUrl])) };
}
function readTeamRoster(file) {
  if (!fs.existsSync(file)) throw new Error('Missing data/team-aliases.csv.');
  const rows = readCsv(file), canonicalTeams = new Set(), entries = [];
  for (const row of rows) {
    const team = (row['team name'] || '').trim();
    if (!team) continue;
    if (canonicalTeams.has(team)) throw new Error('Team "' + team + '" appears more than once in data/team-aliases.csv.');
    const league = (row.league || '').trim();
    if (!['Premier', 'Championship'].includes(league)) throw new Error('Team "' + team + '" must have League set to Premier or Championship.');
    canonicalTeams.add(team);
    entries.push({ team, league, aliases: (row.aliases || row.alias || '').split('|').map(v => v.trim()).filter(Boolean) });
  }
  const map = new Map();
  for (const { team, league } of entries) map.set(team, { team, division: league, canonical: true });
  for (const { team, league, aliases } of entries) for (const alias of aliases) {
    if (canonicalTeams.has(alias) && alias !== team) throw new Error('Team alias "' + alias + '" conflicts with another canonical team name.');
    if (map.has(alias) && map.get(alias).team !== team) throw new Error('Team alias "' + alias + '" is assigned to more than one team.');
    map.set(alias, { team, division: league, canonical: false });
  }
  return map;
}
function findCsvFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? findCsvFiles(p) : e.isFile() && e.name.toLowerCase().endsWith('.csv') ? [p] : [];
  }).sort();
}
function toNumber(value) {
  if (value === undefined || value === null || value.trim() === '') return null;
  const x = Number(value.replace(/,/g, ''));
  return Number.isFinite(x) ? x : null;
}

const playerRoster = readPlayerRoster(path.join(root, 'data', 'roster.csv'));
const playerAliases = playerRoster.aliases;
const playerRanks = playerRoster.ranks;
const playerTrackerUrls = playerRoster.trackerUrls;
const teamRoster = readTeamRoster(path.join(root, 'data', 'team-aliases.csv'));
function readSchedule(file, teamRoster) {
  if (!fs.existsSync(file)) return [];
  const entries = readCsv(file).map((row, index) => {
    const division = (row.division || '').trim();
    const matchday = Number(row.matchday);
    const team1Info = teamRoster.get((row['team 1'] || '').trim());
    const team2Info = teamRoster.get((row['team 2'] || '').trim());
    const score1Text = (row['score 1'] || '').trim();
    const score2Text = (row['score 2'] || '').trim();
    const score1 = score1Text === '' ? null : Number(score1Text);
    const score2 = score2Text === '' ? null : Number(score2Text);
    const statsWeekText = (row['stats week'] || '').trim();
    const statsWeek = statsWeekText === '' ? null : Number(statsWeekText);
    if (!['Premier', 'Championship'].includes(division) || !Number.isInteger(matchday) || matchday < 1 ||
        !team1Info || !team2Info || team1Info.division !== division || team2Info.division !== division ||
        (score1Text !== '' && (!Number.isInteger(score1) || score1 < 0)) ||
        (score2Text !== '' && (!Number.isInteger(score2) || score2 < 0)) ||
        ((score1 === null) !== (score2 === null)) ||
        (statsWeek !== null && (!Number.isInteger(statsWeek) || statsWeek < 1))) {
      throw new Error('Invalid schedule row ' + (index + 2) + ' in data/schedule.csv. Check division, teams, scores, and stats week.');
    }
    return { id: division.toLowerCase() + '-' + matchday + '-' + (index + 1), division, matchday,
      deadline: (row.deadline || '').trim(), team1: team1Info.team, score1, score2,
      team2: team2Info.team, statsWeek };
  });
  // A stats-week value entered on any fixture maps the entire matchday.
  const matchdayWeeks = new Map();
  for (const entry of entries) {
    if (entry.statsWeek === null) continue;
    const key = entry.division + ':' + entry.matchday;
    if (matchdayWeeks.has(key) && matchdayWeeks.get(key) !== entry.statsWeek) {
      throw new Error('Conflicting stats-week mappings for ' + entry.division + ' Matchday ' + entry.matchday + ' in data/schedule.csv.');
    }
    matchdayWeeks.set(key, entry.statsWeek);
  }
  return entries.map(entry => ({
    ...entry,
    statsWeek: entry.statsWeek ?? matchdayWeeks.get(entry.division + ':' + entry.matchday) ?? null
  }));
}

const records = [], imports = [], duplicates = [], importWarnings = [], seenHashes = new Map();
const schedule = readSchedule(path.join(root, 'data', 'schedule.csv'), teamRoster);

for (const file of findCsvFiles(importsRoot)) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  const base = path.basename(file);
  const wm = base.match(/week[-_ ]?(\d+)/i);
  const week = wm ? Number(wm[1]) : null;
  const hash = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (seenHashes.has(hash)) { duplicates.push({ file: relative, duplicateOf: seenHashes.get(hash) }); continue; }
  seenHashes.set(hash, relative);

  const fallbackDivision = /second/i.test(base) || /championship/i.test(base) || /second/i.test(relative) || /championship/i.test(relative)
    ? 'Championship' : /premier/i.test(base) || /premier/i.test(relative) ? 'Premier' : 'Unassigned';
  const rows = readCsv(file);
  if (!rows.length) {
    importWarnings.push({ file: relative, type: 'empty', message: 'The file is empty or contains no readable rows.' });
    continue;
  }
  const headers = Object.keys(rows[0]);
  const missingHeaders = ['team name', 'player name'].filter(h => !headers.includes(h));
  if (missingHeaders.length) {
    importWarnings.push({ file: relative, type: 'headers', missingHeaders, message: 'Missing required columns: ' + missingHeaders.join(', ') });
    continue;
  }

  const importedTeams = new Set(), importedPlayers = new Set(), importedDivisions = new Set();
  const unknownTeams = new Set(), unknownPlayers = new Set(), invalidStats = new Map();
  let imported = 0, skippedRows = 0, blankNameRows = 0;

  for (const source of rows) {
    const originalTeamName = (source['team name'] || '').trim();
    const originalPlayerName = (source['player name'] || '').trim();
    if (!originalTeamName || !originalPlayerName) { blankNameRows++; skippedRows++; continue; }

    const teamInfo = teamRoster.get(originalTeamName);
    const playerName = playerAliases.get(originalPlayerName);
    if (!teamInfo) unknownTeams.add(originalTeamName);
    if (!playerName) unknownPlayers.add(originalPlayerName);
    if (!teamInfo || !playerName) { skippedRows++; continue; }

    const stats = {};
    let rowHasInvalidStat = false;
    for (const [key, value] of Object.entries(source)) {
      if (key === 'team name' || key === 'player name') continue;
      const parsed = toNumber(value);
      stats[key] = parsed;
      if (value !== '' && parsed === null) {
        rowHasInvalidStat = true;
        if (!invalidStats.has(key)) invalidStats.set(key, new Set());
        invalidStats.get(key).add(value);
      }
    }
    if (rowHasInvalidStat) { skippedRows++; continue; }

    records.push({
      division: teamInfo.division, week, sourceFile: relative,
      originalTeamName, teamName: teamInfo.team,
      originalPlayerName, playerName, stats
    });
    importedTeams.add(teamInfo.team);
    importedPlayers.add(playerName);
    importedDivisions.add(teamInfo.division);
    imported++;
  }

  imports.push({
    file: relative,
    division: [...importedDivisions].join(', ') || fallbackDivision,
    week, rows: imported, teams: importedTeams.size, players: importedPlayers.size,
    skippedRows
  });

  if (unknownTeams.size || unknownPlayers.size || invalidStats.size || blankNameRows) {
    importWarnings.push({
      file: relative, type: 'data',
      unknownTeams: [...unknownTeams].sort(),
      unknownPlayers: [...unknownPlayers].sort(),
      invalidStats: [...invalidStats].map(([column, values]) => ({ column, examples: [...values].slice(0, 3) })),
      blankNameRows, skippedRows
    });
  }
}

const availableStats = [...new Set(records.flatMap(r => Object.keys(r.stats)))];
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify({
  generatedAt: new Date().toISOString(), imports, duplicates, records, schedule,
  availableStats, playerRanks, playerTrackerUrls, importWarnings
}));
console.log('Processed ' + imports.length + ' CSV file(s), ' + records.length + ' usable player rows, ' + availableStats.length + ' stat fields.');
if (importWarnings.length) console.warn(importWarnings.length + ' import warning(s) need attention.');
