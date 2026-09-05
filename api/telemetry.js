import { createClient } from '@supabase/supabase-js';

const fields = ['device_id','sequence_number','device_uptime_ms','temperature','humidity','gas_raw','soil_raw','soil_percent','ldr_detected','pir_motion','ir_obstacle','distance_cm','anomaly_score','fire_risk','flood_risk','intrusion_risk','overall_risk','risk_level','failed_transmissions'];
const numeric = new Set(['sequence_number','device_uptime_ms','temperature','humidity','gas_raw','soil_raw','soil_percent','distance_cm','anomaly_score','fire_risk','flood_risk','intrusion_risk','overall_risk','risk_level','failed_transmissions']);
const boolean = new Set(['ldr_detected','pir_motion','ir_obstacle']);
const CRITICAL_RISK = 75;
const ALERT_COOLDOWN_MINUTES = 15;

function database() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Server database configuration is missing');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

function clean(body) {
  const row = {};
  for (const key of fields) {
    if (!(key in body)) continue;
    if (numeric.has(key)) { const value = Number(body[key]); if (Number.isFinite(value)) row[key] = value; }
    else if (boolean.has(key)) row[key] = Boolean(body[key]);
    else row[key] = String(body[key]).slice(0, 40);
  }
  row.device_id ||= 'NODE_01';
  return row;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[character]);
}

async function sendCriticalAlert(db, telemetry, reading) {
  if (Number(reading.overall_risk) < CRITICAL_RISK) {
    return { triggered: false, reason: 'risk_below_threshold' };
  }

  if (!process.env.RESEND_API_KEY || !process.env.ALERT_EMAIL) {
    console.error('[Alert] RESEND_API_KEY or ALERT_EMAIL is missing');
    return { triggered: false, reason: 'email_not_configured' };
  }

  const cooldownStarted = new Date(
    Date.now() - ALERT_COOLDOWN_MINUTES * 60 * 1000
  ).toISOString();

  const { data: recentAlert, error: lookupError } = await db
    .from('alert_events')
    .select('id,created_at')
    .eq('device_id', reading.device_id)
    .in('email_status', ['pending', 'sent'])
    .gte('created_at', cooldownStarted)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (recentAlert) {
    return { triggered: false, reason: 'cooldown_active' };
  }

  const { data: alertEvent, error: createError } = await db
    .from('alert_events')
    .insert({
      device_id: reading.device_id,
      telemetry_id: telemetry.id,
      alert_type: 'CRITICAL',
      risk: reading.overall_risk,
      email_status: 'pending'
    })
    .select('id')
    .single();

  if (createError) throw createError;

  const device = escapeHtml(reading.device_id);
  const risk = Number(reading.overall_risk).toFixed(1);
  const subject = `CRITICAL ALERT: ${reading.device_id} risk ${risk}%`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#162033">
      <div style="background:#b91c1c;color:white;padding:20px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;font-size:24px">RESILIENT AI — Critical Alert</h1>
      </div>
      <div style="border:1px solid #e5e7eb;padding:22px;border-radius:0 0 12px 12px">
        <p>A critical environmental condition has been detected by <strong>${device}</strong>.</p>
        <h2 style="color:#b91c1c">Overall risk: ${risk}%</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:7px"><strong>Temperature</strong></td><td>${escapeHtml(reading.temperature ?? 'N/A')} °C</td></tr>
          <tr><td style="padding:7px"><strong>Humidity</strong></td><td>${escapeHtml(reading.humidity ?? 'N/A')}%</td></tr>
          <tr><td style="padding:7px"><strong>Gas reading</strong></td><td>${escapeHtml(reading.gas_raw ?? 'N/A')}</td></tr>
          <tr><td style="padding:7px"><strong>Soil moisture</strong></td><td>${escapeHtml(reading.soil_percent ?? 'N/A')}%</td></tr>
          <tr><td style="padding:7px"><strong>Water distance</strong></td><td>${escapeHtml(reading.distance_cm ?? 'N/A')} cm</td></tr>
          <tr><td style="padding:7px"><strong>Fire risk</strong></td><td>${escapeHtml(reading.fire_risk ?? 'N/A')}%</td></tr>
          <tr><td style="padding:7px"><strong>Flood risk</strong></td><td>${escapeHtml(reading.flood_risk ?? 'N/A')}%</td></tr>
          <tr><td style="padding:7px"><strong>Intrusion risk</strong></td><td>${escapeHtml(reading.intrusion_risk ?? 'N/A')}%</td></tr>
          <tr><td style="padding:7px"><strong>Detected at</strong></td><td>${escapeHtml(telemetry.created_at)}</td></tr>
        </table>
        <p style="margin-top:20px"><strong>Immediate inspection is recommended.</strong></p>
      </div>
    </div>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `resilient-critical-${telemetry.id}`
      },
      body: JSON.stringify({
        from: process.env.ALERT_FROM || 'RESILIENT AI <onboarding@resend.dev>',
        to: [process.env.ALERT_EMAIL],
        subject,
        html
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || `Resend returned ${response.status}`);

    await db.from('alert_events').update({
      email_status: 'sent',
      email_id: result.id || null
    }).eq('id', alertEvent.id);

    return { triggered: true, status: 'sent' };
  } catch (error) {
    console.error('[Alert] Email delivery failed:', error);
    await db.from('alert_events').update({
      email_status: 'failed',
      error_message: String(error.message || error).slice(0, 500)
    }).eq('id', alertEvent.id);
    return { triggered: true, status: 'failed' };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const db = database();
    if (req.method === 'POST') {
      if (!process.env.DEVICE_API_KEY || req.headers['x-device-key'] !== process.env.DEVICE_API_KEY) return res.status(401).json({ ok: false, error: 'Unauthorized device' });
      const row = clean(typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}));
      const { data, error } = await db.from('telemetry').insert(row).select('id,created_at').single();
      if (error) throw error;
      let alert;
      try {
        alert = await sendCriticalAlert(db, data, row);
      } catch (alertError) {
        console.error('[Alert] Processing failed:', alertError);
        alert = { triggered: false, reason: 'alert_processing_failed' };
      }
      return res.status(201).json({ ok: true, ...data, alert });
    }
    if (req.method === 'GET') {
      const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 300);
      const { data, error } = await db.from('telemetry').select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return res.status(200).json({ ok: true, rows: data || [] });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, error: 'Telemetry service unavailable' });
  }
}
