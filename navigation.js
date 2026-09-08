(() => {
  const pages = {
    overview: 'Live Operations',
    environment: 'Environment',
    intelligence: 'Intelligence',
    'node-health': 'Node health'
  };
  let latest = null;
  const main = document.querySelector('main');
  const links = [...document.querySelectorAll('nav a')];
  links.forEach((link, index) => {
    const key = Object.keys(pages)[index];
    link.href = '#' + key;
    link.dataset.page = key;
  });
  const card = (label, id, detail) => `<article><label>${label}</label><b id="${id}">--</b><small>${detail}</small></article>`;
  main.insertAdjacentHTML('beforeend', `
    <section id="view-environment" class="page-view" hidden aria-label="Environment">
      <p class="view-note">Latest sensor readings. Check Node health to see when they were received.</p>
      <div class="metrics">
        ${card('Temperature', 'env-temperature', 'Degrees Celsius')}
        ${card('Humidity', 'env-humidity', 'Relative humidity')}
        ${card('Gas sensor', 'env-gas', 'MQ-2 raw ADC, not gas concentration')}
        ${card('Soil moisture', 'env-soil', 'Calibrated probe percentage')}
        ${card('Object distance', 'env-distance', 'Ultrasonic reading')}
        ${card('Edge anomaly', 'env-anomaly', 'Deviation from learned baseline')}
      </div>
      <section class="threat-card"><h3>Sensor events</h3><div class="detections">
        <span id="env-pir">PIR: --</span><span id="env-ir">IR: --</span><span id="env-ldr">LIGHT: --</span>
      </div></section>
    </section>
    <section id="view-intelligence" class="page-view" hidden aria-label="Intelligence">
      <p class="view-note">Latest rule-based risk scores reported by the sensor node.</p>
      <div class="metrics intelligence-metrics">
        ${card('Overall risk', 'intel-overall', 'Reported composite score')}
        ${card('Fire', 'intel-fire', 'Rule-based score')}
        ${card('Flood', 'intel-flood', 'Rule-based score')}
        ${card('Intrusion', 'intel-intrusion', 'Rule-based score')}
      </div>
      <section class="threat-card"><h3>ML predictions</h3>
        <p class="view-note">Not available in the current dashboard data. Fire and soil model predictions are currently shown on Node 1's Serial Monitor. The scores above are not ML probabilities.</p>
      </section>
    </section>
    <section id="view-node-health" class="page-view" hidden aria-label="Node health">
      <section class="threat-card"><h3>Latest received telemetry</h3><dl class="health-list">
        <dt>Data status</dt><dd id="health-status">No telemetry yet</dd>
        <dt>Device</dt><dd id="health-device">--</dd>
        <dt>Last packet</dt><dd id="health-time">--</dd>
        <dt>Packet sequence</dt><dd id="health-sequence">--</dd>
        <dt>Reported transmission failures</dt><dd id="health-failures">--</dd>
        <dt>Cloud API</dt><dd id="health-cloud">Connecting…</dd>
      </dl><p class="view-note">Recent data means a packet reached the cloud within 15 seconds. Separate relay and gateway health reports are not available yet.</p></section>
    </section>`);

  const text = (id, value) => { document.getElementById(id).textContent = value; };
  const numeric = (value, digits = 1, suffix = '') =>
    value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
      ? Number(value).toFixed(digits) + suffix : '--';
  const event = (v, yes, no) => v === true || v === 1 ? yes : v === false || v === 0 ? no : '--';

  function selectPage() {
    const requested = location.hash.slice(1);
    const page = Object.hasOwn(pages, requested) ? requested : 'overview';
    if (requested && requested !== page) window.history.replaceState(null, '', '#overview');
    document.querySelector('h1').textContent = pages[page];
    document.title = pages[page] + ' | Resilient AI';
    links.forEach(link => {
      const active = link.dataset.page === page;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.getElementById('content').hidden = page !== 'overview' || !latest;
    document.getElementById('empty').hidden = page !== 'overview' || !!latest;
    document.querySelectorAll('.page-view').forEach(view => {
      view.hidden = view.id !== 'view-' + page;
    });
    if (page === 'overview' && latest && typeof chart === 'function') requestAnimationFrame(chart);
  }

  function renderDetails(row) {
    latest = row;
    text('env-temperature', Number(row.temperature) <= -100 ? 'Unavailable' : numeric(row.temperature, 1, ' °C'));
    text('env-humidity', Number(row.humidity) < 0 ? 'Unavailable' : numeric(row.humidity, 1, '%'));
    text('env-gas', numeric(row.gas_raw, 0));
    text('env-soil', numeric(row.soil_percent, 0, '%'));
    text('env-distance', Number(row.distance_cm) < 0 ? 'No reading' : numeric(row.distance_cm, 1, ' cm'));
    text('env-anomaly', numeric(row.anomaly_score, 2));
    text('env-pir', 'PIR: ' + event(row.pir_motion, 'MOTION', 'CLEAR'));
    text('env-ir', 'IR: ' + event(row.ir_obstacle, 'OBSTACLE', 'CLEAR'));
    text('env-ldr', 'LIGHT: ' + event(row.ldr_detected, 'EVENT', 'CLEAR'));
    for (const key of ['overall', 'fire', 'flood', 'intrusion']) text('intel-' + key, numeric(row[key + '_risk'], 0, '%'));
    text('health-device', row.device_id ?? '--');
    text('health-sequence', row.sequence_number ?? '--');
    text('health-failures', numeric(row.failed_transmissions, 0));
    const date = new Date(row.created_at);
    text('health-time', Number.isFinite(date.getTime()) ? date.toLocaleString() : '--');
    updateHealth();
    selectPage();
  }
  function updateHealth() {
    const cloud = document.getElementById('cloud').textContent;
    text('health-cloud', cloud);
    const age = latest ? Date.now() - new Date(latest.created_at).getTime() : NaN;
    const fresh = Number.isFinite(age) && age >= 0 && age < 15000;
    text('health-status', !latest ? 'No telemetry yet' : cloud === 'Connection error' ? 'Cloud unavailable — showing last received data' : fresh ? 'Recent telemetry' : 'Stale telemetry');
    if (latest && cloud !== 'Connection error') {
      const badge = document.getElementById('nodeBadge');
      badge.textContent = fresh ? 'NODE ONLINE' : 'NODE OFFLINE';
      badge.className = fresh ? '' : 'offline';
    }
  }
  window.addEventListener('telemetry-update', e => renderDetails(e.detail));
  window.addEventListener('hashchange', selectPage);
  setInterval(updateHealth, 1000);
  selectPage();
})();
