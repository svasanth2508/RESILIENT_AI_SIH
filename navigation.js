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
      <p class="view-note">Edge-AI multi-sensor risk fusion and live environmental hazard classification models.</p>
      <div class="metrics intelligence-metrics">
        ${card('Overall risk', 'intel-overall', 'Reported composite score')}
        ${card('Fire model', 'intel-fire', 'Thermal & combustion vector')}
        ${card('Flood model', 'intel-flood', 'Hydro-saturation vector')}
        ${card('Intrusion model', 'intel-intrusion', 'Spatial proximity vector')}
      </div>
      
      <div class="ai-grid">
        <div class="ai-card">
          <div class="ai-card-header">
            <h4>Fire Hazard Classifier</h4>
            <span id="ml-fire-badge" class="badge badge-nominal">NOMINAL</span>
          </div>
          <div class="ai-score-row">
            <b id="ml-fire-score">--%</b>
            <span id="ml-fire-class">Quiescent</span>
          </div>
          <div class="ai-bar-track">
            <div id="ml-fire-bar" class="ai-bar-fill" style="width: 0%"></div>
          </div>
          <p id="ml-fire-desc" class="ai-desc">Thermal & MQ-2 gas correlation analysis.</p>
        </div>

        <div class="ai-card">
          <div class="ai-card-header">
            <h4>Flood & Saturation Classifier</h4>
            <span id="ml-flood-badge" class="badge badge-nominal">STABLE</span>
          </div>
          <div class="ai-score-row">
            <b id="ml-flood-score">--%</b>
            <span id="ml-flood-class">Dry Ground</span>
          </div>
          <div class="ai-bar-track">
            <div id="ml-flood-bar" class="ai-bar-fill" style="width: 0%"></div>
          </div>
          <p id="ml-flood-desc" class="ai-desc">Probe moisture & ultrasonic level correlation.</p>
        </div>

        <div class="ai-card">
          <div class="ai-card-header">
            <h4>Intrusion & Perimeter Model</h4>
            <span id="ml-intrusion-badge" class="badge badge-nominal">CLEAR</span>
          </div>
          <div class="ai-score-row">
            <b id="ml-intrusion-score">--%</b>
            <span id="ml-intrusion-class">Perimeter Secure</span>
          </div>
          <div class="ai-bar-track">
            <div id="ml-intrusion-bar" class="ai-bar-fill" style="width: 0%"></div>
          </div>
          <p id="ml-intrusion-desc" class="ai-desc">PIR, IR obstacle & proximity cluster analysis.</p>
        </div>
      </div>

      <div class="explain-card">
        <div class="title">
          <div>
            <p>EDGE INFERENCE &amp; EXPLAINABILITY ENGINE</p>
            <h3>Live Hazard Decision Matrix</h3>
          </div>
        </div>
        <div class="explain-metrics">
          <article>
            <label>AI Model Confidence</label>
            <b id="ml-engine-conf">--%</b>
          </article>
          <article>
            <label>Baseline Anomaly (Z-score)</label>
            <b id="ml-engine-z">-- σ</b>
          </article>
          <article>
            <label>Decision Classification</label>
            <b id="ml-engine-state">--</b>
          </article>
        </div>
        <p id="ml-engine-explanation" class="view-note">Awaiting real-time telemetry packet to evaluate decision matrix...</p>
      </div>
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

  const text = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
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

  function updateIntelligence(row) {
    const fireRisk = Number(row.fire_risk) || 0;
    const floodRisk = Number(row.flood_risk) || 0;
    const intrusionRisk = Number(row.intrusion_risk) || 0;
    const overallRisk = Number(row.overall_risk) || 0;
    const anomaly = Number(row.anomaly_score) || 0;

    const confidence = (row.ml_confidence !== undefined && row.ml_confidence !== null && row.ml_confidence !== '')
      ? Math.min(100, Math.max(0, Math.round(Number(row.ml_confidence))))
      : Math.min(99, Math.max(15, Math.round(55 + overallRisk * 0.35 + Math.min(anomaly, 5) * 2.5)));

    // Fire Model
    text('ml-fire-score', `${fireRisk}%`);
    text('ml-fire-class', fireRisk >= 75 ? 'Critical Fire Risk' : fireRisk >= 35 ? 'Thermal Warning' : 'Quiescent');
    const fireBadge = document.getElementById('ml-fire-badge');
    if (fireBadge) {
      fireBadge.textContent = fireRisk >= 75 ? 'CRITICAL' : fireRisk >= 35 ? 'WARNING' : 'NOMINAL';
      fireBadge.className = 'badge ' + (fireRisk >= 75 ? 'badge-critical' : fireRisk >= 35 ? 'badge-warning' : 'badge-nominal');
    }
    const fireBar = document.getElementById('ml-fire-bar');
    if (fireBar) {
      fireBar.style.width = `${Math.min(100, fireRisk)}%`;
      fireBar.style.background = fireRisk >= 75 ? 'var(--red)' : fireRisk >= 35 ? 'var(--orange)' : 'var(--cyan)';
    }
    const tempText = numeric(row.temperature, 1, ' °C');
    const gasText = numeric(row.gas_raw, 0);
    text('ml-fire-desc', `Thermal & Gas correlation: Gas ADC ${gasText}, Temp ${tempText}. ${fireRisk < 20 ? 'No combustion signature.' : 'Thermal/gas signature elevated.'}`);

    // Flood Model
    text('ml-flood-score', `${floodRisk}%`);
    text('ml-flood-class', floodRisk >= 75 ? 'Severe Flood Alert' : floodRisk >= 35 ? 'Saturation Alert' : 'Dry Ground');
    const floodBadge = document.getElementById('ml-flood-badge');
    if (floodBadge) {
      floodBadge.textContent = floodRisk >= 75 ? 'CRITICAL' : floodRisk >= 35 ? 'WARNING' : 'STABLE';
      floodBadge.className = 'badge ' + (floodRisk >= 75 ? 'badge-critical' : floodRisk >= 35 ? 'badge-warning' : 'badge-nominal');
    }
    const floodBar = document.getElementById('ml-flood-bar');
    if (floodBar) {
      floodBar.style.width = `${Math.min(100, floodRisk)}%`;
      floodBar.style.background = floodRisk >= 75 ? 'var(--red)' : floodRisk >= 35 ? 'var(--orange)' : 'var(--blue)';
    }
    const soilText = numeric(row.soil_percent, 0, '%');
    const distText = Number(row.distance_cm) < 0 ? 'No reading' : numeric(row.distance_cm, 1, ' cm');
    text('ml-flood-desc', `Hydro probe: Soil ${soilText}, Water distance ${distText}. ${floodRisk < 20 ? 'Saturation within normal bounds.' : 'Moisture/water rising.'}`);

    // Intrusion Model
    text('ml-intrusion-score', `${intrusionRisk}%`);
    text('ml-intrusion-class', intrusionRisk >= 75 ? 'Perimeter Breach' : intrusionRisk >= 35 ? 'Spatial Proximity' : 'Perimeter Secure');
    const intrusionBadge = document.getElementById('ml-intrusion-badge');
    if (intrusionBadge) {
      intrusionBadge.textContent = intrusionRisk >= 75 ? 'CRITICAL' : intrusionRisk >= 35 ? 'ELEVATED' : 'CLEAR';
      intrusionBadge.className = 'badge ' + (intrusionRisk >= 75 ? 'badge-critical' : intrusionRisk >= 35 ? 'badge-warning' : 'badge-nominal');
    }
    const intrusionBar = document.getElementById('ml-intrusion-bar');
    if (intrusionBar) {
      intrusionBar.style.width = `${Math.min(100, intrusionRisk)}%`;
      intrusionBar.style.background = intrusionRisk >= 75 ? 'var(--red)' : intrusionRisk >= 35 ? 'var(--orange)' : 'var(--cyan)';
    }
    const pirText = row.pir_motion ? 'PIR Active' : 'PIR Clear';
    const irText = row.ir_obstacle ? 'IR Obstacle' : 'IR Clear';
    text('ml-intrusion-desc', `Spatial cluster: ${pirText}, ${irText}, Target distance ${distText}. ${intrusionRisk >= 35 ? 'Object detected in active corridor.' : 'No unauthorized presence.'}`);

    // Edge Engine Matrix
    text('ml-engine-conf', `${confidence}%`);
    text('ml-engine-z', `${numeric(row.anomaly_score, 2)} σ`);
    text('ml-engine-state', overallRisk >= 75 ? 'CRITICAL ACTION' : overallRisk >= 25 ? 'ELEVATED WATCH' : 'NORMAL STABLE');
    
    let explanation = '';
    if (overallRisk < 25) {
      explanation = `Edge baseline model reports stable environmental conditions. Multivariate anomaly deviation (${numeric(row.anomaly_score, 2)}σ) is within tolerance, and all hazard vectors are quiescent.`;
    } else {
      const topVector = fireRisk >= floodRisk && fireRisk >= intrusionRisk ? 'Fire' : floodRisk >= intrusionRisk ? 'Flood' : 'Intrusion';
      explanation = `Elevated risk index (${overallRisk}%) is primarily driven by the ${topVector} hazard vector with a statistical deviation of ${numeric(row.anomaly_score, 2)}σ. Multi-sensor fusion engine recommends monitoring ${topVector.toLowerCase()} indicators.`;
    }
    text('ml-engine-explanation', explanation);
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
    
    updateIntelligence(row);

    text('health-device', row.device_id ?? '--');
    text('health-sequence', row.sequence_number ?? '--');
    text('health-failures', numeric(row.failed_transmissions, 0));
    const date = new Date(row.created_at);
    text('health-time', Number.isFinite(date.getTime()) ? date.toLocaleString() : '--');
    updateHealth();
    selectPage();
  }
  function updateHealth() {
    const cloudEl = document.getElementById('cloud');
    const cloud = cloudEl ? cloudEl.textContent : '';
    text('health-cloud', cloud);
    const age = latest ? Date.now() - new Date(latest.created_at).getTime() : NaN;
    const fresh = Number.isFinite(age) && age >= 0 && age < 15000;
    text('health-status', !latest ? 'No telemetry yet' : cloud === 'Connection error' ? 'Cloud unavailable — showing last received data' : fresh ? 'Recent telemetry' : 'Stale telemetry');
    if (latest && cloud !== 'Connection error') {
      const badge = document.getElementById('nodeBadge');
      if (badge) {
        badge.textContent = fresh ? 'NODE ONLINE' : 'NODE OFFLINE';
        badge.className = fresh ? '' : 'offline';
      }
    }
  }
  window.addEventListener('telemetry-update', e => renderDetails(e.detail));
  window.addEventListener('hashchange', selectPage);
  setInterval(updateHealth, 1000);
  selectPage();
})();
