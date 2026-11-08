import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowLeft, ArrowUpRight, BarChart3, Bell, ChevronDown, Download, Gauge, LayoutDashboard, ListOrdered, Search, Shield, Swords, Users } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const divisions = ['All Divisions', 'Premier', 'Championship'];
const navItems = [
  { label: 'Overview', icon: LayoutDashboard }, { label: 'Players', icon: Users },
  { label: 'Teams', icon: Shield }, { label: 'Compare', icon: Swords }, { label: 'Stat Explorer', icon: BarChart3 }
];
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const fmt = value => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtWinPct = value => Number(value) === 0 || Number(value) === 100 ? String(Number(value)) : fmt(value);
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

// SGL Match Rating: category ratings are centered on 6, then weighted.
// These baselines, multipliers, and weights are copied from the workbook's
// Ballchasing Back-End rows 202-204.
const matchRatingCategories = [
  { key:'winPct', label:'Win %', average:50, multiplier:0.08, weight:0.5 },
  { key:'scorePerGame', label:'Score', average:330, multiplier:0.015, weight:1.5 },
  { key:'goalsPerGame', label:'Goals', average:0.72, multiplier:4, weight:1.5 },
  { key:'assistsPerGame', label:'Assists', average:0.54, multiplier:5, weight:1.1 },
  { key:'gaSaves', label:'GA-Saves', average:1.2, multiplier:2, weight:1.1, inverse:true },
  { key:'boostStolenPerGame', label:'Boost stolen', average:480, multiplier:0.015, weight:0.65 },
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
  const rating = !g ? 0 : Math.min(10,Math.max(0,
    matchRatingCategories.reduce((sum,c)=>sum+categories[c.key]*c.weight,0)/7
  ));
  return { rating, categories, values };
}

const sglLogo = `${import.meta.env.BASE_URL}assets/league/sgl-logo.png`;
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

function DivisionBadge({ division }) {
  if (!division || !['Premier','Championship'].includes(division)) return null;
  const file = division === 'Premier' ? 'SGL Premier.png' : 'SGL Championship.png';
  return <span className={'division-badge division-badge-'+division.toLowerCase()} title={'SGL '+division}><img src={`${import.meta.env.BASE_URL}assets/league/${encodeURIComponent(file)}`} alt={'SGL '+division}/><span>{division}</span></span>;
}

function TeamName({ name }) {
  const logo = teamLogoFiles[name];
  const initials = name.split(/\s+/).filter(Boolean).slice(0,3).map(x=>x[0]).join('').slice(0,3);
  return <span className="team-name">
    {logo ? <img src={`${import.meta.env.BASE_URL}assets/teams/${encodeURIComponent(logo)}`} alt="" /> : <span className="team-monogram">{initials}</span>}
    <span>{name}</span>
  </span>;
}


async function downloadTeamComparisonPng({ teams, players, categories, week }) {
  const scale = 2;
  const width = 2100;
  const margin = 64;
  const gap = 28;
  const cardWidth = (width - margin * 2 - gap) / 2;
  const top = 360;
  const tableHeaderHeight = 66;
  const rowHeight = 70;
  const height = top + tableHeaderHeight + Math.max(players.length, 1) * rowHeight + 72;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#0b1018';
  ctx.fillRect(0, 0, width, height);

  const roundRect = (x,y,w,h,r) => {
    ctx.beginPath(); ctx.roundRect(x,y,w,h,r);
  };
  const drawText = (value,x,y,size=16,color='#e8edf5',weight=500,align='left') => {
    ctx.font = `${weight} ${size}px Inter, Arial, sans-serif`;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillText(String(value),x,y);
  };
  const drawMeter = (value,x,y,w,h,large=false) => {
    const score = Math.max(0,Math.min(10,n(value)));
    const gradient = ctx.createLinearGradient(x,y,x+w,y);
    gradient.addColorStop(0,'#e34d59'); gradient.addColorStop(.5,'#8d8b9c'); gradient.addColorStop(1,'#268bd2');
    ctx.fillStyle='#27313e'; roundRect(x,y,w,h,6); ctx.fill();
    ctx.save(); roundRect(x,y,w*score/10,h,6); ctx.clip(); ctx.fillStyle=gradient; ctx.fillRect(x,y,w,h); ctx.restore();
    drawText(fmtRating(score),x+w+14,y+h/2,large?20:15,'#f2f5fa',700);
  };
  const loadLogo = async name => {
    const file = teamLogoFiles[name];
    if (!file) return null;
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = `${import.meta.env.BASE_URL}assets/teams/${encodeURIComponent(file)}`;
    });
  };
  const logos = await Promise.all(teams.map(t=>loadLogo(t.name)));

  drawText(`${teams[0]?.name || 'Team 1'}  vs  ${teams[1]?.name || 'Team 2'}`,margin,72,34,'#f3f6fb',800);
  drawText(`STATS WEEK ${week || 'ALL AVAILABLE'}  ·  ${players.length} PLAYER RECORDS`,margin,118,15,'#9eacbf',600);

  teams.forEach((team,i)=>{
    const x=margin+i*(cardWidth+gap), y=190;
    ctx.fillStyle='#151e2a'; roundRect(x,y,cardWidth,142,12); ctx.fill();
    ctx.strokeStyle='#2a3544'; ctx.lineWidth=1; roundRect(x,y,cardWidth,142,12); ctx.stroke();
    const logo=logos[i];
    if(logo){const ratio=Math.min(66/logo.width,66/logo.height);ctx.drawImage(logo,x+22,y+24,logo.width*ratio,logo.height*ratio);}
    else drawText(team.name.split(/\\s+/).map(v=>v[0]).join('').slice(0,3),x+54,y+56,22,'#a9b6c8',800,'center');
    drawText(team.name,x+108,y+42,22,'#f1f4f9',750);
    drawText(`${team.players.length} players  ·  ${fmtCount(team.games)} player-games  ·  ${fmtWinPct(team.winPct)}% player-game wins`,x+108,y+76,14,'#9eacbf',500);
    drawText('TEAM MATCH RATING',x+108,y+111,11,'#8e9db1',700);
    if(team.rating===null) drawText('No game data',x+cardWidth-24,y+111,14,'#9eacbf',600,'right');
    else drawMeter(team.rating,x+cardWidth-230,y+103,150,12,true);
  });

  const cols = [
    {label:'PLAYER',width:250,align:'left'},
    {label:'RANK',width:90,align:'center'},
    {label:'TEAM',width:250,align:'left'},
    {label:'GAMES',width:95,align:'center'},
    {label:'MATCH RATING',width:180,align:'left'},
    ...categories.map(c=>({label:c.label.toUpperCase(),width:145,align:'center'}))
  ];
  let x=margin;
  ctx.fillStyle='#202b39'; roundRect(margin,top,width-margin*2,tableHeaderHeight,8); ctx.fill();
  cols.forEach(col=>{const tx=col.align==='left'?x+16:x+col.width/2;drawText(col.label,tx,top+tableHeaderHeight/2,12,'#aab7c8',750,col.align);x+=col.width;});
  players.forEach((p,index)=>{
    const y=top+tableHeaderHeight+index*rowHeight;
    ctx.fillStyle=index%2===0?'#121a25':'#0f1721';ctx.fillRect(margin,y,width-margin*2,rowHeight);
    ctx.strokeStyle='#263241';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(margin,y+rowHeight);ctx.lineTo(width-margin,y+rowHeight);ctx.stroke();
    let cx=margin;
    drawText(p.playerName,cx+16,y+rowHeight/2,15,'#edf2f8',650);cx+=cols[0].width;
    drawText(p.rank||'-',cx+cols[1].width/2,y+rowHeight/2,14,'#b9c5d4',600,'center');cx+=cols[1].width;
    drawText(p.teamName,cx+14,y+rowHeight/2,14,'#aab8ca',550);cx+=cols[2].width;
    drawText(fmtCount(p.games),cx+cols[3].width/2,y+rowHeight/2,14,'#dce4ee',550,'center');cx+=cols[3].width;
    drawMeter(p.rating,cx+8,y+rowHeight/2-6,100,12);cx+=cols[4].width;
    categories.forEach((category,i)=>{
      const adjusted=n(p.categories[category.key]);
      const raw=n(p.values?.[category.key]);
      const cellW=cols[5+i].width;
      drawText(fmtRating(adjusted),cx+cellW/2,y+25,14,'#e8edf5',700,'center');
      drawText((category.key==='winPct'?fmtWinPct(raw):fmt(raw))+(category.key==='winPct'?'%':''),cx+cellW/2,y+48,10,'#93a3b7',500,'center');
      cx+=cellW;
    });
  });
  const blob = await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob) throw new Error('PNG export could not be created.');
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=`sgl-team-comparison-week-${week||'all'}.png`;
  document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1500);
}

