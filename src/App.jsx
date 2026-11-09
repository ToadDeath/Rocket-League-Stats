import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Activity, AlertTriangle, ArrowLeft, ArrowUpRight, BarChart3, Bell, ChevronDown, ChevronLeft, ChevronRight, Download, Gauge, LayoutDashboard, ListOrdered, Search, Shield, Swords, Users } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const divisions = ['All Divisions', 'Premier', 'Championship'];
const navItems = [
  { label: 'Overview', icon: LayoutDashboard }, { label: 'Players', icon: Users },
  { label: 'Teams', icon: Shield }, { label: 'Compare', icon: Swords }, { label: 'Stat Explorer', icon: BarChart3 }
];
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const fmt = value => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtWinPct = value => String(Math.round(Number(value) || 0));
const fmtDetailed = value => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCategory = value => Number(value) >= 10 ? '10' : fmtDetailed(value);
const fmtRating = value => Number(value) >= 10 ? '10' : fmt(value);
const fmtCount = value => Math.round(n(value)).toLocaleString();
const avg = (total, games) => games ? total / games : 0;

function RatingMeter({ value, compact = false, detailed = false }) {
  const score = n(value);
  const fill = Math.min(100, Math.max(0, score * 10));
  return <div className={compact ? 'rating-meter compact' : 'rating-meter'}>
    <span>{detailed ? fmtCategory(score) : fmtRating(score)}</span>
    <div className="rating-meter-track" style={{'--rating-fill':fill+'%'}}/>
  </div>;
}

function RatingWithDelta({ value, delta, compact = false }) {
  return <div className="rating-with-delta">
    <RatingMeter value={value} compact={compact}/>
    <small className={delta==null||delta===0?'rating-delta-neutral':delta>0?'rating-delta-positive':'rating-delta-negative'}>
      {delta==null||delta===0?'-':(delta>0?'+':'')+fmt(delta)}
    </small>
  </div>;
}

// SGL Match Rating: aggregate raw stat totals across all player-games first, then
// calculate per-game rates. This makes every game contribute equally, so a player
// with 20 games has ten times the influence of a player with 2 games.
// Category ratings are centered on 6, then weighted.
// These baselines, multipliers, and weights are copied from the workbook's
// Ballchasing Back-End rows 202-204.
const matchRatingCategories = [
  { key:'winPct', label:'Win %', average:50, multiplier:0.08, weight:0.5 },
  { key:'scorePerGame', label:'Score', average:330, multiplier:0.015, weight:1.5 },
  { key:'goalsPerGame', label:'Goals', average:0.72, multiplier:4, weight:1.5 },
  { key:'assistsPerGame', label:'Assists', average:0.54, multiplier:5, weight:1.1 },
  { key:'gaSaves', label:'GA-Saves', average:1.2, multiplier:2, weight:1.1, inverse:true },
  { key:'boostStolenPerGame', label:'Boost Stolen', average:480, multiplier:0.015, weight:0.65 },
  { key:'demosPerGame', label:'Demos +/-', average:0, multiplier:2.5, weight:0.65 }
];
function teamSeriesStats(rows, teamName) {
  const teamRows = rows.filter(r => r.teamName === teamName);
  const playerGames = teamRows.reduce((sum, r) => sum + n(r.stats?.games), 0);
  const playerWins = teamRows.reduce((sum, r) => sum + n(r.stats?.wins), 0);
  const teamGames = playerGames / 3;
  const wins = playerWins / 3;
  const losses = (playerGames - playerWins) / 3;
  const exact = [teamGames, wins, losses].every(Number.isInteger);
  return {
    hasData: teamRows.length > 0 && playerGames > 0,
    exact,
    teamGames,
    wins: exact ? wins : null,
    losses: exact ? losses : null,
    complete: exact && teamGames >= 3 && teamGames <= 5 && (wins === 3 || losses === 3)
  };
}

function matchRatingForRecords(rows) {
  const totals = rows.reduce((a,r) => {
    const s=r.stats||{};
    a.games+=n(s.games); a.wins+=n(s.wins); a.score+=n(s.score);
    a.goals+=n(s.goals); a.assists+=n(s.assists); a.saves+=n(s.saves);
    a.goalsAgainst+=n(s['goals conceded']); a.boostStolen+=n(s['amount stolen']);
    a.demosInflicted+=n(s['demos inflicted']); a.demosTaken+=n(s['demos taken']);
    return a;
  }, {games:0,wins:0,score:0,goals:0,assists:0,saves:0,goalsAgainst:0,boostStolen:0,demosInflicted:0,demosTaken:0});
  const g=totals.games;
  const values = {
    winPct:g?totals.wins/g*100:0,
    scorePerGame:avg(totals.score,g),
    goalsPerGame:avg(totals.goals,g),
    assistsPerGame:avg(totals.assists,g),
    gaSaves:g?avg(totals.goalsAgainst,g)-avg(totals.saves,g):0,
    boostStolenPerGame:avg(totals.boostStolen,g),
    demosPerGame:g?avg(totals.demosInflicted,g)-avg(totals.demosTaken,g):0
  };
  const categories=Object.fromEntries(matchRatingCategories.map(c => {
    const difference=c.inverse ? c.average-values[c.key] : values[c.key]-c.average;
    return [c.key,6+difference*c.multiplier];
  }));
  const totalWeight=matchRatingCategories.reduce((sum,c)=>sum+c.weight,0);
  const rating = !g ? 0 : Math.min(10,Math.max(0,
    matchRatingCategories.reduce((sum,c)=>sum+categories[c.key]*c.weight,0)/totalWeight
  ));
  return { rating, categories, values };
}

const sglLogo = `${import.meta.env.BASE_URL}assets/league/sgl-logo.png`;
const teamBrandColors = {
  'EMERALD CITY RC': '#579b2e',
  'KC CAULDRON': '#263b68'
};
const teamLogoFiles = {
  'AXE & ARMY': 'AXE & ARMY.png',
  'EL MATADOR': 'EL MATADOR.png',
  'EMERALD CITY RC': 'EMERALD CITY RC.png',
  'FRONTERA SD CHROME': 'FRONTERA SD CHROME.png',
  'KC CAULDRON': 'KC CAULDRON.png',
  'LACINCO12': 'LACINCO12.png',
  'SOUNDERS ROCKET CLUB': 'SOUNDERS ROCKET CLUB.png',
  'THE REBELLION': 'THE REBELLION.png',
  'EC DEFIANCE': 'EMERALD CITY DEFIANCE.png',
  'EC ETERNAL': 'EMERALD CITY ETERNAL.png',
  'EM DALLAS BURN': 'EM DALLAS BURN.png',
  'LOS VERDES': 'LOS VERDES.png',
  'STEEL ARMY': 'STEEL ARMY.png',
  'WONDERWALL': 'WONDERWALL.png'
};
const rankLogoFiles = {
  B1:'Bronze I.png', B2:'Bronze II.png', B3:'Bronze III.png',
  S1:'Silver I.png', S2:'Silver II.png', S3:'Silver III.png',
  G1:'Gold I.png', G2:'Gold II.png', G3:'Gold III.png',
  P1:'Platinum I.png', P2:'Platinum II.png', P3:'Platinum III.png',
  D1:'Diamond I.png', D2:'Diamond II.png', D3:'Diamond III.png',
  C1:'Champion I.png', C2:'Champion II.png', C3:'Champion III.png',
  GC1:'Grand Champion I.png', GC2:'Grand Champion II.png', GC3:'Grand Champion III.png',
  SSL:'Supersonic Legend.png', UR:'Unranked.png'
};

function RankBadge({ rank }) {
  if (!rank) return <span className="rank-empty">-</span>;
  const file = rankLogoFiles[rank];
  if (!file) return null;
  return <span className="rank-badge" title={rank}>
    <img src={`${import.meta.env.BASE_URL}assets/ranks/${encodeURIComponent(file)}`} alt={rank} />
  </span>;
}

function DivisionBadge({ division, profile = false }) {
  if (!division || !['Premier','Championship'].includes(division)) return null;
  const file = division === 'Premier' ? 'SGL Premier.png' : 'SGL Championship.png';
  return <span className={'division-badge division-badge-'+division.toLowerCase()+(profile?' division-badge-profile':'')} title={'SGL '+division}><img src={`${import.meta.env.BASE_URL}assets/league/${encodeURIComponent(file)}`} alt={'SGL '+division}/>{!profile&&<span>{division}</span>}</span>;
}

function TeamName({ name }) {
  const logo = teamLogoFiles[name];
  const initials = name.split(/\s+/).filter(Boolean).slice(0,3).map(x=>x[0]).join('').slice(0,3);
  return <span className="team-name">
    {logo ? <img src={`${import.meta.env.BASE_URL}assets/teams/${encodeURIComponent(logo)}`} alt="" /> : <span className="team-monogram">{initials}</span>}
    <span>{name}</span>
  </span>;
}


