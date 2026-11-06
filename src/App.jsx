import { useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, ChevronDown,
  CircleHelp, Crosshair, Gauge, LayoutDashboard, Search, Shield,
  Swords, Users, Zap
} from 'lucide-react';

const divisions = ['All Divisions', 'Premier League', 'Second Division'];
const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Players', icon: Users },
  { label: 'Teams', icon: Shield },
  { label: 'Stat Explorer', icon: BarChart3 }
];

function MetricCard({ label, value, detail, icon: Icon }) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon"><Icon size={17} /></span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-detail">{detail}</div>
    </article>
  );
}

function App() {
  const [division, setDivision] = useState('All Divisions');
  const [activePage, setActivePage] = useState('Overview');
  const [query, setQuery] = useState('');

  const pageDescription = useMemo(() => ({
    Overview: 'A league-wide look at player form, team performance, and the numbers behind every series.',
    Players: 'Compare player ratings and performance across the league.',
    Teams: 'Explore team standings, rosters, and head-to-head performance.',
    'Stat Explorer': 'Build a closer look at the stats that matter to you.'
  }[activePage]), [activePage]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setActivePage('Overview')}>
          <span className="brand-mark"><Crosshair size={22} /></span>
          <span className="brand-copy"><strong>RL<span>STATS</span></strong><small>LEAGUE ANALYTICS</small></span>
        </a>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={activePage === label ? 'nav-item active' : 'nav-item'} onClick={() => setActivePage(label)}>
              <Icon size={18} /><span>{label}</span>{activePage === label && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="season-chip"><span className="live-dot" /> DATA HUB <span className="season-year">2026</span></div>
          <div className="sidebar-note">League data, all in one place.</div>
          <a className="github-link" href="https://github.com/ToadDeath/Rocket-League-Stats" target="_blank" rel="noreferrer">View project on GitHub ↗</a>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>LEAGUE HUB</span><b>/</b>{activePage.toUpperCase()}</div>
          <div className="topbar-right">
            <span className="data-status"><span className="status-dot" /> AWAITING DATA IMPORT</span>
            <div className="avatar">RL</div>
          </div>
        </header>

        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> THE NUMBERS BEHIND THE GAME</div>
            <h1>{activePage === 'Overview' ? <>League <em>Overview</em></> : activePage}</h1>
            <p>{pageDescription}</p>
          </div>
          <label className="division-select">
            <span>DIVISION</span>
            <span className="select-wrap">
              <select value={division} onChange={event => setDivision(event.target.value)}>
                {divisions.map(item => <option key={item}>{item}</option>)}
              </select>
              <ChevronDown size={16} />
            </span>
          </label>
        </section>

        <section className="notice">
          <div className="notice-icon"><CircleHelp size={19} /></div>
          <div><strong>Ready for the first data import</strong><p>The dashboard is set up. Player ratings, team records, and weekly stats will appear here once the league data is connected. No sample numbers are being shown as real results.</p></div>
        </section>

        <section className="metrics-grid">
          <MetricCard label="PLAYERS TRACKED" value="--" detail="Waiting for roster data" icon={Users} />
          <MetricCard label="TEAMS" value="--" detail="Across selected division" icon={Shield} />
          <MetricCard label="MATCHES PLAYED" value="--" detail="Weekly results and history" icon={Swords} />
          <MetricCard label="AVG. PLAYER RATING" value="--" detail="League rating index" icon={Gauge} />
        </section>

        <section className="content-grid">
          <article className="panel performance-panel">
            <div className="panel-heading"><div><span className="panel-kicker">LEAGUE SNAPSHOT</span><h2>Performance overview</h2></div><span className="panel-tag">WEEKLY</span></div>
            <div className="empty-chart">
              <div className="chart-grid-lines"><i /><i /><i /><i /></div>
              <div className="chart-empty-icon"><Activity size={25} /></div>
              <strong>Your weekly trends will live here</strong>
              <span>Import weekly exports to chart ratings, scoring, defense, and more.</span>
            </div>
            <div className="chart-legend"><span><i className="legend-lime" /> Player rating</span><span><i className="legend-blue" /> Team performance</span></div>
          </article>

          <article className="panel leaderboard-panel">
            <div className="panel-heading"><div><span className="panel-kicker">TOP PERFORMERS</span><h2>Player leaderboard</h2></div><span className="panel-tag">RANKINGS</span></div>
            <div className="search-box"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search players..." /></div>
            <div className="leaderboard-empty"><div className="empty-rank"><Zap size={19} /></div><strong>No players to display yet</strong><span>Player rankings will populate when roster and weekly stats are added.</span></div>
            <button className="text-button" onClick={() => setActivePage('Players')}>Explore players <ArrowUpRight size={15} /></button>
          </article>
        </section>

        <section className="bottom-grid">
          <article className="panel compact-panel"><div className="panel-heading"><div><span className="panel-kicker">TEAM RACE</span><h2>Division standings</h2></div><Shield size={18} className="muted-icon" /></div><div className="compact-empty">Standings will appear after team and match data is imported.</div><button className="text-button" onClick={() => setActivePage('Teams')}>View teams <ArrowUpRight size={15} /></button></article>
          <article className="panel compact-panel"><div className="panel-heading"><div><span className="panel-kicker">DEEP DIVE</span><h2>Stat explorer</h2></div><BarChart3 size={18} className="muted-icon" /></div><div className="compact-empty">Filter and compare scoring, defense, boost, movement, and advanced stats.</div><button className="text-button" onClick={() => setActivePage('Stat Explorer')}>Explore stats <ArrowUpRight size={15} /></button></article>
        </section>
        <footer><span>RLSTATS <b>•</b> LEAGUE ANALYTICS</span><span>Built for the community <span className="footer-flame">◆</span></span></footer>
      </main>
    </div>
  );
}

export default App;