async function downloadLeagueRankingsPng({ players, division, categories }) {
  const scale=2, width=2850, margin=64, tableWidth=width-margin*2;
  const top=230, header=58, tableHead=48, rowHeight=64;
  const height=top+header+tableHead+players.length*rowHeight+70;
  const canvas=document.createElement('canvas');canvas.width=width*scale;canvas.height=height*scale;
  const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='#0b1018';ctx.fillRect(0,0,width,height);
  const round=(x,y,w,h,r)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);};
  const text=(value,x,y,size=15,color='#e8edf5',weight=500,align='left')=>{ctx.font=weight+' '+size+'px Inter,Arial,sans-serif';ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(value),x,y);};
  const meter=(value,x,y,w)=>{const score=Math.max(0,Math.min(10,n(value)));const gradient=ctx.createLinearGradient(x,y,x+w,y);gradient.addColorStop(0,'#e34d59');gradient.addColorStop(.5,'#8d8b9c');gradient.addColorStop(1,'#268bd2');ctx.fillStyle='#27313e';round(x,y,w,9,5);ctx.fill();ctx.save();round(x,y,w*score/10,9,5);ctx.clip();ctx.fillStyle=gradient;ctx.fillRect(x,y,w,9);ctx.restore();text(fmtRating(score),x+w+12,y+4,14,'#f2f5fa',700);};
  const loadTeamLogo=async name=>{
    const file=teamLogoFiles[name];
    if(!file)return null;
    return new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>resolve(null);
      img.src=`${import.meta.env.BASE_URL}assets/teams/${encodeURIComponent(file)}`;
    });
  };
  const loadRankLogo=async rank=>{
    const file=rankLogoFiles[rank];
    if(!file)return null;
    return new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>resolve(null);
      img.src=`${import.meta.env.BASE_URL}assets/ranks/${encodeURIComponent(file)}`;
    });
  };
  const logoNames=[...new Set(players.flatMap(p=>[...(p.teams||[])]))];
  const rankNames=[...new Set(players.map(p=>p.rank).filter(Boolean))];
  const [loadedLogos,loadedRankLogos]=await Promise.all([
    Promise.all(logoNames.map(async name=>[name,await loadTeamLogo(name)])),
    Promise.all(rankNames.map(async rank=>[rank,await loadRankLogo(rank)]))
  ]);
  const logosByTeam=new Map(loadedLogos);
  const logosByRank=new Map(loadedRankLogos);
  text('SGL  ·  PLAYER RANKINGS',margin,58,16,'#62c8ec',750);
  text(division==='All Divisions'?'ALL DIVISIONS':division.toUpperCase(),margin,112,42,'#f3f6fb',800);
  text(players.length+' PLAYERS     ·     MATCH RATING + CATEGORY FORMULAS',margin,158,15,'#9eacbf',600);
  ctx.fillStyle='#151e2a';round(margin,top,tableWidth,header,8);ctx.fill();
  text('PLAYER LEADERBOARD',margin+18,top+20,18,'#f1f4f9',800);
  text(players.length+' TOTAL',width-margin-18,top+20,11,'#9eacbf',600,'right');
  const cols=[{label:'#',w:103},{label:'PLAYER',w:309},{label:'RANK',w:154},{label:'TEAM',w:592},{label:'GAMES',w:154},{label:'MATCH RATING',w:257},{label:'WEEKLY Δ',w:130},...categories.map(c=>({label:c.label.toUpperCase(),w:143}))];
  let cx=margin;ctx.fillStyle='#202b39';ctx.fillRect(margin,top+header,tableWidth,tableHead);
  for(const c of cols){const left=c.label==='PLAYER'||c.label==='TEAM';text(c.label,cx+(left?14:c.w/2),top+header+tableHead/2,11,'#aab7c8',750,left?'left':'center');cx+=c.w;}
  players.forEach((p,i)=>{const y=top+header+tableHead+i*rowHeight;ctx.fillStyle=i%2===0?'#121a25':'#0f1721';ctx.fillRect(margin,y,tableWidth,rowHeight);ctx.strokeStyle='#263241';ctx.beginPath();ctx.moveTo(margin,y+rowHeight);ctx.lineTo(margin+tableWidth,y+rowHeight);ctx.stroke();let x=margin;const values=[String(i+1),p.name,p.rank||''];values.forEach((value,j)=>{if(j===2){const rankLogo=logosByRank.get(p.rank);if(rankLogo){const size=42;ctx.drawImage(rankLogo,x+(cols[j].w-size)/2,y+(rowHeight-size)/2,size,size);}else{text(value,x+cols[j].w/2,y+rowHeight/2,13,'#b9c5d4',550,'center');}}else{const left=j===1;text(value,x+(left?14:cols[j].w/2),y+rowHeight/2,13,j===1?'#edf2f8':'#b9c5d4',j===1?650:550,left?'left':'center');}x+=cols[j].w;});const teams=[...(p.teams||[])];let teamX=x+14;const teamCenter=y+rowHeight/2;ctx.save();ctx.beginPath();ctx.rect(x+8,y,cols[3].w-16,rowHeight);ctx.clip();for(const team of teams){const logo=logosByTeam.get(team);if(logo){const size=30;ctx.drawImage(logo,teamX,teamCenter-size/2,size,size);}else{text(team.split(/\\s+/).map(v=>v[0]).join('').slice(0,3),teamX+14,teamCenter,10,'#a9b6c8',800,'center');}teamX+=36;text(team,teamX,teamCenter,13,'#aab8ca',550);ctx.font='550 13px Inter,Arial,sans-serif';teamX+=ctx.measureText(team).width+20;}ctx.restore();x+=cols[3].w;text(fmtCount(p.games),x+cols[4].w/2,y+rowHeight/2,13,'#b9c5d4',550,'center');x+=cols[4].w;meter(p.rating,x+10,y+rowHeight/2-4,105);x+=cols[5].w;const delta=p.ratingChange;text(delta==null||delta===0?'-':(delta>0?'+':'')+fmt(delta),x+cols[6].w/2,y+rowHeight/2,13,delta==null||delta===0?'#8795a8':delta>0?'#55c995':'#ef747b',650,'center');x+=cols[6].w;categories.forEach((c,j)=>{const col=cols[7+j],raw=n(p.ratingValues?.[c.key]),score=n(p.ratingCategories?.[c.key]);text(fmtRating(score),x+col.w/2,y+24,14,'#e8edf5',700,'center');text((c.key==='winPct'?fmtWinPct(raw):fmt(raw))+(c.key==='winPct'?'%':''),x+col.w/2,y+47,10,'#93a3b7',500,'center');x+=col.w;});});
  text('Category values show adjusted rating above and underlying per-game statistic below.  ·  Created by Toad Death  ·  RLSTATS',margin,height-28,11,'#74859d',500);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG export could not be created.');
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='sgl-'+division.toLowerCase().replace(/\s+/g,'-')+'-player-rankings.png';document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1500);
}