async function downloadElementPng(selector, filename, options = {}) {
  await document.fonts?.ready;
  const element = document.querySelector(selector);
  if (!element) throw new Error('The export area could not be found.');
  const bounds = element.getBoundingClientRect();
  const contentWidth = Math.ceil(Math.max(bounds.width, element.scrollWidth));
  const contentHeight = Math.ceil(Math.max(bounds.height, element.scrollHeight));
  const cropTarget = options.trimToSelector ? document.querySelector(options.trimToSelector) : null;
  const croppedContentHeight = cropTarget
    ? Math.min(contentHeight, Math.ceil(cropTarget.getBoundingClientRect().bottom - bounds.top + (options.bottomGap ?? 8)))
    : Math.max(0, contentHeight - (options.trimBottom ?? 0));
  const paddingTop = options.paddingTop ?? 14;
  const paddingBottom = options.paddingBottom ?? 14;
  const paddingX = options.paddingX ?? 14;
  const dataUrl = await toPng(element, {
    width: contentWidth + paddingX * 2,
    height: croppedContentHeight + paddingTop + paddingBottom,
    style: {
      width: `${contentWidth}px`,
      height: `${croppedContentHeight}px`,
      padding: `${paddingTop}px ${paddingX}px ${paddingBottom}px`,
      boxSizing: 'content-box',
      overflow: 'visible'
    },
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: '#0b1018',
    filter: node => !(node instanceof HTMLElement && node.dataset.exportIgnore === 'true')
  });
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function MetricCard({ label, value, detail, icon: Icon }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17} /></span></div><div className="metric-value">{value}</div>{detail&&<div className="metric-detail">{detail}</div>}</article>;
}
function DataTable({ columns, rows, empty, onRowClick, sortKey, sortDirection, onSort }) {
  return rows.length ? <div className="table-scroll"><table className="stats-table"><thead><tr>{columns.map(c => {const entityClass=/^(PLAYER|TEAM)$/i.test(String(c.label||'').trim())?' entity-name-column':'';return <th key={c.key} className={(c.key==='teamList'?'team-column-header':'')+entityClass}>{onSort && c.key!=='position' ? <button type="button" className={'sortable-header'+(sortKey===c.key?' active':'')} onClick={()=>onSort(c.key)}><span className="sortable-label"><span className="sortable-text">{c.label}</span><span className={'sort-indicator'+(sortKey===c.key?' visible':'')} aria-hidden="true">{sortDirection==='asc'?'↑':'↓'}</span></span></button> : c.key==='teamList'?<span>{c.label}</span>:c.label}</th>})}</tr></thead><tbody>{rows.map((row,i)=><tr key={row.key || i} className={onRowClick?"clickable-row":""} onClick={onRowClick?()=>onRowClick(row):undefined}>{columns.map(c=><td key={c.key} className={/^(PLAYER|TEAM)$/i.test(String(c.label||'').trim())?'entity-name-column':undefined}>{c.render ? c.render(row) : row[c.key]}</td>)}</tr>)}</tbody></table></div> : <div className="table-empty">{empty || 'No data available for this selection.'}</div>;
}

const rlRankOrder = ['SSL','GC3','GC2','GC1','C3','C2','C1','D3','D2','D1','P3','P2','P1','G3','G2','G1','S3','S2','S1','B3','B2','B1','UR'];
const rlRankPosition = new Map(rlRankOrder.map((rank,index)=>[rank,index]));

function sortRows(rows, key, direction) {
  const factor = direction === 'asc' ? 1 : -1;
  const collator = new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
  return [...rows].sort((a,b) => {
    if (key === 'ratingChange') {
      const av = Number.isFinite(a.ratingChange) ? a.ratingChange : null;
      const bv = Number.isFinite(b.ratingChange) ? b.ratingChange : null;
      if (av === null || bv === null) {
        if (av === null && bv !== null) return 1;
        if (bv === null && av !== null) return -1;
        return collator.compare(String(a.name||''),String(b.name||''));
      }
      const deltaOrder = (av - bv) * factor;
      return deltaOrder || collator.compare(String(a.name||''),String(b.name||''));
    }
    if (a.games !== undefined && b.games !== undefined && key !== 'name' && key !== 'rank' && key !== 'teamList') {
      const aHasStats = Number(a.games) > 0, bHasStats = Number(b.games) > 0;
      if (aHasStats !== bHasStats) return aHasStats ? -1 : 1;
    }
    const av = key === 'rank' ? (rlRankPosition.get(String(a.rank||'').toUpperCase()) ?? Number.MAX_SAFE_INTEGER) : (a.ratingCategories?.[key] ?? a.categories?.[key] ?? a[key] ?? a.ratingValues?.[key] ?? a.values?.[key] ?? null);
    const bv = key === 'rank' ? (rlRankPosition.get(String(b.rank||'').toUpperCase()) ?? Number.MAX_SAFE_INTEGER) : (b.ratingCategories?.[key] ?? b.categories?.[key] ?? b[key] ?? b.ratingValues?.[key] ?? b.values?.[key] ?? null);
    const aMissing = av === null || av === undefined || av === '';
    const bMissing = bv === null || bv === undefined || bv === '';
    if (aMissing !== bMissing) return aMissing ? 1 : -1;
    let result = 0;
    if (typeof av === 'number' || typeof bv === 'number' || (av !== '' && bv !== '' && Number.isFinite(Number(av)) && Number.isFinite(Number(bv)))) result = (Number(av)||0) - (Number(bv)||0);
    else result = collator.compare(String(av??''),String(bv??''));
    if (result) return result * factor;
    return collator.compare(String(a.name||a.playerName||''),String(b.name||b.playerName||'')) * factor;
  });
}

