(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const API = '/api/telemetry?limit=60';
  const state = { rows: [], latest: null, apiOk: false, lastSuccess: null, timer: null, paused: false, interval: 3000, autoRefresh: true, chartWindow: 'all', theme: 'light', page: 'overview', chartCleared: false };
  const number = (v, digits=1) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v).toFixed(digits) : '—';
  const valid = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  const clamp = v => Math.max(0, Math.min(100, Number(v) || 0));
  const safe = v => String(v ?? '—');
  const stamp = v => { const d = new Date(v); return Number.isFinite(d.getTime()) ? d.toLocaleString() : '—'; };
  const shortTime = v => { const d = new Date(v); return Number.isFinite(d.getTime()) ? d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—'; };
  const ageMs = row => row ? Date.now() - new Date(row.created_at).getTime() : Infinity;
  const fresh = row => ageMs(row) >= 0 && ageMs(row) < 15000;
  const scoreLevel = n => n >= 75 ? 'critical' : n >= 50 ? 'high' : n >= 25 ? 'moderate' : 'normal';
  const levelName = n => ({normal:'Normal',moderate:'Moderate',high:'High',critical:'Critical'})[scoreLevel(Number(n)||0)];
  const pct = v => valid(v) ? `${Math.round(clamp(v))}%` : '—';
  const setText = (id, v) => { const el=$(id); if(el) el.textContent=v; };
  const setWidth = (id,v) => { const el=$(id); if(el) el.style.width=`${clamp(v)}%`; };
  const setChip = (id, score, label) => { const el=$(id); if(!el)return; el.className=`status-chip chip-${score === null ? 'neutral' : scoreLevel(score)}`; el.textContent=label || (score === null ? 'NO DATA' : levelName(score).toUpperCase()); };
  const toast = (message, kind='success') => {
    const region=$('toastRegion'); if(!region)return;
    const el=document.createElement('div'); el.className=`toast ${kind}`; el.innerHTML=`<span class="toast-mark">${kind==='error'?'!':'✓'}</span><span></span>`;
    el.lastElementChild.textContent=message; region.appendChild(el); setTimeout(()=>el.remove(),3600);
  };
  function showPage(page) {
    const pages=['overview','environment','intelligence','history','health','settings'];
    if(!pages.includes(page)) page='overview';
    state.page=page;
    document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===`page-${page}`));
    document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
    const nav=document.querySelector(`.nav-item[data-page="${page}"]`);
    setText('breadcrumbCurrent',nav ? nav.innerText.replace('↗','').trim() : 'Command overview');
    document.title=`${nav ? nav.innerText.replace('↗','').trim() : 'Command overview'} | Fieldwise`;
    history.replaceState(null,'',`#${page}`);
    $('sidebar')?.classList.remove('open');
    if(page==='overview') requestAnimationFrame(drawChart);
    if(page==='history') renderHistory();
    if(page==='health') renderHealth();
    if(page==='settings') renderSettingsSummary();
  }
  function riskDescription(row) {
    const score=Number(row.overall_risk)||0;
    const scores=[['Fire',Number(row.fire_risk)||0],['Flood',Number(row.flood_risk)||0],['Intrusion',Number(row.intrusion_risk)||0]].sort((a,b)=>b[1]-a[1]);
    if(score<25) return 'Reported hazard vectors are below the moderate threshold. Continue normal monitoring.';
    return `${scores[0][0]} is the highest reported vector at ${Math.round(scores[0][1])}%. ${score>=75?'Treat this as a prototype critical indication and verify the physical environment.':'Continue observing the sensor readings and verify the cause.'}`;
  }
  function renderTop(row) {
    const online=fresh(row);
    $('cloudDot').className=`status-dot ${state.apiOk?'online':'offline'}`;
    setText('cloudLabel',state.apiOk?(online?'Telemetry flowing':'Cloud connected · stale data'):'API unavailable');
    setText('apiState',state.apiOk?'Connected':'Unavailable');
    setText('node1State',row?(online?'Recent packet':'Stale packet'):'Waiting');
    setText('node2State',row?(online?'Gateway path active':'Not recently seen'):'Waiting');
    setText('deviceName',`Device: ${safe(row?.device_id)}`);
    setText('packetNumber',`Packet #${safe(row?.sequence_number)}`);
    setText('footerUpdated',row?`Updated ${shortTime(row.created_at)}`:'Waiting for data');
    setText('currentDate',new Date().toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'}));
    $('cloudDot').title=state.apiOk?'API request succeeded':'API request failed';
  }
  function renderOverview(row) {
    if(!row)return;
    const risk=Number(row.overall_risk)||0;
    setText('riskValue',Math.round(risk)); setText('riskDonutValue',Math.round(risk));
    $('riskDonut').style.background=`conic-gradient(${risk>=75?'var(--coral)':risk>=50?'var(--gold)':risk>=25?'var(--plum)':'var(--green)'} ${clamp(risk)*3.6}deg,#e9e1eb 0)`;
    setText('riskHeadline',risk>=75?'Critical risk reported':risk>=50?'Elevated risk detected':risk>=25?'Moderate signals present':'Environment looks stable');
    setText('riskDescription',riskDescription(row));
    setChip('riskChip',risk,levelName(risk).toUpperCase());
    setText('miniFire',pct(row.fire_risk));setText('miniFlood',pct(row.flood_risk));setText('miniIntrusion',pct(row.intrusion_risk));
    setText('lastUpdated',`Last packet ${shortTime(row.created_at)}`);
    setText('temperature',valid(row.temperature)&&Number(row.temperature)>=0?number(row.temperature):'—');
    setText('humidity',valid(row.humidity)&&Number(row.humidity)>=0?number(row.humidity,0):'—');
    setText('gas',valid(row.gas_raw)?number(row.gas_raw,0):'—');
    setText('soil',valid(row.soil_percent)?number(row.soil_percent,0):'—');
    setWidth('humidityMeter',row.humidity);setWidth('gasMeter',Number(row.gas_raw)/4095*100);setWidth('soilMeter',row.soil_percent);
    setText('fireValue',pct(row.fire_risk));setText('floodValue',pct(row.flood_risk));setText('intrusionValue',pct(row.intrusion_risk));
    setWidth('fireBar',row.fire_risk);setWidth('floodBar',row.flood_risk);setWidth('intrusionBar',row.intrusion_risk);
    setText('fireCaption',Number(row.fire_risk)>=75?'Critical reported score':Number(row.fire_risk)>=35?'Elevated gas-derived estimate':'Below alert threshold');
    setText('floodCaption',Number(row.flood_risk)>=75?'Critical reported score':Number(row.flood_risk)>=35?'Elevated moisture estimate':'Below alert threshold');
    setText('intrusionCaption',Number(row.intrusion_risk)>=75?'Motion-triggered high score':Number(row.intrusion_risk)>=35?'Digital event present':'No high intrusion score');
    setText('temperatureFoot',Number(row.temperature)<0?'DHT11 · invalid reading':'DHT11 · ambient air');
    setText('tempTrend',Number(row.temperature)<0?'INVALID':'LIVE');setText('humidityTrend',Number(row.humidity)<0?'INVALID':'LIVE');
    setText('distance',valid(row.distance_cm)&&Number(row.distance_cm)>=0?number(row.distance_cm):'—');
    renderRecentRows();drawChart();
  }
  function renderEnvironment(row) {
    if(!row)return;
    const temp=Number(row.temperature),hum=Number(row.humidity),gas=Number(row.gas_raw),soil=Number(row.soil_percent),dist=Number(row.distance_cm),anom=Number(row.anomaly_score);
    setText('envHeadline',`Latest packet #${safe(row.sequence_number)}`);
    setText('envSummary',`Received from ${safe(row.device_id)}. Values below are the readings stored in the latest API record.`);
    setText('envLastTime',stamp(row.created_at));
    setText('envTemperature',temp<0?'Unavailable':number(temp));setText('envHumidity',hum<0?'Unavailable':number(hum));
    setText('envGas',valid(gas)?number(gas,0):'—');setText('envSoil',valid(soil)?number(soil,0):'—');
    setText('envDistance',dist<0?'No echo':number(dist));setText('envAnomaly',valid(anom)?number(anom,2):'—');
    [['dhtState',temp>=0],['humidityState',hum>=0],['gasState',valid(gas)],['soilState',valid(soil)],['distanceState',dist>=0],['anomalyState',valid(anom)]].forEach(([id,ok])=>{const e=$(id);if(e){e.textContent=ok?'RECEIVED':'CHECK SIGNAL';e.className=`sensor-state ${ok?'good':'warn'}`}});
    setWidth('temperatureScale',temp<0?0:temp/50*100);setWidth('humidityScale',hum);setWidth('gasScale',gas/4095*100);setWidth('soilScale',soil);setWidth('distanceScale',dist<0?0:dist/400*100);setWidth('anomalyScale',anom);
    const events=[['envLdrState',row.ldr_detected,'LIGHT'],['envPirState',row.pir_motion,'MOTION'],['envIrState',row.ir_obstacle,'OBSTACLE']];
    let active=0;
    events.forEach(([id,value,label])=>{const e=$(id);if(e){const on=value===true||Number(value)===1;e.textContent=on?'ACTIVE':'CLEAR';e.className=`digital-state ${on?'active':''}`;if(on)active++}});
    setText('digitalSummary',`${active} ACTIVE INPUT${active===1?'':'S'}`);
  }
  function renderIntelligence(row) {
    if(!row)return;
    const overall=Number(row.overall_risk)||0,fire=Number(row.fire_risk)||0,flood=Number(row.flood_risk)||0,intr=Number(row.intrusion_risk)||0;
    const vectors=[['Fire',fire,'✦','gas signal'],['Flood',flood,'≈','soil moisture estimate'],['Intrusion',intr,'⌖','PIR / IR digital inputs']].sort((a,b)=>b[1]-a[1]);
    setText('intelOverall',Math.round(overall));setChip('intelBadge',overall,levelName(overall).toUpperCase());
    setText('intelDecision',overall>=75?'Critical indication':overall>=50?'High risk indication':overall>=25?'Moderate risk indication':'Baseline stable');
    setText('intelDecisionText',riskDescription(row));setText('intelDevice',safe(row.device_id));setText('intelSequence',safe(row.sequence_number));
    setText('dominantIcon',vectors[0][2]);setText('dominantTitle',overall<25?'No elevated vector':`${vectors[0][0]} is dominant`);
    setText('dominantDescription',overall<25?'All reported risk scores are currently below the moderate threshold.':`Highest reported score: ${Math.round(vectors[0][1])}% from the ${vectors[0][3]}.`);
    setText('domFire',pct(fire));setText('domFlood',pct(flood));setText('domIntrusion',pct(intr));
    [['Fire',fire,'intelFire','intelFireBar','intelFireChip','intelFireText','raw gas ADC-derived estimate'],['Flood',flood,'intelFlood','intelFloodBar','intelFloodChip','intelFloodText','soil moisture proxy; not direct water-level sensing'],['Intrusion',intr,'intelIntrusion','intelIntrusionBar','intelIntrusionChip','intelIntrusionText','PIR and IR digital event logic']].forEach(([name,val,numId,barId,chipId,textId,explanation])=>{
      setText(numId,Math.round(val));setWidth(barId,val);setChip(chipId,val,levelName(val).toUpperCase());
      setText(textId,`${Math.round(val)}% reported score. Derived from ${explanation}.`);
    });
    setText('explainTitle',overall<25?'No elevated hazard vector reported':`${vectors[0][0]} is driving the reported score`);
    setText('explainText',`Composite score ${Math.round(overall)}/100. ${vectors[0][0]} is the largest of the three reported vectors (${Math.round(vectors[0][1])}%). The current firmware uses threshold-based estimates and sets anomalyScore equal to overallRisk; this is not a trained-model confidence or statistical Z-score.`);
  }
  function renderHistory() {
    const tbody=$('historyRows'); if(!tbody)return;
    const query=($('historySearch')?.value||'').trim().toLowerCase(),filter=$('riskFilter')?.value||'all',limit=Number($('historyLimit')?.value||20);
    const rows=state.rows.filter(r=>{
      const risk=Number(r.overall_risk)||0,level=scoreLevel(risk);
      const matchesFilter=filter==='all'||filter===level;
      const text=[r.device_id,r.sequence_number,r.overall_risk,r.risk_level,r.temperature,r.humidity,r.gas_raw,r.soil_percent].join(' ').toLowerCase();
      return matchesFilter&&text.includes(query);
    }).slice(0,limit);
    tbody.replaceChildren();
    if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=9;td.className='empty-cell';td.textContent=state.rows.length?'No packets match these filters.':'No cloud telemetry records returned yet.';tr.appendChild(td);tbody.appendChild(tr);}
    rows.forEach(r=>{
      const tr=document.createElement('tr'),risk=Number(r.overall_risk)||0;
      const vals=[`#${safe(r.sequence_number)}`,stamp(r.created_at),safe(r.device_id),valid(r.temperature)&&Number(r.temperature)>=0?`${number(r.temperature)} °C`:'—',valid(r.humidity)&&Number(r.humidity)>=0?`${number(r.humidity)}%`:'—',valid(r.gas_raw)?number(r.gas_raw,0):'—',valid(r.soil_percent)?`${number(r.soil_percent,0)}%`:'—',`${Math.round(risk)} / 100`,levelName(risk)];
      vals.forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;if(i===0)td.className='packet-id';if(i===7)td.className='risk-cell';if(i===8){const chip=document.createElement('span');chip.className=`table-chip chip-${scoreLevel(risk)}`;chip.textContent=v;td.replaceChildren(chip)}tr.appendChild(td)});tbody.appendChild(tr);
    });
    setText('historyCount',state.rows.length);setText('historySequence',state.latest?safe(state.latest.sequence_number):'—');setText('historyStatus',state.latest?(fresh(state.latest)?'Online':'Stale'):'Waiting');
    setText('historyShowing',`Showing ${rows.length} of ${state.rows.length} loaded packets`);
  }
  function renderRecentRows() {
    const tbody=$('recentRows');if(!tbody)return;tbody.replaceChildren();
    const rows=state.rows.slice(0,5);
    if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.className='empty-cell';td.textContent='Waiting for the first cloud telemetry packet…';tr.appendChild(td);tbody.appendChild(tr);return;}
    rows.forEach(r=>{
      const tr=document.createElement('tr'),risk=Number(r.overall_risk)||0;
      const values=[`#${safe(r.sequence_number)}`,shortTime(r.created_at),safe(r.device_id),`${Math.round(risk)} / 100`,null,levelName(risk)];
      values.forEach((v,i)=>{const td=document.createElement('td');if(i===3){td.className='risk-cell';td.textContent=v}else if(i===4){[['PIR',r.pir_motion],['IR',r.ir_obstacle],['LDR',r.ldr_detected]].forEach(([label,val])=>{const span=document.createElement('span');span.className=`event-pill ${(val===true||Number(val)===1)?'active':''}`;span.textContent=label;td.appendChild(span)})}else td.textContent=v;if(i===0)td.className='packet-id';if(i===5){const chip=document.createElement('span');chip.className=`table-chip chip-${scoreLevel(risk)}`;chip.textContent=v;td.replaceChildren(chip)}tr.appendChild(td)});tbody.appendChild(tr);
    });
  }
  function renderHealth() {
    const row=state.latest,online=fresh(row);
    setText('healthHeadline',state.apiOk?(online?'Cloud telemetry is arriving':'Cloud API reachable · data stale'):'Unable to reach telemetry API');
    setText('healthDescription',state.apiOk?(online?'Recent packet detected in the last 15 seconds.':'API responds, but no recent packet is visible. Check Node 2 upload logs.'):'Check network access, Vercel deployment, and the /api/telemetry endpoint.');
    setChip('healthStatusChip',state.apiOk?(online?0:50):75,state.apiOk?(online?'RECENT TELEMETRY':'STALE DATA'):'API ERROR');
    setChip('sensorNodeChip',row?(online?0:50):null,row?(online?'RECENT PACKET':'STALE PACKET'):'UNKNOWN');
    setChip('gatewayChip',null,'NOT DIRECTLY REPORTED');
    setChip('cloudHealthChip',state.apiOk?0:75,state.apiOk?'API RESPONDING':'API ERROR');
    setText('healthDevice',safe(row?.device_id));setText('healthSequence',safe(row?.sequence_number));setText('healthUptime',row&&valid(row.device_uptime_ms)?formatDuration(Number(row.device_uptime_ms)):'—');
    setText('healthFailures',safe(row?.failed_transmissions));setText('apiResponse',state.apiOk?'HTTP/API response OK':'Request failed');setText('apiLastSuccess',state.lastSuccess?shortTime(state.lastSuccess):'—');
    setText('healthStatusChip',state.apiOk?(online?'RECENT TELEMETRY':'STALE DATA'):'API ERROR');
    setText('node1State',row?(online?'Recent packet':'Stale packet'):'Waiting');setText('node2State',row?(online?'Gateway path active':'Not recently seen'):'Waiting');setText('apiState',state.apiOk?'Connected':'Unavailable');
  }
  function formatDuration(ms){const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),r=s%60;return h?`${h}h ${m}m`:`${m}m ${r}s`;}
  function drawChart() {
    const canvas=$('riskChart');if(!canvas||state.page!=='overview')return;
    if(state.chartCleared){const empty=$('chartEmpty');if(empty){empty.style.display='grid';empty.textContent='Chart cleared locally. New telemetry will repopulate it.';}setText('chartRange','Chart cleared locally');const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);return;}
    const box=canvas.getBoundingClientRect();if(!box.width||!box.height)return;
    const dpr=window.devicePixelRatio||1;canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr);
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    const w=box.width,h=box.height,pad={l:28,r:9,t:12,b:24},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;
    ctx.clearRect(0,0,w,h);ctx.font='9px DM Sans, sans-serif';ctx.textBaseline='middle';
    for(let n=0;n<=4;n++){const val=100-n*25,y=pad.t+ph*n/4;ctx.strokeStyle='#eee8e7';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillStyle='#aaa0aa';ctx.textAlign='right';ctx.fillText(String(val),pad.l-8,y);}
    let rows=state.rows.slice().reverse();if(state.chartWindow!=='all')rows=rows.slice(-Number(state.chartWindow));
    const empty=$('chartEmpty');if(empty)empty.style.display=rows.length?'none':'grid';
    if(!rows.length){setText('chartRange','No packets loaded');return;}
    const series=[['fire_risk','#df765e'],['flood_risk','#6688c6'],['intrusion_risk','#9170b2']];
    series.forEach(([key,color])=>{
      ctx.strokeStyle=color;ctx.lineWidth=2.2;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();
      rows.forEach((r,i)=>{const x=pad.l+(rows.length===1?pw/2:i*pw/(rows.length-1)),v=clamp(r[key]),y=pad.t+ph*(1-v/100);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});
      ctx.stroke();
      if(rows.length===1){const x=pad.l+pw/2,y=pad.t+ph*(1-clamp(rows[0][key])/100);ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();}
    });
    ctx.fillStyle='#9c929e';ctx.textAlign='left';ctx.fillText(shortTime(rows[0].created_at),pad.l,h-8);ctx.textAlign='right';ctx.fillText(shortTime(rows[rows.length-1].created_at),w-pad.r,h-8);
    setText('chartRange',`${rows.length} packets · ${shortTime(rows[0].created_at)} – ${shortTime(rows[rows.length-1].created_at)}`);
  }
  async function fetchTelemetry(manual=false) {
    const btn=$('refreshButton');if(manual&&btn){btn.disabled=true;btn.textContent='…';}
    try {
      const res=await fetch(API,{cache:'no-store',headers:{'Accept':'application/json'}});
      let data;try{data=await res.json()}catch{throw new Error(`API returned non-JSON (${res.status})`)}
      if(!res.ok||!data||data.ok===false)throw new Error(data?.error||`API request failed (${res.status})`);
      if(!Array.isArray(data.rows))throw new Error('API response did not contain a rows array');
      const previousLatest=state.latest?.created_at;state.apiOk=true;state.lastSuccess=Date.now();state.rows=data.rows.filter(r=>r&&typeof r==='object').sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
      state.latest=state.rows[0]||null;if(state.latest&&state.latest.created_at!==previousLatest)state.chartCleared=false;renderTop(state.latest);
      if(state.latest){renderOverview(state.latest);renderEnvironment(state.latest);renderIntelligence(state.latest);}
      else {setText('cloudLabel','API connected · no records');setText('apiState','Connected · empty');}
      renderHistory();renderHealth();
      if(manual)toast(state.latest?'Telemetry refreshed successfully.':'API connected, but no telemetry rows exist yet.');
      return true;
    } catch(err) {
      state.apiOk=false;renderTop(state.latest);renderHealth();
      if(manual)toast(`Refresh failed: ${err.message}`,'error');
      return false;
    } finally {if(manual&&btn){btn.disabled=false;btn.textContent='↻';}}
  }
  function downloadFile(name,content,type='text/csv;charset=utf-8') {
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function csvEscape(value){const s=value===null||value===undefined?'':String(value);return `"${s.replace(/"/g,'""')}"`;}
  function exportRows(rows,name) {
    if(!rows.length){toast('No telemetry records are loaded to export.','error');return;}
    const fields=['created_at','device_id','sequence_number','device_uptime_ms','temperature','humidity','gas_raw','soil_raw','soil_percent','ldr_detected','pir_motion','ir_obstacle','distance_cm','anomaly_score','fire_risk','flood_risk','intrusion_risk','overall_risk','risk_level','failed_transmissions','ml_confidence'];
    const csv=[fields.join(','),...rows.map(r=>fields.map(f=>csvEscape(r[f])).join(','))].join('\r\n');
    downloadFile(name,csv);toast(`Exported ${rows.length} telemetry records.`);
  }
  function openModal(title,html,confirmText='Go to node health ↗',confirm=()=>showPage('health')) {
    setText('modalTitle',title);$('modalBody').innerHTML=html;$('modalConfirm').textContent=confirmText;$('modalConfirm').onclick=()=>{closeModal();confirm();};$('modalBackdrop').hidden=false;
  }
  function closeModal(){$('modalBackdrop').hidden=true;}
  function openChecklist(){openModal('Before you test live telemetry',`<p>Use this quick sequence to isolate the link between your two ESP32 boards and the cloud dashboard.</p><ul><li><strong>Node 1:</strong> serial output shows sensor readings and “ESP-NOW send queued.”</li><li><strong>Node 2:</strong> receives a valid packet on the same ESP-NOW channel (11) and sends an ACK.</li><li><strong>Wi-Fi/API:</strong> gateway joins your Wi-Fi and posts to <code>/api/telemetry</code>.</li><li><strong>Cloud:</strong> the API returns saved rows and the newest packet timestamp updates.</li></ul><p>Do not put a Supabase service-role key in ESP32 firmware or public dashboard code.</p>`);}
  function renderSettingsSummary(){setText('settingsCurrentRefresh',`${state.interval/1000} seconds`);setText('settingsCurrentTheme',({light:'Studio clay',sage:'Botanical',blue:'Coastal'})[state.theme]||'Studio clay');}
  function applyTheme(theme){state.theme=['light','sage','blue'].includes(theme)?theme:'light';if(state.theme==='light')document.body.removeAttribute('data-theme');else document.body.dataset.theme=state.theme;document.querySelectorAll('.theme-option').forEach(b=>b.classList.toggle('selected',b.dataset.theme===state.theme));}
  function restartTimer(){if(state.timer)clearInterval(state.timer);state.timer=null;if(state.autoRefresh)state.timer=setInterval(()=>fetchTelemetry(false),state.interval);}
  function saveSettings(){state.autoRefresh=$('autoRefreshToggle').checked;state.interval=Number($('refreshInterval').value||3)*1000;restartTimer();renderSettingsSummary();toast('Preferences applied to this browser.');}
  function resetSettings(){state.autoRefresh=true;state.interval=3000;applyTheme('light');$('autoRefreshToggle').checked=true;$('refreshInterval').value='3';restartTimer();renderSettingsSummary();toast('Preferences reset to defaults.');}
  document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>showPage(btn.dataset.page)));
  document.querySelectorAll('[data-goto]').forEach(btn=>btn.addEventListener('click',()=>showPage(btn.dataset.goto)));
  $('mobileMenu').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
  $('refreshButton').addEventListener('click',()=>fetchTelemetry(true));
  $('environmentRefresh').addEventListener('click',()=>fetchTelemetry(true));
  $('historyRefresh').addEventListener('click',()=>fetchTelemetry(true));
  $('healthRefresh').addEventListener('click',()=>fetchTelemetry(true));
  $('exportOverview').addEventListener('click',()=>exportRows(state.rows.slice(0,20),'fieldwise-overview.csv'));
  $('exportEnvironment').addEventListener('click',()=>exportRows(state.rows,'fieldwise-environment.csv'));
  $('exportRisk').addEventListener('click',()=>exportRows(state.rows,'fieldwise-risk-report.csv'));
  $('exportHistory').addEventListener('click',()=>exportRows(state.rows,'fieldwise-telemetry-history.csv'));
  $('settingsExport').addEventListener('click',()=>exportRows(state.rows,'fieldwise-telemetry.csv'));
  $('openIncidentLog').addEventListener('click',()=>showPage('history'));
  $('clearHistorySearch').addEventListener('click',()=>{$('historySearch').value='';$('riskFilter').value='all';$('historyLimit').value='20';renderHistory();toast('History filters cleared.');});
  $('historySearch').addEventListener('input',renderHistory);$('riskFilter').addEventListener('change',renderHistory);$('historyLimit').addEventListener('change',renderHistory);
  document.querySelectorAll('[data-window]').forEach(btn=>btn.addEventListener('click',()=>{state.chartWindow=btn.dataset.window;document.querySelectorAll('[data-window]').forEach(b=>b.classList.toggle('active',b===btn));drawChart();}));
  $('themeButton').addEventListener('click',()=>{const themes=['light','sage','blue'],next=themes[(themes.indexOf(state.theme)+1)%themes.length];applyTheme(next);renderSettingsSummary();toast(`Color palette: ${{light:'Studio clay',sage:'Botanical',blue:'Coastal'}[next]}.`);});
  document.querySelectorAll('.theme-option').forEach(btn=>btn.addEventListener('click',()=>{applyTheme(btn.dataset.theme);renderSettingsSummary();}));
  $('saveSettings').addEventListener('click',saveSettings);$('resetSettings').addEventListener('click',resetSettings);
  $('autoRefreshToggle').addEventListener('change',()=>{state.autoRefresh=$('autoRefreshToggle').checked;restartTimer();toast(state.autoRefresh?'Automatic refresh enabled.':'Automatic refresh paused.');});
  $('refreshInterval').addEventListener('change',()=>{state.interval=Number($('refreshInterval').value)*1000;restartTimer();renderSettingsSummary();toast(`Refresh interval set to ${state.interval/1000} seconds.`);});
  $('clearChart').addEventListener('click',()=>{state.chartCleared=true;drawChart();toast('Chart cleared locally. Cloud telemetry records were not deleted.');});
  $('openChecklist').addEventListener('click',openChecklist);$('footerHelp').addEventListener('click',openChecklist);
  $('closeModal').addEventListener('click',closeModal);$('modalCancel').addEventListener('click',closeModal);
  $('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
  window.addEventListener('resize',()=>requestAnimationFrame(drawChart));
  window.addEventListener('hashchange',()=>showPage(location.hash.slice(1)));
  setInterval(()=>{setText('currentDate',new Date().toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'}));if(state.latest)renderHealth();},1000);
  const first=location.hash.slice(1);showPage(first||'overview');applyTheme('light');renderSettingsSummary();fetchTelemetry(false);restartTimer();
})();
