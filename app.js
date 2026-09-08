const $ = id => document.getElementById(id), history = [];
let lastId = 0;

const number = (v, d = 1) =>
  v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))
    ? Number(v).toFixed(d)
    : '--';

function riskName(r, rows) {
  if (r < 25) return 'Environment stable';
  const vectors = [
    ['Fire pattern', Number(rows.fire_risk) || 0],
    ['Flood pattern', Number(rows.flood_risk) || 0],
    ['Intrusion pattern', Number(rows.intrusion_risk) || 0]
  ].sort((a, b) => b[1] - a[1]);
  return vectors[0][0] + ' · ' + (r >= 75 ? 'critical action' : 'elevated watch');
}

function bar(id, v) {
  const el = $(id);
  if (!el) return;
  const val = Number(v) || 0;
  el.style.width = Math.max(0, Math.min(100, val)) + '%';
  el.style.background = val >= 75 ? 'var(--red)' : val >= 50 ? 'var(--orange)' : 'var(--cyan)';
}

function chart() {
  const c = $('chart');
  if (!c || c.offsetParent === null) return;
  const box = c.getBoundingClientRect(), scale = window.devicePixelRatio || 1;
  if (!box.width || !box.height) return;
  c.width = box.width * scale;
  c.height = box.height * scale;
  const x = c.getContext('2d');
  x.scale(scale, scale);
  x.clearRect(0, 0, box.width, box.height);
  x.strokeStyle = '#18384b';
  x.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    let y = 12 + i * (box.height - 24) / 4;
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(box.width, y);
    x.stroke();
  }
  if (!history.length) return;
  [['fire_risk', '#ff9b51'], ['flood_risk', '#3f8cff'], ['intrusion_risk', '#ff526c']].forEach(([key, color]) => {
    x.strokeStyle = color;
    x.lineWidth = 2;
    x.beginPath();
    if (history.length === 1) {
      const py = box.height - 12 - (Number(history[0][key]) || 0) * (box.height - 24) / 100;
      x.moveTo(0, py);
      x.lineTo(box.width, py);
      x.stroke();
      x.fillStyle = color;
      x.beginPath();
      x.arc(box.width / 2, py, 4, 0, Math.PI * 2);
      x.fill();
    } else {
      history.forEach((row, i) => {
        const px = i * box.width / Math.max(history.length - 1, 1),
              py = box.height - 12 - (Number(row[key]) || 0) * (box.height - 24) / 100;
        i ? x.lineTo(px, py) : x.moveTo(px, py);
      });
      x.stroke();
    }
  });
}

function render(row, online) {
  const hash = location.hash.slice(1);
  const isOverview = !hash || hash === 'overview';
  if (isOverview) {
    $('empty').hidden = true;
    $('content').hidden = false;
  }
  $('nodeBadge').textContent = online ? 'NODE ONLINE' : 'NODE OFFLINE';
  $('nodeBadge').className = online ? '' : 'offline';
  const risk = Number(row.overall_risk) || 0;
  $('risk').textContent = number(risk, 0);
  $('temperature').textContent = (row.temperature !== null && row.temperature !== undefined && row.temperature !== '' && Number.isFinite(Number(row.temperature))) ? `${number(row.temperature)} °C` : '-- °C';
  $('humidity').textContent = (row.humidity !== null && row.humidity !== undefined && row.humidity !== '' && Number.isFinite(Number(row.humidity))) ? `${number(row.humidity)}%` : '--%';
  $('gas').textContent = row.gas_raw ?? '--';
  $('soil').textContent = (row.soil_percent !== null && row.soil_percent !== undefined && row.soil_percent !== '') ? `${number(row.soil_percent, 0)}%` : '--%';
  $('distance').textContent = row.distance_cm === null || row.distance_cm === undefined || row.distance_cm === ''
    ? '-- cm'
    : Number(row.distance_cm) < 0
      ? 'OUT'
      : `${number(row.distance_cm)} cm`;
  $('anomaly').textContent = number(row.anomaly_score, 2);
  $('decision').textContent = riskName(risk, row);
  const date = new Date(row.created_at);
  $('updated').textContent = 'Last packet ' + (Number.isFinite(date.getTime()) ? date.toLocaleString() : '--');
  
  // AI Confidence & Radar Ring Gauge
  const anomaly = Number(row.anomaly_score) || 0;
  const confidence = (row.ml_confidence !== undefined && row.ml_confidence !== null && row.ml_confidence !== '')
    ? Math.min(100, Math.max(0, Math.round(Number(row.ml_confidence))))
    : Math.min(99, Math.max(15, Math.round(55 + risk * 0.35 + Math.min(anomaly, 5) * 2.5)));
  
  $('confidence').textContent = confidence + '%';
  const ring = document.querySelector('.ring');
  if (ring) {
    const ringColor = risk >= 75 ? 'var(--red)' : risk >= 50 ? 'var(--orange)' : 'var(--cyan)';
    ring.style.background = `conic-gradient(${ringColor} ${confidence * 3.6}deg, #153243 0)`;
  }

  [['fire', row.fire_risk], ['flood', row.flood_risk], ['intrusion', row.intrusion_risk]].forEach(([k, v]) => {
    bar(k + 'Bar', v);
    $(k + 'Text').textContent = number(v, 0) + '%';
  });
  $('pir').textContent = row.pir_motion ? 'PIR MOTION' : 'PIR CLEAR';
  $('ir').textContent = row.ir_obstacle ? 'IR OBSTACLE' : 'IR CLEAR';
  $('ldr').textContent = row.ldr_detected ? 'LIGHT EVENT' : 'LIGHT CLEAR';
  $('device').textContent = 'Device: ' + (row.device_id ?? '--');
  $('packet').textContent = 'Packet: ' + (row.sequence_number ?? '--');
  $('failures').textContent = 'Transmission failures: ' + (row.failed_transmissions ?? '--');
  window.dispatchEvent(new CustomEvent('telemetry-update', { detail: row }));
}

async function update() {
  try {
    const response = await fetch('/api/telemetry?limit=60', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw Error();
    $('cloud').textContent = 'Operational';
    if (!data.rows || !data.rows.length) return;
    history.splice(0, history.length, ...data.rows.slice().reverse());
    const row = data.rows[0];
    const age = Date.now() - new Date(row.created_at).getTime();
    render(row, age < 15000);
    lastId = row.id;
    chart();
  } catch {
    $('cloud').textContent = 'Connection error';
    $('nodeBadge').textContent = 'CLOUD ERROR';
    $('nodeBadge').className = 'offline';
  }
}

setInterval(() => {
  const clk = $('clock');
  if (clk) clk.textContent = new Date().toLocaleTimeString();
}, 1000);
setInterval(update, 3000);
addEventListener('resize', chart);
update();
