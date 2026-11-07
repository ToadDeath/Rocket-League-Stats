import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root=process.cwd(), importsRoot=path.join(root,'data','imports'), outputPath=path.join(root,'public','data','league-data.json');
function parseDelimited(text,delimiter){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===delimiter&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(v=>v.trim()!==''))rows.push(row);row=[];}else cell+=ch;}row.push(cell);if(row.some(v=>v.trim()!==''))rows.push(row);return rows;}
function detectDelimiter(text){const line=text.split(/\r?\n/,1)[0]||'';const choices=[',',';','\t','|'];return choices.sort((a,b)=>[...line].filter(c=>c===b).length-[...line].filter(c=>c===a).length)[0];}
function readCsv(file){const raw=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'');const rows=parseDelimited(raw,detectDelimiter(raw));if(!rows.length)return[];const headers=rows[0].map(v=>v.trim());return rows.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,(values[i]??'').trim()])));}
function readPlayerRoster(file){
  if(!fs.existsSync(file))throw new Error('Missing data/roster.csv.');
  const rows=readCsv(file), canonicalNames=new Set(), entries=[];
  for(const row of rows){
    const player=(row.Player||'').trim();
    if(!player)continue;
    if(canonicalNames.has(player))throw new Error('Player "'+player+'" appears more than once in data/roster.csv.');
    canonicalNames.add(player);
    entries.push({player,rank:(row.Rank||'').trim(),aliases:(row.Aliases||'').split('|').map(v=>v.trim()).filter(Boolean)});
  }
  const map=new Map();
  for(const {player} of entries)map.set(player,player);
  for(const {player,aliases} of entries){
    for(const alias of aliases){
      if(canonicalNames.has(alias)&&alias!==player)throw new Error('Alias "'+alias+'" conflicts with another canonical player name.');
      if(map.has(alias)&&map.get(alias)!==player)throw new Error('Alias "'+alias+'" is assigned to more than one player.');
      map.set(alias,player);
    }
  }
  return {aliases:map,ranks:Object.fromEntries(entries.map(({player,rank})=>[player,rank]))};
}
function readTeamRoster(file){
  if(!fs.existsSync(file))throw new Error('Missing data/team-aliases.csv.');
  const rows=readCsv(file), canonicalTeams=new Set(), entries=[];
  for(const row of rows){
    const team=(row['Team Name']||'').trim();
    if(!team)continue;
    if(canonicalTeams.has(team))throw new Error('Team "'+team+'" appears more than once in data/team-aliases.csv.');
    const league=(row.League||'').trim();
    if(!['Premier','Championship'].includes(league))throw new Error('Team "'+team+'" must have League set to Premier or Championship.');
    canonicalTeams.add(team);
    entries.push({team,league,aliases:(row.Aliases||row.Alias||'').split('|').map(v=>v.trim()).filter(Boolean)});
  }
  const map=new Map();
  for(const {team,league} of entries)map.set(team,{team,division:league,canonical:true});
  for(const {team,league,aliases} of entries){
    for(const alias of aliases){
      if(canonicalTeams.has(alias)&&alias!==team)throw new Error('Team alias "'+alias+'" conflicts with another canonical team name.');
      if(map.has(alias)&&map.get(alias).team!==team)throw new Error('Team alias "'+alias+'" is assigned to more than one team.');
      map.set(alias,{team,division:league,canonical:false});
    }
  }
  return map;
}
function findCsvFiles(dir){if(!fs.existsSync(dir))return[];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);return e.isDirectory()?findCsvFiles(p):e.isFile()&&e.name.toLowerCase().endsWith('.csv')?[p]:[];}).sort();}
function toNumber(value){if(value===undefined||value===null||value.trim()==='')return null;const x=Number(value.replace(/,/g,''));return Number.isFinite(x)?x:null;}
const playerRoster=readPlayerRoster(path.join(root,'data','roster.csv'));
const playerAliases=playerRoster.aliases;
const playerRanks=playerRoster.ranks;
const teamRoster=readTeamRoster(path.join(root,'data','team-aliases.csv'));
const records=[],imports=[],duplicates=[],unmatchedTeams=new Set(),seenHashes=new Map();
for(const file of findCsvFiles(importsRoot)){const relative=path.relative(root,file).split(path.sep).join('/'),base=path.basename(file),wm=base.match(/week[-_ ]?(\d+)/i),week=wm?Number(wm[1]):null;const hash=createHash('sha256').update(fs.readFileSync(file)).digest('hex');if(seenHashes.has(hash)){duplicates.push({file:relative,duplicateOf:seenHashes.get(hash)});continue;}seenHashes.set(hash,relative);const fallbackDivision=/second/i.test(base)||/championship/i.test(base)||/second/i.test(relative)||/championship/i.test(relative)?'Championship':/premier/i.test(base)||/premier/i.test(relative)?'Premier':'Unassigned';const rows=readCsv(file);if(!rows.length)continue;if(!('team name'in rows[0])||!('player name'in rows[0]))throw new Error(relative+' is missing required team name/player name columns.');let imported=0;const ts=new Set(),ps=new Set(),ds=new Set();for(const source of rows){const originalTeamName=(source['team name']||'').trim(),originalPlayerName=(source['player name']||'').trim();if(!originalTeamName||!originalPlayerName)continue;const teamInfo=teamRoster.get(originalTeamName);const teamName=teamInfo?.team||originalTeamName;const division=teamInfo?.division||fallbackDivision;if(!teamInfo)unmatchedTeams.add(originalTeamName);const playerName=playerAliases.get(originalPlayerName)||originalPlayerName;const stats={};for(const [key,value]of Object.entries(source)){if(key!=='team name'&&key!=='player name')stats[key]=toNumber(value);}records.push({division,week,sourceFile:relative,originalTeamName,teamName,originalPlayerName,playerName,stats});ts.add(teamName);ps.add(playerName);ds.add(division);imported++;}imports.push({file:relative,division:[...ds].join(', ')||fallbackDivision,week,rows:imported,teams:ts.size,players:ps.size});}
const availableStats=[...new Set(records.flatMap(r=>Object.keys(r.stats)))];
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify({generatedAt:new Date().toISOString(),imports,duplicates,records,availableStats,playerRanks,unmatchedTeams:[...unmatchedTeams].sort()}));
console.log('Processed '+imports.length+' CSV file(s), '+records.length+' player rows, '+availableStats.length+' stat fields.');
if(unmatchedTeams.size)console.warn('Team names without an alias mapping:',[...unmatchedTeams].join(', '));