function App() {
  const [division, setDivision] = useState('All Divisions');
  const [divisionMenuOpen, setDivisionMenuOpen] = useState(false);
  const divisionPickerRef = useRef(null);
  const [activePage, setActivePage] = useState('Overview');
  const [query, setQuery] = useState('');
  const [selectedStat, setSelectedStat] = useState('score per game');
  const [selectedAuditPlayer, setSelectedAuditPlayer] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [compareView, setCompareView] = useState('team-stats');
  const [compareTeams, setCompareTeams] = useState([]);
  const [compareTeamMenuOpen, setCompareTeamMenuOpen] = useState(false);
  const [compareWeekMenuOpen, setCompareWeekMenuOpen] = useState(false);
  const compareTeamPickerRef = useRef(null);
  const compareWeekPickerRef = useRef(null);
  const [exportingComparison, setExportingComparison] = useState(false);
  const [playerSort, setPlayerSort] = useState({ key:'rating', direction:'desc' });
  const [teamSort, setTeamSort] = useState({ key:'winPct', direction:'desc' });
  const [comparisonSort, setComparisonSort] = useState({ key:'rating', direction:'desc' });
  const [selectedMatchday, setSelectedMatchday] = useState('');
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  useEffect(()=>{const handlePointerDown=event=>{if(!divisionPickerRef.current?.contains(event.target))setDivisionMenuOpen(false);if(!compareTeamPickerRef.current?.contains(event.target))setCompareTeamMenuOpen(false);if(!compareWeekPickerRef.current?.contains(event.target))setCompareWeekMenuOpen(false);};document.addEventListener('pointerdown',handlePointerDown);return()=>document.removeEventListener('pointerdown',handlePointerDown);},[]);
  const [navigationHistory, setNavigationHistory] = useState([]);

  const currentRoute = { page: activePage, player: selectedPlayer, team: selectedTeam };
  const navigateTo = (page, player = '', team = '') => {
    setNavigationHistory(history => [...history, currentRoute]);
    setActivePage(page);
    setSelectedPlayer(player);
    setSelectedTeam(team);
  };
  const goToSection = page => {
    setNavigationHistory([]);
    setActivePage(page);
    setSelectedPlayer('');
    setSelectedTeam('');
    setSelectedMatchup(null);
  };
  const goBack = () => {
    const previous = navigationHistory[navigationHistory.length - 1];
    if (previous) {
      setNavigationHistory(history => history.slice(0, -1));
      setActivePage(previous.page);
      setSelectedPlayer(previous.player || '');
      setSelectedTeam(previous.team || '');
    } else {
      setSelectedPlayer('');
      setSelectedTeam('');
    }
  };
  const backLabel = (() => {
    const previous = navigationHistory[navigationHistory.length - 1];
    if (!previous) return activePage === 'Players' ? 'All players' : 'All teams';
    if (previous.player) return previous.player;
    if (previous.team) return previous.team;
    if (previous.page === 'Players') return 'All players';
    if (previous.page === 'Teams') return 'All teams';
    return previous.page;
  })();

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/league-data.json?v=${Date.now()}`, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('The processed league data file could not be found.'); return r.json(); })
      .then(setDataset).catch(e => setLoadError(e.message));
  }, []);

  const records = useMemo(() => {
    const rows = dataset?.records || [];
    return division === 'All Divisions' ? rows : rows.filter(r => r.division === division);
  }, [dataset, division]);

  const players = useMemo(() => {
    const map = new Map();
    for (const member of dataset?.roster || []) {
      if (division !== 'All Divisions' && member.division !== division) continue;
      if (!map.has(member.playerName)) map.set(member.playerName, { key:member.playerName, name:member.playerName, teams:new Set(), rows:[], games:0,wins:0,score:0,goals:0,assists:0,saves:0,shots:0,demos:0 });
      map.get(member.playerName).teams.add(member.teamName);
    }
    for (const r of records) {
      if (!map.has(r.playerName)) map.set(r.playerName, { key:r.playerName, name:r.playerName, teams:new Set(), rows:[], games:0,wins:0,score:0,goals:0,assists:0,saves:0,shots:0,demos:0 });
      const p=map.get(r.playerName); p.rows.push(r); p.teams.add(r.teamName); p.games+=n(r.stats.games); p.wins+=n(r.stats.wins);
      p.score+=n(r.stats.score); p.goals+=n(r.stats.goals); p.assists+=n(r.stats.assists); p.saves+=n(r.stats.saves); p.shots+=n(r.stats.shots);
      p.demos+=n(r.stats['demos inflicted'])-n(r.stats['demos taken']);
    }
    const weeks=[...new Set(records.map(r=>r.week).filter(Number.isFinite))].sort((a,b)=>a-b);
    const latestWeek=weeks.at(-1), previousWeek=weeks.length>1?weeks.at(-2):null;
    return [...map.values()].map(p=>{
      const current=matchRatingForRecords(p.rows.filter(r=>latestWeek==null||r.week==null||r.week<=latestWeek));
      const previousRows=previousWeek==null?[]:p.rows.filter(r=>r.week==null||r.week<=previousWeek);
      const previous=previousRows.length?matchRatingForRecords(previousRows):null;
      return {...p,rank:dataset?.playerRanks?.[p.name]||'',trackerUrl:dataset?.playerTrackerUrls?.[p.name]||'',teamList:[...p.teams].join(', '),
        winPct:p.games?p.wins/p.games*100:0,scorePerGame:avg(p.score,p.games),goalsPerGame:avg(p.goals,p.games),
        assistsPerGame:avg(p.assists,p.games),savesPerGame:avg(p.saves,p.games),
        rating:current.rating,ratingCategories:current.categories,ratingValues:current.values,
        ratingChange:previous?current.rating-previous.rating:null};
    }).sort((a,b)=>b.rating-a.rating);
  }, [records,dataset,division]);

  const teams = useMemo(() => {
    const map = new Map();
    for (const member of dataset?.roster || []) {
      if (division !== 'All Divisions' && member.division !== division) continue;
      if (!map.has(member.teamName)) map.set(member.teamName,{key:member.teamName,name:member.teamName,division:member.division,players:new Set(),rows:[],games:0,wins:0,score:0,goals:0,assists:0,saves:0,goalsAgainst:0,boostStolen:0,demosInflicted:0,demosTaken:0});
      map.get(member.teamName).players.add(member.playerName);
    }
    for (const r of records) {
      if (!map.has(r.teamName)) map.set(r.teamName,{key:r.teamName,name:r.teamName,players:new Set(),rows:[],games:0,wins:0,score:0,goals:0,assists:0,saves:0,goalsAgainst:0,boostStolen:0,demosInflicted:0,demosTaken:0});
      const t=map.get(r.teamName); t.players.add(r.playerName); t.rows.push(r); t.games+=n(r.stats.games); t.wins+=n(r.stats.wins);
      t.score+=n(r.stats.score); t.goals+=n(r.stats.goals); t.assists+=n(r.stats.assists); t.saves+=n(r.stats.saves); t.goalsAgainst+=n(r.stats['goals conceded']); t.boostStolen+=n(r.stats['amount stolen']); t.demosInflicted+=n(r.stats['demos inflicted']); t.demosTaken+=n(r.stats['demos taken']);
    }
    return [...map.values()].map(t=>({...t,division:t.rows[0]?.division||t.division||'',playerCount:t.players.size,winPct:t.games?t.wins/t.games*100:0,scorePerGame:avg(t.score,t.games),goalsPerGame:avg(t.goals,t.games),assistsPerGame:avg(t.assists,t.games),savesPerGame:avg(t.saves,t.games),goalsAgainstPerGame:avg(t.goalsAgainst,t.games),boostStolenPerGame:avg(t.boostStolen,t.games),demosForPerGame:avg(t.demosInflicted,t.games),demosAgainstPerGame:avg(t.demosTaken,t.games),rating:matchRatingForRecords(t.rows).rating})).sort((a,b)=>b.winPct-a.winPct);
  }, [records,dataset,division]);

  const filteredPlayers = players.filter(p=>p.name.toLowerCase().includes(query.toLowerCase())||p.teamList.toLowerCase().includes(query.toLowerCase()));
  const sortedFilteredPlayers = sortRows(filteredPlayers,playerSort.key,playerSort.direction).map((player,index)=>({...player,displayRank:index+1}));
  const sortedTeams = sortRows(teams,teamSort.key,teamSort.direction);
  const updateSort = (setter, key) => setter(current => ({
    key,
    direction: current.key===key ? (current.direction==='asc'?'desc':'asc') : (['name','playerName','teamName','teamList','rank'].includes(key)?'asc':'desc')
  }));
  const playerGames = records.reduce((s,r)=>s+n(r.stats.games),0);
  const totalScore = records.reduce((s,r)=>s+n(r.stats.score),0);
  const stats = dataset?.availableStats || [];
  const availableWeeks = [...new Set(records.map(r=>r.week).filter(v=>v!==null&&v!==undefined&&v!=='').map(Number).filter(Number.isFinite))].sort((a,b)=>a-b);
  const effectiveCompareWeek = selectedWeek === 'all' || selectedWeek === 'unmapped' ? '' : availableWeeks.includes(Number(selectedWeek)) ? String(Number(selectedWeek)) : String(availableWeeks.at(-1) ?? '');
  const compareRows = selectedWeek === 'all' ? records : selectedWeek === 'unmapped' ? [] : effectiveCompareWeek ? records.filter(r=>Number(r.week)===Number(effectiveCompareWeek)) : records;
  const compareTeamNames = [...new Set([...(dataset?.roster||[]).map(r=>r.teamName),...records.map(r=>r.teamName)].filter(Boolean))].sort();
  const effectiveCompareTeams = compareTeams.filter((name,index)=>compareTeamNames.includes(name)&&compareTeams.indexOf(name)===index);
  const scheduleRows = (dataset?.schedule || []).filter(m=>division==='All Divisions'||m.division===division);
  const scheduleMatchdays = [...new Set(scheduleRows.map(m=>m.matchday))].sort((a,b)=>a-b);
  const today = new Date();
  today.setHours(0,0,0,0);
  let scheduleYear = today.getFullYear();
  let previousScheduleMonth = -1;
  const scheduleDates = scheduleMatchdays.map(matchday => {
    const deadline = scheduleRows.find(m=>m.matchday===matchday)?.deadline || '';
    const parsed = deadline.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
    if (!parsed) return {matchday,date:null};
    const month = new Date(parsed[1]+' 1, 2000').getMonth();
    if (previousScheduleMonth >= 0 && month < previousScheduleMonth) scheduleYear++;
    previousScheduleMonth = month;
    return {matchday,date:new Date(scheduleYear,month,Number(parsed[2]))};
  });
  const currentScheduleDate = scheduleDates.filter(item=>item.date&&item.date<=today).at(-1)
    || scheduleDates.find(item=>item.date);
  const defaultMatchday = currentScheduleDate?.matchday ?? Math.max(0,...scheduleMatchdays);
  const effectiveMatchday = scheduleMatchdays.includes(Number(selectedMatchday)) ? Number(selectedMatchday) : defaultMatchday;
  const matchupRows = scheduleRows.filter(m=>m.matchday===effectiveMatchday).map(m=>{
    const weekRows = m.statsWeek===null ? [] : records.filter(r=>r.division===m.division&&r.week===m.statsWeek);
    const team1Stats = teamSeriesStats(weekRows,m.team1), team2Stats = teamSeriesStats(weekRows,m.team2);
    const hasBoth = team1Stats.hasData && team2Stats.hasData;
    const exact = hasBoth && team1Stats.exact && team2Stats.exact;
    const reconciles = exact && team1Stats.wins===team2Stats.losses && team2Stats.wins===team1Stats.losses && team1Stats.teamGames===team2Stats.teamGames;
    const hasManualResult = Number.isInteger(m.resultTeam1Wins) && Number.isInteger(m.resultTeam2Wins);
    const importedFinal = reconciles && team1Stats.complete && team2Stats.complete;
    const final = importedFinal || hasManualResult;
    const status = final ? 'Final' : !m.statsWeek ? 'Stats week not mapped' : !hasBoth ? 'Waiting for imported stats' : !exact ? 'Player stats are incomplete' : !reconciles ? 'Team totals do not reconcile' : 'Partial series data';
    const scoreText = importedFinal ? team1Stats.wins+' - '+team2Stats.wins : hasManualResult ? m.resultTeam1Wins+' - '+m.resultTeam2Wins : exact ? team1Stats.wins+' - '+team2Stats.wins : '-';
    return {...m, scoreText, resultStatus:status, resultFinal:final, scoreIsPartial:!importedFinal&&hasManualResult};
  });
  const standingsGroups = [...new Set(scheduleRows.map(m=>m.division))].sort((a,b)=>a==='Premier'?-1:b==='Premier'?1:a.localeCompare(b)).map(league=>{
    const table=new Map();
    const ensureTeam=name=>{if(!table.has(name))table.set(name,{name,played:0,matchWins:0,matchLosses:0,gameWins:0,gameLosses:0,points:0});return table.get(name);};
    scheduleRows.filter(m=>m.division===league).forEach(m=>{ensureTeam(m.team1);ensureTeam(m.team2);});
    scheduleRows.filter(m=>m.division===league&&m.statsWeek!==null).forEach(m=>{
      const weekRows=records.filter(r=>r.division===league&&r.week===m.statsWeek);
      const home=teamSeriesStats(weekRows,m.team1),away=teamSeriesStats(weekRows,m.team2);
      const exact=home.hasData&&away.hasData&&home.exact&&away.exact;
      const reconciles=exact&&home.wins===away.losses&&away.wins===home.losses&&home.teamGames===away.teamGames;
      const hasManualResult=Number.isInteger(m.resultTeam1Wins)&&Number.isInteger(m.resultTeam2Wins);
      const importedFinal=reconciles&&home.complete&&away.complete;
      const final=importedFinal||hasManualResult;
      if(!final)return;
      const h=ensureTeam(m.team1),a=ensureTeam(m.team2);
      const homeWins=importedFinal?home.wins:m.resultTeam1Wins;
      const awayWins=importedFinal?away.wins:m.resultTeam2Wins;
      h.played++;a.played++;
      h.gameWins+=homeWins;a.gameWins+=awayWins;
      h.gameLosses+=awayWins;a.gameLosses+=homeWins;
      if(homeWins>awayWins){h.matchWins++;a.matchLosses++;h.points+=homeWins+1;a.points+=awayWins;}
      else if(awayWins>homeWins){a.matchWins++;h.matchLosses++;a.points+=awayWins+1;h.points+=homeWins;}
    });
    return {division:league,teams:[...table.values()].sort((a,b)=>b.points-a.points||b.matchWins-a.matchWins||b.gameWins-a.gameWins||a.name.localeCompare(b.name))};
  });
  const comparisonMatchup = selectedWeek!=='all'&&effectiveCompareTeams.length===2&&selectedMatchup&&selectedMatchup.team1===effectiveCompareTeams[0]&&selectedMatchup.team2===effectiveCompareTeams[1]?selectedMatchup:null;
  const comparisonPeriodWeeks = availableWeeks.filter(w=>selectedWeek==='all'||w<=Number(effectiveCompareWeek));
  const comparisonPeriodLabel = selectedWeek==='all'?(comparisonPeriodWeeks.length===0?'No stats weeks':comparisonPeriodWeeks.length===1?'Week '+comparisonPeriodWeeks[0]:comparisonPeriodWeeks.every((w,i)=>i===0||w===comparisonPeriodWeeks[i-1]+1)?`Weeks ${comparisonPeriodWeeks[0]}-${comparisonPeriodWeeks.at(-1)}`:`Weeks ${comparisonPeriodWeeks.join(', ')}`):effectiveCompareWeek?'Week '+effectiveCompareWeek:'No stats week';
  const comparisonCurrentWeek = comparisonPeriodWeeks.at(-1);
  const comparisonPreviousWeek = comparisonPeriodWeeks.length>1?comparisonPeriodWeeks.at(-2):null;
  const comparisonRatingDelta = rows => {
    if(comparisonCurrentWeek==null||comparisonPreviousWeek==null)return null;
    const current=rows.filter(r=>r.week==null||Number(r.week)<=comparisonCurrentWeek);
    const previous=rows.filter(r=>r.week==null||Number(r.week)<=comparisonPreviousWeek);
    return current.length&&previous.length?matchRatingForRecords(current).rating-matchRatingForRecords(previous).rating:null;
  };
  const comparisonTeams = effectiveCompareTeams.map(name=>{ const rows=compareRows.filter(r=>r.teamName===name); const allTeamRows=records.filter(r=>r.teamName===name); const rosterTeam=dataset?.roster?.find(r=>r.teamName===name); const games=rows.reduce((s,r)=>s+n(r.stats.games),0); const wins=rows.reduce((s,r)=>s+n(r.stats.wins),0); const rating=games?matchRatingForRecords(rows).rating:null; return {name,rows,division:rows[0]?.division||rosterTeam?.division,rating,ratingChange:comparisonRatingDelta(allTeamRows),games,wins,players:[...new Set(rows.map(r=>r.playerName))],winPct:games?wins/games*100:0}; });
  const comparisonPlayers = compareRows.filter(r=>effectiveCompareTeams.includes(r.teamName)).reduce((groups,r)=>{ const key=r.teamName+'::'+r.playerName; if(!groups.has(key)) groups.set(key,{key,playerName:r.playerName,teamName:r.teamName,rows:[]}); groups.get(key).rows.push(r); return groups; },new Map());
  const playerComparisonRows = [...comparisonPlayers.values()].map(p=>{ const rating=matchRatingForRecords(p.rows); const allPlayerRows=records.filter(r=>r.teamName===p.teamName&&r.playerName===p.playerName); const games=p.rows.reduce((sum,r)=>sum+n(r.stats.games),0); const wins=p.rows.reduce((sum,r)=>sum+n(r.stats.wins),0); return {...p,rank:dataset?.playerRanks?.[p.playerName]||'',rating:rating.rating,ratingChange:comparisonRatingDelta(allPlayerRows),categories:rating.categories,values:rating.values,games,winPct:games?wins/games*100:0}; });
  const expandedTeamComparisons = comparisonTeams.map(team=>{
    const totals=team.rows.reduce((a,r)=>{const x=r.stats||{};a.score+=n(x.score);a.goals+=n(x.goals);a.assists+=n(x.assists);a.saves+=n(x.saves);a.goalsAgainst+=n(x['goals conceded']);a.boostStolen+=n(x['amount stolen']);a.demosFor+=n(x['demos inflicted']);a.demosAgainst+=n(x['demos taken']);return a;},{score:0,goals:0,assists:0,saves:0,goalsAgainst:0,boostStolen:0,demosFor:0,demosAgainst:0});
    const g=team.games||0;
    const teamRating=matchRatingForRecords(team.rows);
    return {...team,metrics:[
      {key:'rating',label:'MATCH RATING',value:team.rating,barValue:teamRating.rating,display:team.rating==null?'-':fmtRating(team.rating)},
      {key:'winPct',label:'WIN RATE',value:team.winPct,barValue:teamRating.categories.winPct,display:fmtWinPct(team.winPct)+'%'},
      {key:'scorePerGame',label:'SCORE / GAME',value:avg(totals.score,g),barValue:teamRating.categories.scorePerGame,display:fmt(avg(totals.score,g))},
      {key:'goalsPerGame',label:'GOALS / GAME',value:avg(totals.goals,g),barValue:teamRating.categories.goalsPerGame,display:fmt(avg(totals.goals,g))},
      {key:'assistsPerGame',label:'ASSISTS / GAME',value:avg(totals.assists,g),barValue:teamRating.categories.assistsPerGame,display:fmt(avg(totals.assists,g))},
      {key:'savesPerGame',label:'SAVES / GAME',value:avg(totals.saves,g),display:fmt(avg(totals.saves,g))},
      {key:'goalsAgainstPerGame',label:'GOALS AGAINST / GAME',value:avg(totals.goalsAgainst,g),display:fmt(avg(totals.goalsAgainst,g))},
      {key:'gaSaves',label:'GA-SAVES / GAME',value:avg(totals.goalsAgainst,g)-avg(totals.saves,g),barValue:teamRating.categories.gaSaves,display:fmt(avg(totals.goalsAgainst,g)-avg(totals.saves,g))},
      {key:'boostStolenPerGame',label:'BOOST STOLEN / GAME',value:avg(totals.boostStolen,g),barValue:teamRating.categories.boostStolenPerGame,display:fmt(avg(totals.boostStolen,g))},
      {key:'demosForPerGame',label:'DEMOS FOR / GAME',value:avg(totals.demosFor,g),display:fmt(avg(totals.demosFor,g))},
      {key:'demosAgainstPerGame',label:'DEMOS AGAINST / GAME',value:avg(totals.demosAgainst,g),display:fmt(avg(totals.demosAgainst,g))}
    ]};
  });
  const expandedRosterPlayers = comparisonTeams.map(team=>{
    const members=(dataset?.roster||[]).filter(member=>member.teamName===team.name&&(division==='All Divisions'||member.division===division));
    const uniqueNames=[...new Set(members.map(member=>member.playerName).filter(Boolean))];
    return {teamName:team.name,players:uniqueNames.map(playerName=>playerComparisonRows.find(player=>player.teamName===team.name&&player.playerName===playerName)||{
      key:team.name+'::'+playerName,playerName,teamName:team.name,rows:[],rank:dataset?.playerRanks?.[playerName]||'',rating:null,games:0,winPct:null
    })};
  });
  const sortedComparisonPlayers = sortRows(playerComparisonRows,comparisonSort.key,comparisonSort.direction);
  const statRows = [...records].sort((a,b)=>n(b.stats[selectedStat])-n(a.stats[selectedStat])).slice(0,50);
  const activePlayer = players.find(p=>p.name===selectedPlayer);
  const auditPlayer = players.find(p=>p.name===selectedAuditPlayer) || players[0];
  const activeTeam = teams.find(t=>t.name===selectedTeam);
  const activeTeamPlayers = activeTeam ? players.filter(p=>activeTeam.players.has(p.name)).sort((a,b)=>b.rating-a.rating) : [];
  const activeTeamMatchHistory = activeTeam ? (dataset?.schedule||[]).filter(m=>m.division===activeTeam.division&&(m.team1===activeTeam.name||m.team2===activeTeam.name)).map(m=>{
    const weekRows=m.statsWeek===null?[]:records.filter(r=>r.division===m.division&&r.week===m.statsWeek);
    const team1Stats=teamSeriesStats(weekRows,m.team1),team2Stats=teamSeriesStats(weekRows,m.team2);
    const exact=team1Stats.hasData&&team2Stats.hasData&&team1Stats.exact&&team2Stats.exact;
    const reconciles=exact&&team1Stats.wins===team2Stats.losses&&team2Stats.wins===team1Stats.losses&&team1Stats.teamGames===team2Stats.teamGames;
    const importedFinal=reconciles&&team1Stats.complete&&team2Stats.complete;
    const hasManualResult=Number.isInteger(m.resultTeam1Wins)&&Number.isInteger(m.resultTeam2Wins);
    if(!importedFinal&&!hasManualResult)return null;
    const team1Wins=importedFinal?team1Stats.wins:m.resultTeam1Wins;
    const team2Wins=importedFinal?team2Stats.wins:m.resultTeam2Wins;
    const isTeam1=m.team1===activeTeam.name;
    const wins=isTeam1?team1Wins:team2Wins,losses=isTeam1?team2Wins:team1Wins;
    return {...m,opponent:isTeam1?m.team2:m.team1,historyScore:wins+' - '+losses,historyResult:wins>losses?'W':'L'};
  }).filter(Boolean).sort((a,b)=>b.matchday-a.matchday) : [];
  const playerDivision = activePlayer?.rows[0]?.division;
  const historyWeekCount = Math.max(1,...(dataset?.schedule||[]).filter(m=>m.division===playerDivision).map(m=>m.matchday));
  const playerHistory = activePlayer ? [...new Set(activePlayer.rows.map(r=>r.week).filter(Number.isFinite))].sort((a,b)=>a-b).map(week=>{ const weekly=activePlayer.rows.filter(r=>r.week===week); const cumulative=activePlayer.rows.filter(r=>r.week<=week); const weeklyTeams=[...new Set(weekly.map(r=>r.teamName))]; const opponents=[...new Set((dataset?.schedule||[]).filter(m=>m.division===playerDivision&&m.statsWeek===week&&(weeklyTeams.includes(m.team1)||weeklyTeams.includes(m.team2))).map(m=>weeklyTeams.includes(m.team1)?m.team2:m.team1))]; return {week:'Week '+week,weekNumber:week,weekly:matchRatingForRecords(weekly).rating,cumulative:matchRatingForRecords(cumulative).rating,games:weekly.reduce((sum,r)=>sum+n(r.stats.games),0),opponents}; }) : [];
  const description = {
    Overview:'', Players:'', Teams:'', Rankings:'All players and teams, ranked by Match Rating.', Compare:'', 'Stat Explorer':''
  }[activePage];

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e=>{e.preventDefault();goToSection('Overview')}}><span className="brand-mark"><img src={sglLogo} alt="SGL" style={{ width:34, height:34, objectFit:"contain" }}/></span><span className="brand-copy"><strong>RL<span>STATS</span></strong><small>LEAGUE ANALYTICS</small></span></a>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">{navItems.map(({label,icon:Icon})=><button key={label} className={activePage===label?'nav-item active':'nav-item'} onClick={()=>goToSection(label)}><Icon size={18}/><span>{label}</span>{activePage===label&&<span className="nav-indicator"/>}</button>)}</nav>
      
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb"><span>LEAGUE HUB</span><b>/</b>{activePage.toUpperCase()}</div><div className="topbar-right"><div className="notification-wrap"><button className={(dataset?.importWarnings?.length||dataset?.duplicates?.length)?(notificationsOpen?'notification-button active has-issues':'notification-button has-issues'):(notificationsOpen?'notification-button active clear':'notification-button clear')} onClick={()=>setNotificationsOpen(v=>!v)} aria-label="Import notifications" aria-expanded={notificationsOpen}><Bell size={17}/>{((dataset?.importWarnings?.length||0)+(dataset?.duplicates?.length||0))>0&&<i>{(dataset?.importWarnings?.length||0)+(dataset?.duplicates?.length||0)}</i>}</button>{notificationsOpen&&<div className="notification-panel"><div className="notification-heading"><strong>Import notifications</strong><button onClick={()=>setNotificationsOpen(false)} aria-label="Close notifications">×</button></div>{!dataset&&<p>League data is still loading.</p>}{dataset&&!(dataset.importWarnings?.length||dataset.duplicates?.length)&&<div className="notification-empty"><span>✓</span><strong>All clear</strong><p>No CSV import issues were reported in the latest build.</p></div>}{dataset?.importWarnings?.map(issue=><article className="notification-item" key={issue.file}><div className="notification-item-title"><AlertTriangle size={15}/><strong>{issue.file}</strong></div>{issue.missingHeaders?.length>0&&<p>Missing required columns: {issue.missingHeaders.join(', ')}</p>}{issue.unknownPlayers?.length>0&&<p><b>Unrecognized players:</b> {issue.unknownPlayers.join(', ')}. Add these to <code>data/roster.csv</code>.</p>}{issue.unknownTeams?.length>0&&<p><b>Unrecognized teams:</b> {issue.unknownTeams.join(', ')}. Add these to <code>data/team-aliases.csv</code>.</p>}{issue.invalidStats?.length>0&&<p><b>Invalid stat values:</b> {issue.invalidStats.map(x=>x.column+' ('+x.examples.join(', ')+')').join('; ')}.</p>}{issue.blankNameRows>0&&<p>{issue.blankNameRows} row(s) had a blank player or team name.</p>}{issue.type==='empty'&&<p>This file is empty or could not be read.</p>}<p className="notification-skipped">{issue.skippedRows||0} row(s) skipped</p></article>)}{dataset?.duplicates?.map(issue=><article className="notification-item" key={issue.file}><div className="notification-item-title"><AlertTriangle size={15}/><strong>Duplicate export</strong></div><p>{issue.file} matches {issue.duplicateOf} and was skipped.</p></article>)}</div>}</div></div></header>
      <section className="page-heading"><div><h1>{activePage==='Overview'?<>League <em>Overview</em></>:activePage}</h1>{description&&<p>{description}</p>}</div><div className="division-select"><span className="division-label">DIVISION</span><div className="division-picker" ref={divisionPickerRef}><button type="button" className="division-picker-trigger" aria-expanded={divisionMenuOpen} onClick={()=>setDivisionMenuOpen(v=>!v)}><img src={import.meta.env.BASE_URL + (division==='Premier'?'assets/league/SGL%20Premier.png':division==='Championship'?'assets/league/SGL%20Championship.png':'assets/league/sgl-logo.png')} alt=""/><span>{division}</span><ChevronDown size={16}/></button>{divisionMenuOpen&&<div className="division-picker-menu">{divisions.map(x=><button type="button" key={x} className={division===x?'selected':''} onClick={()=>{setDivision(x);setDivisionMenuOpen(false)}}><img src={import.meta.env.BASE_URL + (x==='Premier'?'assets/league/SGL%20Premier.png':x==='Championship'?'assets/league/SGL%20Championship.png':'assets/league/sgl-logo.png')} alt=""/><span>{x}</span>{division===x&&<span className="division-check">✓</span>}</button>)}</div>}</div></div></section>
      {loadError&&<section className="notice"><strong>Data could not be loaded</strong><p>{loadError}</p></section>}
      {!dataset&&!loadError&&<section className="notice"><strong>Loading league data...</strong><p>Reading the processed weekly exports.</p></section>}

      {dataset?.duplicates?.length > 0 && <section className="notice"><div><strong>Duplicate exports skipped</strong><p>{dataset.duplicates.length} file(s) had identical contents to an existing import and were skipped.</p></div></section>}
      {activePage==='Overview'&&<>
      <section className="content-grid">
        <article className="panel performance-panel"><div className="panel-heading"><div><span className="panel-kicker">LEAGUE SNAPSHOT</span><h2>Player rankings</h2></div><div className="ranking-preview-actions"><button type="button" className="text-button" onClick={()=>goToSection('Players')}>View all <ArrowUpRight size={14}/></button></div></div><DataTable columns={[{key:'position',label:'#',render:r=>players.findIndex(p=>p.name===r.name)+1},{key:'name',label:'PLAYER',render:r=><button className="entity-link" onClick={()=>navigateTo('Players',r.name)}>{r.name}</button>},{key:'rank',label:'RANK',render:r=><RankBadge rank={r.rank}/>},{key:'teamList',label:'TEAM',render:r=><span className="top-player-team"><button className="entity-link team-entity-link" onClick={()=>{const team=[...r.teams][0];if(team)navigateTo('Teams','',team)}}><TeamName name={[...r.teams][0]||r.teamList}/></button>{division==='All Divisions'&&[...new Set(r.rows.map(row=>row.division).filter(Boolean))].map(league=><DivisionBadge key={league} division={league}/>)}</span>},{key:'rating',label:'RATING',render:r=>r.games>0?<RatingWithDelta value={r.rating} delta={r.ratingChange} compact/>:'-'}]} rows={players.slice(0,10)} empty="Player stats will appear after importing a weekly CSV."/></article>
        <article className="panel leaderboard-panel matchup-panel"><div className="panel-heading"><div><span className="panel-kicker">LEAGUE SCHEDULE</span><h2>Weekly matchup review</h2></div><div className="matchday-select"><div className="matchday-navigation"><button type="button" aria-label="Previous matchday" title="Previous matchday" disabled={scheduleMatchdays.indexOf(effectiveMatchday)<=0} onClick={()=>setSelectedMatchday(String(scheduleMatchdays[scheduleMatchdays.indexOf(effectiveMatchday)-1]))}><ChevronLeft size={16}/></button><strong>Matchday {effectiveMatchday||'-'}</strong><button type="button" aria-label="Next matchday" title="Next matchday" disabled={scheduleMatchdays.indexOf(effectiveMatchday)<0||scheduleMatchdays.indexOf(effectiveMatchday)>=scheduleMatchdays.length-1} onClick={()=>setSelectedMatchday(String(scheduleMatchdays[scheduleMatchdays.indexOf(effectiveMatchday)+1]))}><ChevronRight size={16}/></button></div></div></div>{['Premier','Championship'].filter(name=>matchupRows.some(r=>r.division===name)).map(name=><div className="matchup-division-section" key={name}><div className="matchup-division-heading"><DivisionBadge division={name}/></div><DataTable columns={[{key:'team1',label:'HOME',render:r=><span className="standings-team-name matchup-team-name"><TeamName name={r.team1}/></span>},{key:'series',label:'SERIES',render:r=><span className="matchup-result"><strong className={'matchup-score'+((r.resultStatus==='Partial series data'||r.scoreIsPartial)?' matchup-score-partial':'')}>{r.scoreText}</strong>{r.resultStatus!=='Final'&&r.resultStatus!=='Waiting for imported stats'&&r.resultStatus!=='Stats week not mapped'&&r.resultStatus!=='Partial series data'&&<small>{r.resultStatus}</small>}</span>},{key:'team2',label:'AWAY',render:r=><span className="standings-team-name matchup-team-name"><TeamName name={r.team2}/></span>}]} rows={matchupRows.filter(r=>r.division===name)} onRowClick={r=>{setCompareTeams([r.team1,r.team2]);setSelectedWeek(r.statsWeek==null?'unmapped':String(r.statsWeek));setSelectedMatchup(r);navigateTo('Compare');}} empty="No matchups are listed for this matchday."/></div>)}{!matchupRows.length&&<div className="table-empty">No matchups are listed for this matchday.</div>}</article>
      </section>
      <section className="panel standings-panel">
        <div className="panel-heading"><div><span className="panel-kicker">LEAGUE TABLES</span><h2>Standings</h2></div></div>
        <div className="standings-grid">{standingsGroups.map(group=><div className="standings-division" key={group.division}><div className="standings-division-heading"><DivisionBadge division={group.division}/></div><DataTable columns={[{key:'position',label:'#',render:(r)=>group.teams.indexOf(r)+1},{key:'name',label:'TEAM',render:r=><span className="standings-team-name"><TeamName name={r.name}/></span>},{key:'played',label:'MP'},{key:'matchWins',label:'MW'},{key:'matchLosses',label:'ML'},{key:'gameWins',label:'GW'},{key:'gameLosses',label:'GL'},{key:'points',label:'PTS',render:r=><strong className="standings-points">{r.points}</strong>}]} rows={group.teams} empty="Standings will appear when match results are confirmed." /></div>)}</div>
      </section>
</>}
      {activePage==='Players'&&<section className="panel full-panel rankings-page">
        {activePlayer ? <>
          <button className="text-button back-button" onClick={goBack}><ArrowLeft size={15}/> {backLabel}</button>
          <div className="profile-heading"><div><span className="panel-kicker">PLAYER PROFILE</span><h2 className="profile-name-line"><span className="profile-player-name">{activePlayer.name}</span><RankBadge rank={activePlayer.rank}/>{activePlayer.trackerUrl&&<a className="tracker-profile-link" href={activePlayer.trackerUrl} target="_blank" rel="noreferrer"><img className="tracker-link-logo" src="/Rocket-League-Stats/assets/league/TRN.png" alt="" />Tracker Network <ArrowUpRight size={14}/></a>}</h2><div className="profile-team"><span className="profile-team-links">{[...activePlayer.teams].map(team=>{const teamDivision=activePlayer.rows.find(r=>r.teamName===team)?.division;return <span className="profile-team-entry" key={team}><button className="entity-link team-entity-link" onClick={()=>navigateTo('Teams','',team)}><TeamName name={team}/></button><DivisionBadge division={teamDivision} profile/></span>})}</span></div></div><div className="profile-rating"><span>MATCH RATING</span><strong>{fmtDetailed(activePlayer.rating)}</strong>{activePlayer.ratingChange!=null&&<small className={activePlayer.ratingChange>0?'rating-delta-positive':activePlayer.ratingChange<0?'rating-delta-negative':'rating-delta-neutral'}>{activePlayer.ratingChange==null||activePlayer.ratingChange===0?'-':(activePlayer.ratingChange>0?'+':'')+fmt(activePlayer.ratingChange)}</small>}</div></div>
          <div className="profile-stats"><div><span>GAMES</span><strong>{fmtCount(activePlayer.games)}</strong></div><div><span>WIN RATE</span><strong>{Math.round(n(activePlayer.winPct))}%</strong></div><div><span>SCORE</span><strong>{fmtCount(activePlayer.score)}</strong></div><div><span>GOALS</span><strong>{fmtCount(activePlayer.goals)}</strong></div><div><span>ASSISTS</span><strong>{fmtCount(activePlayer.assists)}</strong></div><div><span>SAVES</span><strong>{fmtCount(activePlayer.saves)}</strong></div></div>
          <div className="profile-grid">
            <article className="profile-section"><div className="panel-heading"><h3>Match Rating history</h3></div>
              {playerHistory.length>0?<div className="profile-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={playerHistory} margin={{top:12,right:14,left:-18,bottom:2}}><CartesianGrid stroke="#29313c" strokeDasharray="3 3"/><XAxis type="number" dataKey="weekNumber" domain={[1,historyWeekCount]} ticks={Array.from({length:historyWeekCount},(_,i)=>i+1)} tickFormatter={value=>`W${value}`} tick={{fill:'#8d99aa',fontSize:10}} axisLine={{stroke:'#38404c'}} tickLine={false} allowDecimals={false}/><YAxis domain={[0,10]} tick={{fill:'#8d99aa',fontSize:10}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'#111820',border:'1px solid #343d49',borderRadius:6,color:'#edf2f9'}} formatter={(value,name)=>[fmtDetailed(value),name]}/><Line type="monotone" dataKey="cumulative" name="Season rating" stroke="#00aeef" strokeWidth={2.5} dot={{r:3}}/><Line type="monotone" dataKey="weekly" name="Weekly rating" stroke="#f02f38" strokeWidth={2} dot={{r:3}}/></LineChart></ResponsiveContainer></div>:<div className="table-empty">No weekly history available.</div>}
              <div className="chart-legend"><span><i className="legend-blue"/>Season rating</span><span><i className="legend-lime"/>Weekly rating</span></div>
            </article>
            <article className="profile-section"><div className="panel-heading"><h3>Rating breakdown</h3></div><div className="rating-breakdown">{matchRatingCategories.map(c=><div className="rating-row profile-rating-row" key={c.key}><div className="profile-rating-meta"><span className="profile-rating-label">{c.label}</span><small className="profile-raw-value">{(c.key==='winPct'?fmtWinPct(activePlayer.ratingValues[c.key]):fmt(activePlayer.ratingValues[c.key]))}{c.key==='winPct'?'%':''}</small></div><RatingMeter value={activePlayer.ratingCategories[c.key]}/><strong className="profile-category-score">{fmtRating(activePlayer.ratingCategories[c.key])}</strong></div>)}</div></article>
          </div>
          <article className="profile-section profile-week-table"><div className="panel-heading"><h3>Weekly results</h3></div><DataTable columns={[{key:'week',label:'WEEK'},{key:'opponents',label:'OPPONENTS',render:r=><div className="player-week-opponents">{r.opponents.length?r.opponents.map(team=><button type="button" className="entity-link team-entity-link" key={team} onClick={()=>navigateTo('Teams','',team)}><TeamName name={team}/></button>):'-'}</div>},{key:'games',label:'GAMES',render:r=>r.games>0?fmtCount(r.games):'-'},{key:'weekly',label:'WEEKLY RATING',render:r=>fmt(r.weekly)},{key:'cumulative',label:'SEASON RATING',render:r=>fmt(r.cumulative)}]} rows={playerHistory.slice().reverse()} empty="No weekly results yet."/></article>
        </> : <>
          <div className="player-rankings-export"><div className="panel-heading rankings-heading"><div><span className="panel-kicker">PLAYER LEADERBOARD</span><h2>{players.length} players</h2><p className="rankings-subtitle">Ranked by Match Rating</p></div><button data-export-ignore="true" type="button" className="export-button" onClick={async()=>{setExportingComparison(true);try{await downloadElementPng('.player-rankings-export',`sgl-${division.toLowerCase().replace(/\\s+/g,'-')}-player-rankings.png`,{paddingTop:14,paddingBottom:0,trimToSelector:'.players-leaderboard-table',bottomGap:8});}catch(error){console.error(error);window.alert('The player rankings image could not be exported. Please try again.');}finally{setExportingComparison(false);}}} disabled={exportingComparison}><Download size={15}/>{exportingComparison?'Creating PNG...':'Export PNG'}</button></div>
          <div className="search-box" data-export-ignore="true"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search players or teams..."/></div>
          <div className="players-leaderboard-table"><DataTable columns={[{key:'position',label:'#',render:r=>r.displayRank},{key:'name',label:'PLAYER',render:r=><button className="entity-link" onClick={()=>navigateTo('Players',r.name)}>{r.name}</button>},{key:'rank',label:'RANK',render:r=><RankBadge rank={r.rank}/>},{key:'teamList',label:'TEAM',render:r=><span className="top-player-team">{[...r.teams].map(team=><span className="rankings-team-link" key={team}><button className="entity-link team-entity-link" onClick={()=>navigateTo('Teams','',team)}><TeamName name={team}/></button>{division==='All Divisions'&&[...new Set(r.rows.filter(row=>row.teamName===team).map(row=>row.division).filter(Boolean))].map(league=><DivisionBadge key={league} division={league}/>)}</span>)}</span>},{key:'games',label:'GAMES',render:r=>fmtCount(r.games)},{key:'rating',label:'MATCH RATING',render:r=>r.games>0?<RatingWithDelta value={r.rating} delta={r.ratingChange} compact/>:'-'},...matchRatingCategories.map(c=>({key:c.key,label:c.label,render:r=>r.games>0?<div className="comparison-category-cell"><strong>{fmtRating(r.ratingCategories[c.key])}</strong><small>{(c.key==='winPct'?fmtWinPct(r.ratingValues[c.key]):fmt(r.ratingValues[c.key]))}{c.key==='winPct'?'%':''}</small></div>:'-'}))]} rows={sortedFilteredPlayers} sortKey={playerSort.key} sortDirection={playerSort.direction} onSort={key=>updateSort(setPlayerSort,key)} empty="No players found."/></div></div>
        </>}
      </section>}
      {activePage==='Teams'&&<section className="panel full-panel">{activeTeam ? <><button className="text-button back-button" onClick={goBack}><ArrowLeft size={15}/> {backLabel}</button><div className="profile-heading"><div><span className="panel-kicker">TEAM PROFILE</span><h2 className="profile-name-line team-profile-name-line"><TeamName name={activeTeam.name}/><DivisionBadge division={activeTeam.division} profile/></h2></div><div className="profile-rating"><span>TEAM MATCH RATING</span><strong>{fmtRating(activeTeam.rating)}</strong></div></div><div className="profile-stats team-profile-stats"><div><span>PLAYER-GAMES</span><strong>{fmtCount(activeTeam.games)}</strong></div><div><span>PLAYER GAME WIN RATE</span><strong>{Math.round(n(activeTeam.winPct))}%</strong></div><div><span>SCORE / GAME</span><strong>{fmt(activeTeam.scorePerGame)}</strong></div><div><span>GOALS / GAME</span><strong>{fmt(activeTeam.goalsPerGame)}</strong></div><div><span>ASSISTS / GAME</span><strong>{fmt(activeTeam.assistsPerGame)}</strong></div><div className="team-profile-split-stat"><span>GOALS AGAINST / SAVES</span><div><span><small>GA / GAME</small><strong>{fmt(activeTeam.goalsAgainstPerGame)}</strong></span><span><small>SAVES / GAME</small><strong>{fmt(activeTeam.savesPerGame)}</strong></span></div></div><div><span>BOOST STOLEN / GAME</span><strong>{fmt(activeTeam.boostStolenPerGame)}</strong></div><div className="team-profile-split-stat"><span>DEMOS / GAME</span><div><span><small>FOR</small><strong>{fmt(activeTeam.demosForPerGame)}</strong></span><span><small>AGAINST</small><strong>{fmt(activeTeam.demosAgainstPerGame)}</strong></span></div></div></div><div className="team-profile-details-grid"><article className="profile-section team-profile-roster-section"><div className="panel-heading"><h3>Player performance</h3></div><div className="team-profile-roster-table"><DataTable columns={[{key:'name',label:'PLAYER'},{key:'rank',label:'RANK',render:r=><RankBadge rank={r.rank}/>},{key:'winPct',label:'WIN RATE',render:r=>Math.round(n(r.winPct))+'%'},{key:'rating',label:'MATCH RATING',render:r=><RatingWithDelta value={r.rating} delta={r.ratingChange} compact/>}]} rows={activeTeamPlayers} onRowClick={r=>navigateTo('Players',r.name)} empty="No player stats found for this team."/></div></article><article className="profile-section team-profile-history-section"><div className="panel-heading"><h3>Match history</h3></div><div className="team-profile-history-table"><DataTable columns={[{key:'matchday',label:'MATCHDAY',render:r=>r.matchday},{key:'opponent',label:'OPPONENT',render:r=><button className="entity-link team-history-opponent-link" onClick={()=>navigateTo('Teams','',r.opponent)}><TeamName name={r.opponent}/></button>},{key:'historyResult',label:'RESULT',render:r=><strong className={r.historyResult==='W'?'team-history-win':'team-history-loss'}>{r.historyResult}</strong>},{key:'historyScore',label:'SCORE',render:r=><strong className="matchup-score">{r.historyScore}</strong>}]} rows={activeTeamMatchHistory} empty="Completed match results will appear here."/></div></article></div></> : <><div className="panel-heading"><div><span className="panel-kicker">TEAM DIRECTORY</span><h2>{teams.length} teams</h2></div></div><div className="team-directory-table"><DataTable columns={[{key:'name',label:'TEAM',render:r=><span className="top-player-team"><button className="entity-link team-entity-link" onClick={()=>navigateTo('Teams','',r.name)}><TeamName name={r.name}/></button>{division==='All Divisions'&&<DivisionBadge division={r.division}/>}</span>},{key:'playerCount',label:'PLAYERS'},{key:'rating',label:'MATCH RATING',render:r=>selectedWeek==='all'?<RatingWithDelta value={r.rating} delta={r.ratingChange} compact/>:<RatingMeter value={r.rating} compact/>},{key:'games',label:'PLAYER-GAMES',render:r=>fmtCount(r.games)},{key:'winPct',label:'PLAYER GAME WIN %',render:r=>fmtWinPct(r.winPct)+'%'},{key:'scorePerGame',label:'SCORE/G',render:r=>fmt(r.scorePerGame)},{key:'goals',label:'GOALS',render:r=>fmt(r.goals)},{key:'assists',label:'ASSISTS',render:r=>fmt(r.assists)}]} rows={sortedTeams} sortKey={teamSort.key} sortDirection={teamSort.direction} onSort={key=>updateSort(setTeamSort,key)} onRowClick={r=>navigateTo('Teams','',r.name)} empty="No team data available for this division."/></div></>}</section>}
      {activePage==='Compare'&&<section className="panel full-panel">
        <div className="panel-heading"><div><span className="panel-kicker">MATCH RATING</span><h2>Team comparison</h2></div></div>
        <div className="compare-view-switch" role="group" aria-label="Comparison type"><button type="button" className={compareView==='team-stats'?'active':''} aria-pressed={compareView==='team-stats'} onClick={()=>setCompareView('team-stats')}>Team Stats</button><button type="button" className={compareView==='team-player'?'active':''} aria-pressed={compareView==='team-player'} onClick={()=>setCompareView('team-player')}>Team Matchup</button></div>
        <div className="compare-controls">
          <label className="stat-select"><span>STATS WEEK</span><div className="compare-team-picker" ref={compareWeekPickerRef}><button type="button" className="compare-team-picker-trigger" aria-expanded={compareWeekMenuOpen} disabled={!availableWeeks.length} onClick={()=>setCompareWeekMenuOpen(open=>!open)}><span>{selectedWeek==='all'?'All Weeks':effectiveCompareWeek?'Week '+effectiveCompareWeek:'No stats weeks available'}</span><ChevronDown size={16}/></button>{compareWeekMenuOpen&&<div className="compare-team-picker-menu compare-week-picker-menu" role="listbox" aria-label="Choose stats week"><button type="button" role="option" aria-selected={selectedWeek==='all'} onClick={()=>{setSelectedWeek('all');setSelectedMatchup(null);setCompareWeekMenuOpen(false)}}><span>All Weeks</span></button>{availableWeeks.map(w=><button type="button" role="option" aria-selected={String(w)===effectiveCompareWeek} key={w} onClick={()=>{setSelectedWeek(String(w));setCompareWeekMenuOpen(false)}}><span>Week {w}</span></button>)}</div>}</div></label>
          <label className="stat-select"><span>ADD TEAM</span><div className="compare-team-picker" ref={compareTeamPickerRef}><button type="button" className="compare-team-picker-trigger" aria-expanded={compareTeamMenuOpen} disabled={!compareTeamNames.some(x=>!effectiveCompareTeams.includes(x))} onClick={()=>setCompareTeamMenuOpen(open=>!open)}><span>Add team</span><ChevronDown size={16}/></button>{compareTeamMenuOpen&&<div className="compare-team-picker-menu" role="listbox" aria-label="Add a team">{compareTeamNames.filter(x=>!effectiveCompareTeams.includes(x)).map(name=><button type="button" role="option" aria-selected="false" key={name} onClick={()=>{setCompareTeams(current=>[...current,name]);setSelectedMatchup(null);setCompareTeamMenuOpen(false)}}>{teamLogoFiles[name]&&<img src={`${import.meta.env.BASE_URL}assets/teams/${encodeURIComponent(teamLogoFiles[name])}`} alt="" loading="lazy"/>}<span>{name}</span></button>)}</div>}</div></label>
        </div>
        {effectiveCompareTeams.length>0&&<div className="selected-compare-teams" data-export-ignore="true">{effectiveCompareTeams.map(name=><button type="button" className="selected-compare-team" key={name} onClick={()=>{setCompareTeams(current=>current.filter(x=>x!==name));setSelectedMatchup(null)}}><TeamName name={name}/><span aria-hidden="true">×</span></button>)}</div>}
        {compareView==='team-stats'?<>
        {comparisonMatchup&&selectedWeek!=='all'&&<div className="matchup-context"><strong>Matchday {selectedMatchup.matchday} · {selectedMatchup.team1} vs. {selectedMatchup.team2}</strong><span>{effectiveCompareWeek?'Using imported Week '+effectiveCompareWeek:'This matchday has no stats-week mapping yet. Choose the matching stats week above to load the comparison.'}</span></div>}
        {comparisonTeams.length>=2?<><div className="comparison-export-capture"><div className="comparison-export-period"><span>STATS PERIOD</span><strong>{comparisonPeriodLabel}</strong></div><div className={'comparison-scorecards'+(comparisonTeams.length>2?' multi-team':'')+(comparisonMatchup&&comparisonTeams.length===2?' has-matchup':'')}>{comparisonTeams.map((t,index)=><div className="comparison-card-slot" key={t.name}><article className={'comparison-card'+(comparisonTeams.length===2&&index===1?' comparison-card-away':'')}><div className="comparison-team-identity"><img className="comparison-club-logo" src={`${import.meta.env.BASE_URL}assets/teams/${encodeURIComponent(teamLogoFiles[t.name]||'')}`} alt={`${t.name} club logo`} /><button className="entity-link team-entity-link" onClick={()=>navigateTo('Teams','',t.name)}><span>{t.name}</span></button><DivisionBadge division={t.division}/></div><span className="comparison-card-side-label">{comparisonTeams.length===2?(index===0?'HOME':'AWAY')+' · ':''}{fmtWinPct(t.winPct)}% win percentage</span><div className="comparison-team-rating"><span>TEAM MATCH RATING</span>{t.rating===null?<span className="rating-unavailable">No game data</span>:<RatingMeter value={t.rating}/>}</div></article>{index===0&&comparisonMatchup&&comparisonTeams.length===2&&<div className="comparison-inline-score"><strong>{comparisonMatchup.scoreText}</strong></div>}</div>)}</div>
          <div className="panel-heading compare-subheading"><div><h3>Individual player rating breakdowns</h3></div><div className="compare-export-actions" data-export-ignore="true"><button type="button" className="export-button" disabled={exportingComparison} onClick={async()=>{setExportingComparison(true);try{await downloadElementPng('.comparison-export-capture',`sgl-team-comparison-week-${effectiveCompareWeek||'all'}.png`,{paddingTop:7,paddingBottom:10});}catch(error){console.error(error);window.alert('The comparison image could not be exported. Please try again.');}finally{setExportingComparison(false);}}}><Download size={15}/>{exportingComparison?'Creating PNG...':'Export PNG'}</button></div></div>
          <div className="comparison-player-table"><DataTable columns={[{key:'playerName',label:'PLAYER',render:r=><button className="entity-link" onClick={()=>navigateTo('Players',r.playerName)}>{r.playerName}</button>},{key:'rank',label:'RANK',render:r=><RankBadge rank={r.rank}/>},{key:'teamName',label:'TEAM',render:r=><button className="entity-link team-entity-link comparison-player-team-link" onClick={()=>navigateTo('Teams','',r.teamName)}><TeamName name={r.teamName}/></button>},{key:'games',label:'GAMES',render:r=>fmtCount(r.games)},{key:'rating',label:'MATCH RATING',render:r=>selectedWeek==='all'?<RatingWithDelta value={r.rating} delta={r.ratingChange} compact/>:<RatingMeter value={r.rating} compact/>},...matchRatingCategories.map(c=>({key:c.key,label:c.label,render:r=><div className="comparison-category-cell"><strong>{fmtRating(r.categories[c.key])}</strong><small>{(c.key==='winPct'?fmtWinPct(r.values[c.key]):fmt(r.values[c.key]))}{c.key==='winPct'?'%':''}</small></div>}))]} rows={sortedComparisonPlayers} sortKey={comparisonSort.key} sortDirection={comparisonSort.direction} onSort={key=>updateSort(setComparisonSort,key)} empty="No player statistics found for these teams in this period."/></div></div>
        </>:<div className="table-empty">{selectedMatchup&&selectedWeek!=='all'&&!effectiveCompareWeek?'Choose the imported stats week for this matchday to load the team comparison.':''}</div>}

        </>:<>
          {comparisonTeams.length<2?<div className="table-empty">Select at least two teams above to compare their team statistics and rosters.</div>:<div className="expanded-comparison">{comparisonTeams.length>2&&<div className="matchup-context"><strong>Comparing {comparisonTeams[0].name} vs. {comparisonTeams[1].name}</strong><span>Team Matchup uses the first two selected teams. Remove teams above to change the pair.</span></div>}
            <div className="comparison-export-period"><span>STATS PERIOD</span><strong>{comparisonPeriodLabel}</strong></div>
            <div className="expanded-team-comparison"><div className="expanded-team-legend">{expandedTeamComparisons.slice(0,2).map((team,index)=><div className={`expanded-team-legend-item team-side-${index}`} key={team.name} style={{'--team-color':teamBrandColors[team.name]|| (index===0?'#4a9be8':'#d99a52')}}><img src={`${import.meta.env.BASE_URL}assets/teams/${encodeURIComponent(teamLogoFiles[team.name]||'')}`} alt=""/><div><strong>{team.name}</strong><small><span className={`team-color-key team-side-${index}`}/>{fmtCount(team.games)} player-games</small></div></div>)}</div><div className="expanded-team-metrics">{(expandedTeamComparisons.slice(0,2)[0]?.metrics||[]).map((metric,index)=>{const pair=expandedTeamComparisons.slice(0,2).map(team=>team.metrics[index]);const ratingScale=pair.every(item=>Number.isFinite(Number(item.barValue)));const scale=ratingScale?10:Math.max(...pair.map(item=>Math.abs(n(item.value))),0.0001);const barValues=pair.map(item=>ratingScale?n(item.barValue):n(item.value));const barWidths=barValues.map(value=>Math.min(88,Math.abs(value)/scale*88));const lowerTeamIndex=barValues[0]===barValues[1]?-1:barValues[0]<barValues[1]?0:1;return <div className="expanded-team-metric" key={metric.key}><strong className="expanded-metric-label">{metric.label}</strong><div className="expanded-metric-values">{pair.map((item,teamIndex)=><div className={`expanded-metric-bar-row team-side-${teamIndex}`} key={teamIndex} style={{opacity:lowerTeamIndex===teamIndex?0.42:1,'--team-color':teamBrandColors[expandedTeamComparisons[teamIndex]?.name]|| (teamIndex===0?'#4a9be8':'#d99a52')}}><div className="expanded-metric-bar-track"><span className={`expanded-metric-bar-fill team-side-${teamIndex}`} style={{width:`${barWidths[teamIndex]}%`}}/><strong className={`expanded-metric-value team-side-${teamIndex}`} style={{left:`${barWidths[teamIndex]}%`}}>{item?.display}</strong></div></div>)}</div></div>})}</div></div>
            <div className="panel-heading compare-subheading"><div><span className="panel-kicker">ROSTER BREAKDOWN</span><h3>Player comparison</h3></div></div>
            <div className="expanded-roster-grid">{expandedRosterPlayers.slice(0,2).map(roster=>{const team=roster.teamName;const rows=sortRows(roster.players,comparisonSort.key,comparisonSort.direction);return <section className="expanded-roster-column" key={team}><div className="expanded-roster-heading"><div className="expanded-roster-team"><img src={`${import.meta.env.BASE_URL}assets/teams/${encodeURIComponent(teamLogoFiles[team]||'')}`} alt=""/><strong>{team}</strong></div></div><div className="comparison-player-table"><DataTable columns={[{key:'playerName',label:'PLAYER',render:r=><button className="entity-link" onClick={()=>navigateTo('Players',r.playerName)}>{r.playerName}</button>},{key:'rank',label:'RANK',render:r=><RankBadge rank={r.rank}/>},{key:'games',label:'GAMES',render:r=>fmtCount(r.games)},{key:'rating',label:'RATING',render:r=><RatingMeter value={r.rating} compact/>},{key:'winPct',label:'WIN %',render:r=>r.games?fmtWinPct(r.winPct)+'%':'-'}]} rows={rows} sortKey={comparisonSort.key} sortDirection={comparisonSort.direction} onSort={key=>updateSort(setComparisonSort,key)} empty="No player stats available for this team."/></div></section>})}</div>
          </div>}
        </>}
      </section>}
      {activePage==='Stat Explorer'&&<section className="panel full-panel">
        <div className="panel-heading"><div><span className="panel-kicker">RAW EXPORT EXPLORER</span><h2>Browse exported stats</h2></div><span className="panel-tag">{stats.length} STAT FIELDS</span></div>
        <label className="stat-select"><span>STATISTIC</span><span className="select-wrap"><select value={selectedStat} onChange={e=>setSelectedStat(e.target.value)}>{stats.map(x=><option key={x}>{x}</option>)}</select><ChevronDown size={16}/></span></label>
        <DataTable columns={[{key:'playerName',label:'PLAYER'},{key:'teamName',label:'TEAM'},{key:'week',label:'WEEK'},{key:'value',label:selectedStat.toUpperCase(),render:r=>fmt(r.stats[selectedStat])},{key:'sourceFile',label:'SOURCE'}]} rows={statRows} empty="No rows to explore."/>
        <div className="stat-rating-method">
          <div className="panel-heading"><div><span className="panel-kicker">RATING METHODOLOGY</span><h2>How Match Rating is calculated</h2></div><span className="panel-tag">PROVISIONAL</span></div>
          <p>Each category starts at 6. Performance relative to its baseline is multiplied by the category multiplier. Category ratings have a minimum of 1. The seven category ratings are combined using their weights and divided by 7. The final rating is limited to 0-10.</p>
          <div className="formula-line">Overall = Σ (category rating × weight) ÷ 7</div>
          <DataTable columns={[{key:'label',label:'CATEGORY'},{key:'average',label:'BASELINE',render:r=>fmtDetailed(r.average)},{key:'multiplier',label:'MULTIPLIER',render:r=>fmt(r.multiplier)},{key:'weight',label:'WEIGHT',render:r=>fmtDetailed(r.weight)},{key:'direction',label:'DIRECTION'}]} rows={matchRatingCategories.map(c=>({...c,direction:c.inverse?'Lower is better':'Higher is better'}))}/>
          <p className="table-note">Win % = wins ÷ games × 100. Other inputs are per game. GA-Saves = Goals Against per game - Saves per game, with lower values scoring better. Demos +/- = demos inflicted per game - demos taken per game.</p>
          <p className="table-note">These are the current website rules. The source spreadsheet still needs a cell-by-cell check before this can be called a verified replica.</p>
        </div>
        <div className="stat-rating-audit">
          <div className="panel-heading"><div><span className="panel-kicker">PLAYER-LEVEL BREAKDOWN</span><h2>Match Rating calculation audit</h2></div><span className="panel-tag">CURRENT WEBSITE FORMULA</span></div>
          <label className="stat-select"><span>PLAYER</span><span className="select-wrap"><select value={auditPlayer?.name||''} onChange={e=>setSelectedAuditPlayer(e.target.value)}>{players.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select><ChevronDown size={16}/></span></label>
          {auditPlayer ? <>
            <div className="formula-line">{auditPlayer.name} · {fmtCount(auditPlayer.games)} games · Match Rating {fmtDetailed(auditPlayer.rating)}</div>
            <p className="table-note">Inputs are per game except Win %. Weighted points are category rating × weight.</p>
            <DataTable columns={[{key:'label',label:'CATEGORY'},{key:'input',label:'INPUT',render:r=>fmtDetailed(r.input)},{key:'average',label:'BASELINE',render:r=>fmtDetailed(r.average)},{key:'adjustment',label:'ADJUSTMENT',render:r=>(r.adjustment>0?'+':'')+fmtDetailed(r.adjustment)},{key:'categoryRating',label:'CATEGORY RATING',render:r=><RatingMeter value={r.categoryRating} compact detailed/>},{key:'weight',label:'WEIGHT',render:r=>fmtDetailed(r.weight)},{key:'weightedPoints',label:'WEIGHTED POINTS',render:r=>fmtDetailed(r.weightedPoints)}]} rows={matchRatingCategories.map(c=>{const input=auditPlayer.ratingValues[c.key], adjustment=(c.inverse?c.average-input:input-c.average)*c.multiplier, categoryRating=6+adjustment;return {...c,input,adjustment,categoryRating,weightedPoints:categoryRating*c.weight};})}/>
            <div className="formula-line">Total weighted points ÷ 7 = {fmtDetailed(auditPlayer.rating)}</div>
          </> : <div className="table-empty">Import player data to see a calculation audit.</div>}
        </div>
      </section>}
      <footer><span>RLSTATS <b>•</b> LEAGUE ANALYTICS</span><span className="footer-credit">Created by <strong>Toad Death</strong><a href="https://github.com/ToadDeath/Rocket-League-Stats" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={11}/></a></span></footer>
    </main>
  </div>;
}
export default App;
