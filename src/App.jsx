import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowUpRight, BarChart3, ChevronDown, Crosshair, Gauge, LayoutDashboard, Search, Shield, Swords, Users } from 'lucide-react';

const divisions = ['All Divisions', 'Premier League', 'Second Division'];
const navItems = [
  { label: 'Overview', icon: LayoutDashboard }, { label: 'Players', icon: Users },
  { label: 'Teams', icon: Shield }, { label: 'Stat Explorer', icon: BarChart3 }
];
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const fmt = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const avg = (total, games) => games ? total / games : 0;

function MetricCard({ label, value, detail, icon: Icon }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17} /></span></div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></article>;
}
function DataTable({ columns, rows, empty }) {
  return rows.length ? <div className="table-scroll"><table className="stats-table"><thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={row.key || i}>{columns.map(c=><td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>)}</tr>)}</tbody></table></div> : <div className="table-empty">{empty || 'No data available for this selection.'}</div>;
}

function App() {
  const [division, setDivision] = useState('All Divisions');
  const [activePage, setActivePage] = useState('Overview');
  const [query, setQuery] = useState('');
  const [selectedStat, setSelectedStat] = useState('score per game');
  const [dataset, setDataset] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/league-data.json`)
      .then(r => { if (!r.ok) throw new Error('The processed league data file could not be found.'); return r.json(); })
      .then(setDataset).catch(e => setLoadError(e.message));
  }, []);

  const records = useMemo(() => {
    const rows = dataset?.records || [];
    return division === 'All Divisions' ? rows : rows.filter(r => r.division === division);
  }, [dataset, division]);

  const players = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      if (!map.has(r.playerName)) map.set(r.playerName, { key:r.playerName, name:r.playerName, teams:new Set(), games:0,wins:0,score:0,goals:0,assists:0,saves:0,shots:0,demos:0 });
      const p=map.get(r.playerName); p.teams.add(r.teamName); p.games+=n(r.stats.games); p.wins+=n(r.stats.wins);
      p.score+=n(r.stats.score); p.goals+=n(r.stats.goals); p.assists+=n(r.stats.assists); p.saves+=n(r.stats.saves); p.shots+=n(r.stats.shots);
      p.demos+=n(r.stats['demos inflicted'])-n(r.stats['demos taken']);
    }
    return [...map.values()].map(p=>({...p,teamList:[...p.teams].join(', '),winPct:p.games?p.wins/p.games*100:0,scorePerGame:avg(p.score,p.games),goalsPerGame:avg(p.goals,p.games)})).sort((a,b)=>b.scorePerGame-a.scorePerGame);
  }, [records]);

  const teams = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      if (!map.has(r.teamName)) map.set(r.teamName,{key:r.teamName,name:r.teamName,players:new Set(),games:0,wins:0,score:0,goals:0,assists:0});
      const t=map.get(r.teamName); t.players.add(r.playerName); t.games+=n(r.stats.games); t.wins+=n(r.stats.wins);
      t.score+=n(r.stats.score); t.goals+=n(r.stats.goals); t.assists+=n(r.stats.assists);
    }
    return [...map.values()].map(t=>({...t,playerCount:t.players.size,winPct:t.games?t.wins/t.games*100:0,scorePerGame:avg(t.score,t.games)})).sort((a,b)=>b.winPct-a.winPct);
  }, [records]);

  const filteredPlayers = players.filter(p=>p.name.toLowerCase().includes(query.toLowerCase())||p.teamList.toLowerCase().includes(query.toLowerCase()));
  const playerGames = records.reduce((s,r)=>s+n(r.stats.games),0);
  const totalScore = records.reduce((s,r)=>s+n(r.stats.score),0);
  const stats = dataset?.availableStats || [];
  const statRows = [...records].sort((a,b)=>n(b.stats[selectedStat])-n(a.stats[selectedStat])).slice(0,50);
  const description = {
    Overview:'A league-wide look at player form, team performance, and the numbers behind every series.',
    Players:'Compare player performance and track stats across weekly exports.',
    Teams:'Explore team rosters and combined player performance.',
    'Stat Explorer':'Sort the full set of exported statistics and find the numbers that matter.'
  }[activePage];

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e=>{e.preventDefault();setActivePage('Overview')}}><span className="brand-mark"><Crosshair size={22}/></span><span className="brand-copy"><strong>RL<span>STATS</span></strong><small>LEAGUE ANALYTICS</small></span></a>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">{navItems.map(({label,icon:Icon})=><button key={label} className={activePage===label?'nav-item active':'nav-item'} onClick={()=>setActivePage(label)}><Icon size={18}/><span>{label}</span>{activePage===label&&<span className="nav-indicator"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="season-chip"><span className="live-dot"/> DATA HUB <span className="season-year">2026</span></div><div className="sidebar-note">League data, all in one place.</div><a className="github-link" href="https://github.com/ToadDeath/Rocket-League-Stats" target="_blank" rel="noreferrer">View project on GitHub ↗</a></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb"><span>LEAGUE HUB</span><b>/</b>{activePage.toUpperCase()}</div><div className="topbar-right"><span className="data-status"><span className="status-dot"/>{dataset?`${dataset.imports.length} FILE${dataset.imports.length===1?'':'S'} LOADED`:'LOADING DATA'}</span><div className="avatar">RL</div></div></header>
      <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> THE NUMBERS BEHIND THE GAME</div><h1>{activePage==='Overview'?<>League <em>Overview</em></>:activePage}</h1><p>{description}</p></div><label className="division-select"><span>DIVISION</span><span className="select-wrap"><select value={division} onChange={e=>setDivision(e.target.value)}>{divisions.map(x=><option key={x}>{x}</option>)}</select><ChevronDown size={16}/></span></label></section>
      {loadError&&<section className="notice"><strong>Data could not be loaded</strong><p>{loadError}</p></section>}
      {!dataset&&!loadError&&<section className="notice"><strong>Loading league data...</strong><p>Reading the processed weekly exports.</p></section>}
      {dataset&&<section className="notice"><div className="notice-icon"><Activity size={19}/></div><div><strong>{records.length?'Week 1 data is live':'No imports for this division yet'}</strong><p>{records.length?`${records.length} player rows loaded. Add weekly CSVs under data/imports and they will be included on the next deployment.`:'Upload a weekly export for this division to populate the dashboard.'}</p></div></section>}
      {dataset?.unmatchedTeams?.length > 0 && <section className="notice"><div><strong>Team aliases need attention</strong><p>These export names are not mapped yet: {dataset.unmatchedTeams.join(', ')}. Add them to data/team-aliases.csv and commit the change.</p></div></section>}
      {dataset?.duplicates?.length > 0 && <section className="notice"><div><strong>Duplicate exports skipped</strong><p>{dataset.duplicates.length} file(s) had identical contents to an existing import and were skipped.</p></div></section>}
      <section className="metrics-grid">
        <MetricCard label="PLAYERS TRACKED" value={dataset?fmt(players.length):'--'} detail="Unique player identities" icon={Users}/>
        <MetricCard label="TEAMS" value={dataset?fmt(teams.length):'--'} detail="In selected division" icon={Shield}/>
        <MetricCard label="PLAYER-GAMES" value={dataset?fmt(playerGames):'--'} detail="Individual player game appearances" icon={Swords}/>
        <MetricCard label="AVG. SCORE / GAME" value={dataset?fmt(avg(totalScore,playerGames)):'--'} detail="Across selected player rows" icon={Gauge}/>
      </section>
      {activePage==='Overview'&&<><section className="content-grid">
        <article className="panel performance-panel"><div className="panel-heading"><div><span className="panel-kicker">LEAGUE SNAPSHOT</span><h2>Top performers</h2></div><span className="panel-tag">SCORE / GAME</span></div><DataTable columns={[{key:'name',label:'PLAYER'},{key:'teamList',label:'TEAM'},{key:'scorePerGame',label:'SCORE/G',render:r=>fmt(r.scorePerGame)},{key:'goals',label:'GOALS',render:r=>fmt(r.goals)}]} rows={players.slice(0,8)} empty="Player stats will appear after importing a weekly CSV."/></article>
        <article className="panel leaderboard-panel"><div className="panel-heading"><div><span className="panel-kicker">TEAM RACE</span><h2>Team performance</h2></div><span className="panel-tag">GAME DATA</span></div><DataTable columns={[{key:'name',label:'TEAM'},{key:'playerCount',label:'PLAYERS'},{key:'winPct',label:'PLAYER GAME WIN %',render:r=>`${fmt(r.winPct)}%`}]} rows={teams.slice(0,8)} empty="Team performance will appear after importing data."/><p className="table-note">These are individual game results aggregated from player rows, not best-of-five series standings.</p></article>
      </section><section className="bottom-grid">
        <article className="panel compact-panel"><div className="panel-heading"><div><span className="panel-kicker">IMPORT HISTORY</span><h2>Weekly files</h2></div><Activity size={18} className="muted-icon"/></div><div className="import-list">{(dataset?.imports||[]).map(x=><div className="import-row" key={x.file}><span>{x.file}</span><b>{x.rows} players</b></div>)}</div></article>
        <article className="panel compact-panel"><div className="panel-heading"><div><span className="panel-kicker">DEEP DIVE</span><h2>Stat explorer</h2></div><BarChart3 size={18} className="muted-icon"/></div><div className="compact-empty">Explore all {stats.length} exported stat fields, including scoring, defense, boost, movement, and advanced stats.</div><button className="text-button" onClick={()=>setActivePage('Stat Explorer')}>Explore stats <ArrowUpRight size={15}/></button></article>
      </section></>}
      {activePage==='Players'&&<section className="panel full-panel"><div className="panel-heading"><div><span className="panel-kicker">PLAYER DIRECTORY</span><h2>{players.length} players</h2></div><span className="panel-tag">SORTED BY SCORE / GAME</span></div><div className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search players or teams..."/></div><DataTable columns={[{key:'name',label:'PLAYER'},{key:'teamList',label:'TEAM'},{key:'games',label:'GAMES',render:r=>fmt(r.games)},{key:'winPct',label:'GAME WIN %',render:r=>`${fmt(r.winPct)}%`},{key:'scorePerGame',label:'SCORE/G',render:r=>fmt(r.scorePerGame)},{key:'goals',label:'GOALS',render:r=>fmt(r.goals)},{key:'assists',label:'ASSISTS',render:r=>fmt(r.assists)},{key:'saves',label:'SAVES',render:r=>fmt(r.saves)}]} rows={filteredPlayers} empty="No players match this search."/></section>}
      {activePage==='Teams'&&<section className="panel full-panel"><div className="panel-heading"><div><span className="panel-kicker">TEAM DIRECTORY</span><h2>{teams.length} teams</h2></div><span className="panel-tag">PLAYER TOTALS</span></div><DataTable columns={[{key:'name',label:'TEAM'},{key:'playerCount',label:'PLAYERS'},{key:'games',label:'PLAYER-GAMES',render:r=>fmt(r.games)},{key:'winPct',label:'PLAYER GAME WIN %',render:r=>`${fmt(r.winPct)}%`},{key:'scorePerGame',label:'SCORE/G',render:r=>fmt(r.scorePerGame)},{key:'goals',label:'GOALS',render:r=>fmt(r.goals)},{key:'assists',label:'ASSISTS',render:r=>fmt(r.assists)}]} rows={teams} empty="No team data available for this division."/><p className="table-note">Team aliases are applied before totals are combined. This is not the official series standings table.</p></section>}
      {activePage==='Stat Explorer'&&<section className="panel full-panel"><div className="panel-heading"><div><span className="panel-kicker">RAW EXPORT EXPLORER</span><h2>Browse exported stats</h2></div><span className="panel-tag">{stats.length} STAT FIELDS</span></div><label className="stat-select"><span>STATISTIC</span><span className="select-wrap"><select value={selectedStat} onChange={e=>setSelectedStat(e.target.value)}>{stats.map(x=><option key={x}>{x}</option>)}</select><ChevronDown size={16}/></span></label><DataTable columns={[{key:'playerName',label:'PLAYER'},{key:'teamName',label:'TEAM'},{key:'week',label:'WEEK'},{key:'value',label:selectedStat.toUpperCase(),render:r=>fmt(r.stats[selectedStat])},{key:'sourceFile',label:'SOURCE'}]} rows={statRows} empty="No rows to explore."/></section>}
      <footer><span>RLSTATS <b>•</b> LEAGUE ANALYTICS</span><span>Built for the community <span className="footer-flame">◆</span></span></footer>
    </main>
  </div>;
}
export default App;