function MetricCard({ label, value, detail, icon: Icon }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17} /></span></div><div className="metric-value">{value}</div>{detail&&<div className="metric-detail">{detail}</div>}</article>;
}
function DataTable({ columns, rows, empty, onRowClick }) {
  return rows.length ? <div className="table-scroll"><table className="stats-table"><thead><tr>{columns.map(c => <th key={c.key} className={c.key==='teamList'?'team-column-header':undefined}>{c.key==='teamList'?<span>{c.label}</span>:c.label}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={row.key || i} className={onRowClick?"clickable-row":""} onClick={onRowClick?()=>onRowClick(row):undefined}>{columns.map(c=><td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>)}</tr>)}</tbody></table></div> : <div className="table-empty">{empty || 'No data available for this selection.'}</div>;
}

function App() {
  const [division, setDivision] = useState('All Divisions');
  const [divisionMenuOpen, setDivisionMenuOpen] = useState(false);
  const [activePage, setActivePage] = useState('Overview');
  const [query, setQuery] = useState('');
  const [selectedStat, setSelectedStat] = useState('score per game');
  const [selectedAuditPlayer, setSelectedAuditPlayer] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [compareTeams, setCompareTeams] = useState([]);
  const [exportingComparison, setExportingComparison] = useState(false);
  const [selectedMatchday, setSelectedMatchday] = useState('');
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
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
      const previous=previousWeek==null?null:matchRatingForRecords(p.rows.filter(r=>r.week==null||r.week<=previousWeek));
      return {...p,rank:dataset?.playerRanks?.[p.name]||'',trackerUrl:dataset?.playerTrackerUrls?.[p.name]||'',teamList:[...p.teams].join(', '),
        winPct:p.games?p.wins/p.games*100:0,scorePerGame:avg(p.score,p.games),goalsPerGame:avg(p.goals,p.games),
        rating:current.rating,ratingCategories:current.categories,ratingValues:current.values,
        ratingChange:previous?current.rating-previous.rating:null};
    }).sort((a,b)=>b.rating-a.rating);
  }, [records,dataset]);

  const teams = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      if (!map.has(r.teamName)) map.set(r.teamName,{key:r.teamName,name:r.teamName,players:new Set(),rows:[],games:0,wins:0,score:0,goals:0,assists:0});
      const t=map.get(r.teamName); t.players.add(r.playerName); t.rows.push(r); t.games+=n(r.stats.games); t.wins+=n(r.stats.wins);
      t.score+=n(r.stats.score); t.goals+=n(r.stats.goals); t.assists+=n(r.stats.assists);
    }
    return [...map.values()].map(t=>({...t,division:t.rows[0]?.division||'',playerCount:t.players.size,winPct:t.games?t.wins/t.games*100:0,scorePerGame:avg(t.score,t.games),goalsPerGame:avg(t.goals,t.games),assistsPerGame:avg(t.assists,t.games),rating:matchRatingForRecords(t.rows).rating})).sort((a,b)=>b.winPct-a.winPct);
  }, [records]);

  const filteredPlayers = players.filter(p=>p.name.toLowerCase().includes(query.toLowerCase())||p.teamList.toLowerCase().includes(query.toLowerCase()));
  const playerGames = records.reduce((s,r)=>s+n(r.stats.games),0);
  const totalScore = records.reduce((s,r)=>s+n(r.stats.score),0);
  const stats = dataset?.availableStats || [];
  const availableWeeks = [...new Set(records.map(r=>r.week).filter(v=>v!==null&&v!==undefined&&v!=='').map(Number).filter(Number.isFinite))].sort((a,b)=>a-b);
  const effectiveCompareWeek = selectedWeek === 'unmapped' ? '' : availableWeeks.includes(Number(selectedWeek)) ? String(Number(selectedWeek)) : String(availableWeeks.at(-1) ?? '');
  const compareRows = selectedWeek === 'unmapped' && !effectiveCompareWeek ? [] : effectiveCompareWeek ? records.filter(r=>Number(r.week)===Number(effectiveCompareWeek)) : records;
  const compareTeamNames = [...new Set(records.map(r=>r.teamName).filter(Boolean))].sort();
  const effectiveCompareTeams = compareTeams.filter((name,index)=>compareTeamNames.includes(name)&&compareTeams.indexOf(name)===index).slice(0,2);
  const scheduleRows = (dataset?.schedule || []).filter(m=>division==='All Divisions'||m.division===division);
  const scheduleMatchdays = [...new Set(scheduleRows.map(m=>m.matchday))].sort((a,b)=>a-b);
  const mappedMatchdays = scheduleRows.filter(m=>m.statsWeek!==null).map(m=>m.matchday);
  const defaultMatchday = mappedMatchdays.length ? Math.max(...mappedMatchdays) : Math.max(0,...scheduleMatchdays);
  const effectiveMatchday = scheduleMatchdays.includes(Number(selectedMatchday)) ? Number(selectedMatchday) : defaultMatchday;
  const matchupRows = scheduleRows.filter(m=>m.matchday===effectiveMatchday).map(m=>{
    const weekRows = m.statsWeek===null ? [] : records.filter(r=>r.division===m.division&&r.week===m.statsWeek);
    const team1Stats = teamSeriesStats(weekRows,m.team1), team2Stats = teamSeriesStats(weekRows,m.team2);
    const hasBoth = team1Stats.hasData && team2Stats.hasData;
    const exact = hasBoth && team1Stats.exact && team2Stats.exact;
    const reconciles = exact && team1Stats.wins===team2Stats.losses && team2Stats.wins===team1Stats.losses && team1Stats.teamGames===team2Stats.teamGames;
    const final = reconciles && team1Stats.complete && team2Stats.complete;
    const status = !m.statsWeek ? 'Stats week not mapped' : !hasBoth ? 'Waiting for imported stats' : !exact ? 'Player stats are incomplete' : !reconciles ? 'Team totals do not reconcile' : !final ? 'Partial series data' : 'Final';
    return {...m, scoreText:exact?team1Stats.wins+' - '+team2Stats.wins:'TBD', resultStatus:status, resultFinal:final};
  });
  const upcomingMatchdayNumbers = scheduleMatchdays.filter(day=>day>defaultMatchday).slice(0,2);
  const upcomingMatchdayGroups = upcomingMatchdayNumbers.map(matchday=>({
    matchday,
    deadline:scheduleRows.find(m=>m.matchday===matchday)?.deadline||'',
    matchups:scheduleRows.filter(m=>m.matchday===matchday)
  }));
  const comparisonTeams = effectiveCompareTeams.map(name=>{ const rows=compareRows.filter(r=>r.teamName===name); const games=rows.reduce((s,r)=>s+n(r.stats.games),0); const wins=rows.reduce((s,r)=>s+n(r.stats.wins),0); const rating=games?matchRatingForRecords(rows).rating:null; return {name,rows,rating,games,wins,players:[...new Set(rows.map(r=>r.playerName))],winPct:games?wins/games*100:0}; }).filter(t=>t.rows.length);
  const comparisonPlayers = compareRows.filter(r=>effectiveCompareTeams.includes(r.teamName)).reduce((groups,r)=>{ const key=r.teamName+'::'+r.playerName; if(!groups.has(key)) groups.set(key,{key,playerName:r.playerName,teamName:r.teamName,rows:[]}); groups.get(key).rows.push(r); return groups; },new Map());
  const playerComparisonRows = [...comparisonPlayers.values()].map(p=>{ const rating=matchRatingForRecords(p.rows); const games=p.rows.reduce((sum,r)=>sum+n(r.stats.games),0); const wins=p.rows.reduce((sum,r)=>sum+n(r.stats.wins),0); return {...p,rank:dataset?.playerRanks?.[p.playerName]||'',rating:rating.rating,categories:rating.categories,values:rating.values,games,winPct:games?wins/games*100:0}; }).sort((a,b)=>(b.rating??-Infinity)-(a.rating??-Infinity)||a.playerName.localeCompare(b.playerName));
  const statRows = [...records].sort((a,b)=>n(b.stats[selectedStat])-n(a.stats[selectedStat])).slice(0,50);
  const activePlayer = players.find(p=>p.name===selectedPlayer);
  const auditPlayer = players.find(p=>p.name===selectedAuditPlayer) || players[0];
  const activeTeam = teams.find(t=>t.name===selectedTeam);
  const activeTeamPlayers = activeTeam ? players.filter(p=>activeTeam.players.has(p.name)).sort((a,b)=>b.rating-a.rating) : [];
  const playerDivision = activePlayer?.rows[0]?.division;
  const historyWeekCount = Math.max(1,...(dataset?.schedule||[]).filter(m=>m.division===playerDivision).map(m=>m.matchday));
  const playerHistory = activePlayer ? [...new Set(activePlayer.rows.map(r=>r.week).filter(Number.isFinite))].sort((a,b)=>a-b).map(week=>{ const weekly=activePlayer.rows.filter(r=>r.week===week); const cumulative=activePlayer.rows.filter(r=>r.week<=week); return {week:'Week '+week,weekNumber:week,weekly:matchRatingForRecords(weekly).rating,cumulative:matchRatingForRecords(cumulative).rating,games:weekly.reduce((sum,r)=>sum+n(r.stats.games),0)}; }) : [];
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
      <header className="topbar"><div className="breadcrumb"><span>LEAGUE HUB</span><b>/</b>{activePage.toUpperCase()}</div><div className="topbar-right"><span className="data-status"><span className="status-dot"/>{dataset ? dataset.imports.length + ' FILE' + (dataset.imports.length===1?'':'S') + ' LOADED' : 'LOADING DATA'}</span><div className="notification-wrap"><button className={(dataset?.importWarnings?.length||dataset?.duplicates?.length)?(notificationsOpen?'notification-button active has-issues':'notification-button has-issues'):(notificationsOpen?'notification-button active clear':'notification-button clear')} onClick={()=>setNotificationsOpen(v=>!v)} aria-label="Import notifications" aria-expanded={notificationsOpen}><Bell size={17}/><span>Alerts</span>{((dataset?.importWarnings?.length||0)+(dataset?.duplicates?.length||0))>0&&<i>{(dataset?.importWarnings?.length||0)+(dataset?.duplicates?.length||0)}</i>}</button>{notificationsOpen&&<div className="notification-panel"><div className="notification-heading"><strong>Import notifications</strong><button onClick={()=>setNotificationsOpen(false)} aria-label="Close notifications">×</button></div>{!dataset&&<p>League data is still loading.</p>}{dataset&&!(dataset.importWarnings?.length||dataset.duplicates?.length)&&<div className="notification-empty"><span>✓</span><strong>All clear</strong><p>No CSV import issues were reported in the latest build.</p></div>}{dataset?.importWarnings?.map(issue=><article className="notification-item" key={issue.file}><div className="notification-item-title"><AlertTriangle size={15}/><strong>{issue.file}</strong></div>{issue.missingHeaders?.length>0&&<p>Missing required columns: {issue.missingHeaders.join(', ')}</p>}{issue.unknownPlayers?.length>0&&<p><b>Unrecognized players:</b> {issue.unknownPlayers.join(', ')}. Add these to <code>data/roster.csv</code>.</p>}{issue.unknownTeams?.length>0&&<p><b>Unrecognized teams:</b> {issue.unknownTeams.join(', ')}. Add these to <code>data/team-aliases.csv</code>.</p>}{issue.invalidStats?.length>0&&<p><b>Invalid stat values:</b> {issue.invalidStats.map(x=>x.column+' ('+x.examples.join(', ')+')').join('; ')}.</p>}{issue.blankNameRows>0&&<p>{issue.blankNameRows} row(s) had a blank player or team name.</p>}{issue.type==='empty'&&<p>This file is empty or could not be read.</p>}<p className="notification-skipped">{issue.skippedRows||0} row(s) skipped</p></article>)}{dataset?.duplicates?.map(issue=><article className="notification-item" key={issue.file}><div className="notification-item-title"><AlertTriangle size={15}/><strong>Duplicate export</strong></div><p>{issue.file} matches {issue.duplicateOf} and was skipped.</p></article>)}</div>}</div><div className="avatar">RL</div></div></header>
      <section className="page-heading"><div><h1>{activePage==='Overview'?<>League <em>Overview</em></>:activePage}</h1>{description&&<p>{description}</p>}</div><div className="division-select"><span className="division-label">DIVISION</span><div className="division-picker"><button type="button" className="division-picker-trigger" aria-expanded={divisionMenuOpen} onClick={()=>setDivisionMenuOpen(v=>!v)}><img src={import.meta.env.BASE_URL + (division==='Premier'?'assets/league/SGL%20Premier.png':division==='Championship'?'assets/league/SGL%20Championship.png':'assets/league/sgl-logo.png')} alt=""/><span>{division}</span><ChevronDown size={16}/></button>{divisionMenuOpen&&<div className="division-picker-menu">{divisions.map(x=><button type="button" key={x} className={division===x?'selected':''} onClick={()=>{setDivision(x);setDivisionMenuOpen(false)}}><img src={import.meta.env.BASE_URL + (x==='Premier'?'assets/league/SGL%20Premier.png':x==='Championship'?'assets/league/SGL%20Championship.png':'assets/league/sgl-logo.png')} alt=""/><span>{x}</span>{division===x&&<span className="division-check">✓</span>}</button>)}</div>}</div></div></section>
      {loadError&&<section className="notice"><strong>Data could not be loaded</strong><p>{loadError}</p></section>}
      {!dataset&&!loadError&&<section className="notice"><strong>Loading league data...</strong><p>Reading the processed weekly exports.</p></section>}

      {dataset?.duplicates?.length > 0 && <section className="notice"><div><strong>Duplicate exports skipped</strong><p>{dataset.duplicates.length} file(s) had identical contents to an existing import and were skipped.</p></div></section>}
      {activePage==='Overview'&&<>
      <section className="content-grid">
        <article className="panel performance-panel"><div className="panel-heading"><div><span className="panel-kicker">LEAGUE SNAPSHOT</span><h2>Player rankings</h2></div><div className="ranking-preview-actions"><span className="panel-tag">TOP 10 PREVIEW</span><button type="button" className="text-button" onClick={()=>goToSection('Players')}>View all <ArrowUpRight size={14}/></button></div></div><DataTable columns={[{key:'position',label:'#',render:r=>players.findIndex(p=>p.name===r.name)+1},{key:'name',label:'PLAYER',render:r=><button className="entity-link" onClick={()=>navigateTo('Players',r.name)}>{r.name}</button>},{key:'rank',label:'RANK',render:r=><RankBadge rank={r.rank}/>},{key:'teamList',label:'TEAM',render:r=><span className="top-player-team"><button className="entity-link team-entity-link" onClick={()=>{const team=[...r.teams][0];if(team)navigateTo('Teams','',team)}}><TeamName name={[...r.teams][0]||r.teamList}/></button>{division==='All Divisions'&&[...new Set(r.rows.map(row=>row.division).filter(Boolean))].map(league=><DivisionBadge key={league} division={league}/>)}</span>},{key:'rating',label:'RATING',render:r=><RatingMeter value={r.rating} compact/>},{key:'ratingChange',label:'WEEKLY Δ',render:r=>r.ratingChange==null||r.ratingChange===0?'-':<span className={r.ratingChange>0?'rating-delta-positive':'rating-delta-negative'}>{r.ratingChange>0?'+':''}{fmt(r.ratingChange)}</span>}]} rows={players.slice(0,10)} empty="Player stats will appear after importing a weekly CSV."/></article>
        <article className="panel leaderboard-panel matchup-panel"><div className="panel-heading"><div><span className="panel-kicker">LEAGUE SCHEDULE</span><h2>Weekly matchup review</h2></div><label className="matchday-select"><span>MATCHDAY</span><select value={effectiveMatchday||''} onChange={e=>setSelectedMatchday(e.target.value)}>{scheduleMatchdays.map(day=><option key={day} value={day}>Matchday {day}</option>)}</select></label></div>{['Premier','Championship'].filter(name=>matchupRows.some(r=>r.division===name)).map(name=><div className="matchup-division-section" key={name}><div className="matchup-division-heading"><DivisionBadge division={name}/></div><DataTable columns={[{key:'team1',label:'HOME',render:r=><TeamName name={r.team1}/>},{key:'series',label:'SERIES',render:r=><span className="matchup-result"><strong className="matchup-score">{r.scoreText}</strong>{r.resultStatus!=='Final'&&<small>{r.resultStatus}</small>}</span>},{key:'team2',label:'AWAY',render:r=><TeamName name={r.team2}/>}]} rows={matchupRows.filter(r=>r.division===name)} onRowClick={r=>{setCompareTeams([r.team1,r.team2]);setSelectedWeek(r.statsWeek==null?'unmapped':String(r.statsWeek));setSelectedMatchup(r);navigateTo('Compare');}} empty="No matchups are listed for this matchday."/></div>)}{!matchupRows.length&&<div className="table-empty">No matchups are listed for this matchday.</div>}</article>
      </section>
      <section className="panel upcoming-panel">
        <div className="panel-heading"><div><span className="panel-kicker">COMING UP</span><h2>Upcoming matchups</h2></div><span className="panel-tag">NEXT TWO MATCHDAYS</span></div>
        {upcomingMatchdayGroups.length ? <div className="upcoming-matchday-list">{upcomingMatchdayGroups.map(group=><div className="upcoming-matchday" key={group.matchday}>
          <div className="upcoming-matchday-heading"><strong>Matchday {group.matchday}</strong>{group.deadline&&<span>DEADLINE <b>{group.deadline}</b></span>}</div>
          {['Premier','Championship'].filter(name=>group.matchups.some(match=>match.division===name)).map(name=><div className="upcoming-division-section" key={name}>
            <div className="upcoming-division-heading"><DivisionBadge division={name}/></div>
            <div className="upcoming-matchup-grid">{group.matchups.filter(match=>match.division===name).map(match=><div className="upcoming-matchup" key={match.id}>
              <div className="upcoming-team"><button className="entity-link team-entity-link" onClick={()=>navigateTo('Teams','',match.team1)}><TeamName name={match.team1}/></button></div><span className="upcoming-vs">VS</span><div className="upcoming-team"><button className="entity-link team-entity-link" onClick={()=>navigateTo('Teams','',match.team2)}><TeamName name={match.team2}/></button></div>
            </div>)}</div>
          </div>)}
        </div>)}</div> : <div className="upcoming-empty">No future matchdays are listed in the schedule.</div>}
      </section></>}
      {activePage==='Players'&&<section className="panel full-panel rankings-page">
        {activePlayer ? <>
          <button className="text-button back-button" onClick={goBack}><ArrowLeft size={15}/> {backLabel}</button>
          <div className="profile-heading"><div><span className="panel-kicker">PLAYER PROFILE</span><h2 className="profile-name-line"><span className="profile-player-name">{activePlayer.name}</span><RankBadge rank={activePlayer.rank}/>{activePlayer.trackerUrl&&<a className="tracker-profile-link" href={activePlayer.trackerUrl} target="_blank" rel="noreferrer"><img className="tracker-link-logo" src="/Rocket-League-Stats/assets/league/TRN.png" alt="" />Tracker Network <ArrowUpRight size={14}/></a>}</h2><div className="profile-team"><span className="profile-team-links">{[...activePlayer.teams].map(team=>{const teamDivision=activePlayer.rows.find(r=>r.teamName===team)?.division;return <span className="profile-team-entry" key={team}><button className="entity-link team-entity-link" onClick={()=>navigateTo('Teams','',team)}><TeamName name={team}/></button><DivisionBadge division={teamDivision}/></span>})}</span></div></div><div className="profile-rating"><span>MATCH RATING</span><strong>{fmtDetailed(activePlayer.rating)}</strong>{activePlayer.ratingChange!=null&&<small>{activePlayer.ratingChange>0?'+':''}{fmt(activePlayer.ratingChange)} this week</small>}</div></div>
          <div className="profile-stats"><div><span>GAMES</span><strong>{fmtCount(activePlayer.games)}</strong></div><div><span>WIN RATE</span><strong>{fmtWinPct(activePlayer.winPct)}%</strong></div><div><span>SCORE / GAME</span><strong>{fmt(activePlayer.scorePerGame)}</strong></div><div><span>GOALS</span><strong>{fmt(activePlayer.goals)}</strong></div><div><span>ASSISTS</span><strong>{fmt(activePlayer.assists)}</strong></div><div><span>SAVES</span><strong>{fmt(activePlayer.saves)}</strong></div></div>
          <div className="profile-grid">
            <article className="profile-section"><div className="panel-heading"><h3>Match Rating history</h3><span className="panel-tag">0-10</span></div>
              {playerHistory.length>0?<div className="profile-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={playerHistory} margin={{top:12,right:14,left:-18,bottom:2}}><CartesianGrid stroke="#29313c" strokeDasharray="3 3"/><XAxis type="number" dataKey="weekNumber" domain={[1,historyWeekCount]} ticks={Array.from({length:historyWeekCount},(_,i)=>i+1)} tickFormatter={value=>`W${value}`} tick={{fill:'#8d99aa',fontSize:10}} axisLine={{stroke:'#38404c'}} tickLine={false} allowDecimals={false}/><YAxis domain={[0,10]} tick={{fill:'#8d99aa',fontSize:10}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'#111820',border:'1px solid #343d49',borderRadius:6,color:'#edf2f9'}} formatter={(value,name)=>[fmtDetailed(value),name]}/><Line type="monotone" dataKey="cumulative" name="Season rating" stroke="#00aeef" strokeWidth={2.5} dot={{r:3}}/><Line type="monotone" dataKey="weekly" name="Weekly rating" stroke="#f02f38" strokeWidth={2} dot={{r:3}}/></LineChart></ResponsiveContainer></div>:<div className="table-empty">No weekly history available.</div>}
              <div className="chart-legend"><span><i className="legend-blue"/>Season rating</span><span><i className="legend-lime"/>Weekly rating</span></div>
            </article>
            <article className="profile-section"><div className="panel-heading"><h3>Rating breakdown</h3></div><div className="rating-breakdown">{matchRatingCategories.map(c=><div className="rating-row profile-rating-row" key={c.key}><div className="profile-rating-meta"><span className="profile-rating-label">{c.label}</span><small className="profile-raw-value">{(c.key==='winPct'?fmtWinPct(activePlayer.ratingValues[c.key]):fmt(activePlayer.ratingValues[c.key]))}{c.key==='winPct'?'%':''}</small></div><RatingMeter value={activePlayer.ratingCategories[c.key]}/><strong className="profile-category-score">{fmtRating(activePlayer.ratingCategories[c.key])}</strong></div>)}</div></article>
          </div>
          <article className="profile-section profile-week-table"><div className="panel-heading"><h3>Weekly results</h3></div><DataTable columns={[{key:'week',label:'WEEK'},{key:'games',label:'GAMES',render:r=>fmtCount(r.games)},{key:'weekly',label:'WEEKLY RATING',render:r=>fmt(r.weekly)},{key:'cumulative',label:'SEASON RATING',render:r=>fmt(r.cumulative)}]} rows={playerHistory.slice().reverse()} empty="No weekly results yet."/></article>
        </> : <>
          <div className="panel-heading rankings-heading"><div><span className="panel-kicker">PLAYER LEADERBOARD</span><h2>{players.length} players</h2><p className="rankings-subtitle">Ranked by Match Rating</p></div><button type="button" className="export-button" onClick={async()=>{setExportingComparison(true);try{await downloadLeagueRankingsPng({players,division,categories:matchRatingCategories});}catch(error){console.error(error);window.alert('The player rankings image could not be exported. Please try again.');}finally{setExportingComparison(false);}}} disabled={exportingComparison}><Download size={15}/>{exportingComparison?'Creating PNG...':'Export PNG'}</button></div>
          <div className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search players or teams..."/></div>
          <div className="players-leaderboard-table"><DataTable columns={[{key:'position',label:'#',render:r=>players.findIndex(p=>p.name===r.name)+1},{key:'name',label:'PLAYER',render:r=><button className="entity-link" onClick={()=>navigateTo('Players',r.name)}>{r.name}</button>},{key:'rank',label:'RANK',render:r=><RankBadge rank={r.rank}/>},{key:'teamList',label:'TEAM',render:r=><span className="top-player-team">{[...r.teams].map(team=><span className="rankings-team-link" key={team}><button className="entity-link team-entity-link" onClick={()=>navigateTo('Teams','',team)}><TeamName name={team}/></button>{division==='All Divisions'&&[...new Set(r.rows.filter(row=>row.teamName===team).map(row=>row.division).filter(Boolean))].map(league=><DivisionBadge key={league} division={league}/>)}</span>)}</span>},{key:'games',label:'GAMES',render:r=>fmtCount(r.games)},{key:'rating',label:'MATCH RATING',render:r=><RatingMeter value={r.rating} compact/>},{key:'ratingChange',label:'WEEKLY Δ',render:r=>r.ratingChange==null||r.ratingChange===0?'-':<span className={r.ratingChange>0?'rating-delta-positive':'rating-delta-negative'}>{r.ratingChange>0?'+':''}{fmt(r.ratingChange)}</span>},...matchRatingCategories.map(c=>({key:c.key,label:c.label,render:r=><div className="comparison-category-cell"><strong>{fmtRating(r.ratingCategories[c.key])}</strong><small>{(c.key==='winPct'?fmtWinPct(r.ratingValues[c.key]):fmt(r.ratingValues[c.key]))}{c.key==='winPct'?'%':''}</small></div>}))]} rows={filteredPlayers} empty="No players found."/></div>
        </>}
      </section>}
      {activePage==='Teams'&&<section className="panel full-panel">{activeTeam ? <><button className="text-button back-button" onClick={goBack}><ArrowLeft size={15}/> {backLabel}</button><div className="profile-heading"><div><span className="panel-kicker">TEAM PROFILE</span><h2><TeamName name={activeTeam.name}/></h2><div className="profile-team"><DivisionBadge division={activeTeam.division}/></div></div><div className="profile-rating"><span>TEAM MATCH RATING</span><strong>{fmtRating(activeTeam.rating)}</strong></div></div><div className="profile-stats"><div><span>PLAYER-GAMES</span><strong>{fmtCount(activeTeam.games)}</strong></div><div><span>PLAYER GAME WIN RATE</span><strong>{fmtWinPct(activeTeam.winPct)}%</strong></div><div><span>SCORE / GAME</span><strong>{fmt(activeTeam.scorePerGame)}</strong></div><div><span>GOALS / GAME</span><strong>{fmt(activeTeam.goalsPerGame)}</strong></div><div><span>ASSISTS / GAME</span><strong>{fmt(activeTeam.assistsPerGame)}</strong></div><div><span>PLAYERS</span><strong>{activeTeam.playerCount}</strong></div></div><div className="panel-heading team-roster-heading"><div><span className="panel-kicker">ROSTER</span><h2>Player performance</h2></div><span className="panel-tag">CLICK A PLAYER TO OPEN PROFILE</span></div><DataTable columns={[{key:'name',label:'PLAYER'},{key:'rank',label:'RANK',render:r=><RankBadge rank={r.rank}/>},{key:'rating',label:'MATCH RATING',render:r=><RatingMeter value={r.rating} compact/>},{key:'games',label:'GAMES',render:r=>fmtCount(r.games)},{key:'winPct',label:'WIN RATE',render:r=>fmtWinPct(r.winPct)+'%'},{key:'scorePerGame',label:'SCORE/G',render:r=>fmt(r.scorePerGame)}]} rows={activeTeamPlayers} onRowClick={r=>navigateTo('Players',r.name)} empty="No player stats found for this team."/></> : <><div className="panel-heading"><div><span className="panel-kicker">TEAM DIRECTORY</span><h2>{teams.length} teams</h2></div><span className="panel-tag">PLAYER TOTALS</span></div><DataTable columns={[{key:'name',label:'TEAM',render:r=><span className="top-player-team"><button className="entity-link team-entity-link" onClick={()=>navigateTo('Teams','',r.name)}><TeamName name={r.name}/></button>{division==='All Divisions'&&<DivisionBadge division={r.division}/>}</span>},{key:'playerCount',label:'PLAYERS'},{key:'rating',label:'MATCH RATING',render:r=><RatingMeter value={r.rating} compact/>},{key:'games',label:'PLAYER-GAMES',render:r=>fmtCount(r.games)},{key:'winPct',label:'PLAYER GAME WIN %',render:r=>fmtWinPct(r.winPct)+'%'},{key:'scorePerGame',label:'SCORE/G',render:r=>fmt(r.scorePerGame)},{key:'goals',label:'GOALS',render:r=>fmt(r.goals)},{key:'assists',label:'ASSISTS',render:r=>fmt(r.assists)}]} rows={teams} onRowClick={r=>navigateTo('Teams','',r.name)} empty="No team data available for this division."/></>}</section>}
      {activePage==='Compare'&&<section className="panel full-panel">
        <div className="panel-heading"><div><span className="panel-kicker">MATCH RATING</span><h2>Team comparison</h2></div><span className="panel-tag">WEEK BY WEEK</span></div>
        {selectedMatchup&&<div className="matchup-context"><strong>Matchday {selectedMatchup.matchday} · {selectedMatchup.team1} <span className="comparison-series-score">{selectedMatchup.scoreText}</span> {selectedMatchup.team2}</strong><span>{effectiveCompareWeek?'Using imported Week '+effectiveCompareWeek:'This matchday has no stats-week mapping yet. Choose the matching stats week above to load the comparison.'}</span></div>}
        <div className="compare-controls">
          <label className="stat-select"><span>STATS WEEK</span><span className="select-wrap"><select value={effectiveCompareWeek} onChange={e=>setSelectedWeek(e.target.value)} disabled={!availableWeeks.length}><option value="" disabled hidden>{availableWeeks.length?'Choose stats week':'No stats weeks available'}</option>{availableWeeks.map(w=><option key={w} value={String(w)}>Week {w}</option>)}</select><ChevronDown size={16}/></span></label>
          <label className="stat-select"><span>TEAM 1</span><span className="select-wrap"><select value={effectiveCompareTeams[0]||''} onChange={e=>setCompareTeams(current=>[e.target.value,current[1]===e.target.value?'':current[1]].filter(Boolean))} disabled={!compareTeamNames.length}><option value="" disabled hidden>{compareTeamNames.length?'Choose a team':'No teams available'}</option>{compareTeamNames.map(x=><option key={x} value={x}>{x}</option>)}</select><ChevronDown size={16}/></span></label>
          <label className="stat-select"><span>TEAM 2</span><span className="select-wrap"><select value={effectiveCompareTeams[1]||''} onChange={e=>setCompareTeams(current=>[current[0]||'',e.target.value].filter(Boolean))} disabled={!compareTeamNames.length}><option value="" disabled hidden>{compareTeamNames.length?'Choose a team':'No teams available'}</option>{compareTeamNames.filter(x=>x!==effectiveCompareTeams[0]).map(x=><option key={x} value={x}>{x}</option>)}</select><ChevronDown size={16}/></span></label>
        </div>
        {comparisonTeams.length===2?<><div className="comparison-scorecards">{comparisonTeams.map((t,index)=><article className={'comparison-card'+(index===1?' comparison-card-away':'')} key={t.name}><div className="comparison-team-identity"><img className="comparison-club-logo" src={`${import.meta.env.BASE_URL}assets/teams/${encodeURIComponent(teamLogoFiles[t.name]||'')}`} alt={`${t.name} club logo`} /><button className="entity-link team-entity-link" onClick={()=>navigateTo('Teams','',t.name)}><span>{t.name}</span></button><DivisionBadge division={t.rows[0]?.division}/></div><span>{t.players.length} players · {fmtCount(t.games)} player-games · {fmtWinPct(t.winPct)}% player-game wins</span><div className="comparison-team-rating"><span>TEAM MATCH RATING</span>{t.rating===null?<span className="rating-unavailable">No game data</span>:<RatingMeter value={t.rating}/>}</div></article>)}</div>
          <div className="panel-heading compare-subheading"><div><h3>Individual player rating breakdowns</h3></div><div className="compare-export-actions"><span className="panel-tag">PLAYER RATING · 0-10</span><button type="button" className="export-button" disabled={exportingComparison} onClick={async()=>{setExportingComparison(true);try{await downloadTeamComparisonPng({teams:comparisonTeams,players:playerComparisonRows,categories:matchRatingCategories,week:effectiveCompareWeek});}catch(error){console.error(error);window.alert('The comparison image could not be exported. Please try again.');}finally{setExportingComparison(false);}}}><Download size={15}/>{exportingComparison?'Creating PNG...':'Export PNG'}</button></div></div>
          <div className="comparison-player-table"><DataTable columns={[{key:'playerName',label:'PLAYER',render:r=><button className="entity-link" onClick={()=>navigateTo('Players',r.playerName)}>{r.playerName}</button>},{key:'rank',label:'RANK',render:r=><RankBadge rank={r.rank}/>},{key:'teamName',label:'TEAM',render:r=><button className="entity-link" onClick={()=>navigateTo('Teams','',r.teamName)}>{r.teamName}</button>},{key:'games',label:'GAMES',render:r=>fmtCount(r.games)},{key:'rating',label:'MATCH RATING',render:r=><RatingMeter value={r.rating} compact/>},...matchRatingCategories.map(c=>({key:c.key,label:c.label,render:r=><div className="comparison-category-cell"><strong>{fmtRating(r.categories[c.key])}</strong><small>{(c.key==='winPct'?fmtWinPct(r.values[c.key]):fmt(r.values[c.key]))}{c.key==='winPct'?'%':''}</small></div>}))]} rows={playerComparisonRows} empty="No player statistics found for these teams in this period."/></div>
        </>:<div className="table-empty">{selectedMatchup&&!effectiveCompareWeek?'Choose the imported stats week for this matchday to load the team comparison.':'Choose two teams to compare their players’ custom rating breakdowns.'}</div>}
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
