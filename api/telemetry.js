import { createClient } from '@supabase/supabase-js';

const fields = [
  'device_id',
  'sequence_number',
  'device_uptime_ms',
  'temperature',
  'humidity',
  'gas_raw',
  'soil_raw',
  'soil_percent',
  'ldr_detected',
  'pir_motion',
  'ir_obstacle',
  'distance_cm',
  'anomaly_score',
  'fire_risk',
  'flood_risk',
  'intrusion_risk',
  'overall_risk',
  'risk_level',
  'failed_transmissions',
  'ml_confidence'
];
const numeric = new Set([
  'sequence_number',
  'device_uptime_ms',
  'temperature',
  'humidity',
  'gas_raw',
  'soil_raw',
  'soil_percent',
  'distance_cm',
  'anomaly_score',
  'fire_risk',
  'flood_risk',
  'intrusion_risk',
  'overall_risk',
  'risk_level',
  'failed_transmissions',
  'ml_confidence'
]);
const boolean = new Set(['ldr_detected', 'pir_motion', 'ir_obstacle']);

// Alert Configuration (Risk threshold >= 80%)
const ALERT_THRESHOLD = Number(process.env.ALERT_THRESHOLD || 80);
const ALERT_COOLDOWN_MINUTES = Number(process.env.ALERT_COOLDOWN_MINUTES || 15);
const inMemoryCooldowns = new Map();

function database() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Server database configuration is missing');
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

function clean(body) {
  const row = {};
  for (const key of fields) {
    if (!(key in body)) continue;
    if (numeric.has(key)) {
      const val = body[key];
      if (val !== null && val !== undefined && val !== '') {
        const value = Number(val);
        if (Number.isFinite(value)) row[key] = value;
      }
    } else if (boolean.has(key)) {
      const val = body[key];
      row[key] = val === true || val === 1 || val === '1' || val === 'true';
    } else if (body[key] !== null && body[key] !== undefined) {
      row[key] = String(body[key]).slice(0, 40);
    }
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
  const risk = Number(reading.overall_risk ?? reading.risk_level ?? 0);
  if (!Number.isFinite(risk) || risk < ALERT_THRESHOLD) {
    return { triggered: false, reason: 'risk_below_threshold', current_risk: risk, threshold: ALERT_THRESHOLD };
  }

  if (!process.env.RESEND_API_KEY || !process.env.ALERT_EMAIL) {
    console.warn('[Alert] RESEND_API_KEY or ALERT_EMAIL is not configured in environment variables');
    return { triggered: false, reason: 'email_not_configured' };
  }

  const deviceId = reading.device_id || 'NODE_01';
  const now = Date.now();
  const cooldownMs = ALERT_COOLDOWN_MINUTES * 60 * 1000;
  const cooldownStarted = new Date(now - cooldownMs).toISOString();

  // 1. Check Cooldown (Supabase alert_events table if available, fallback to in-memory)
  let isCooldownActive = false;
  if (db) {
    try {
      const { data: recentAlert, error: lookupError } = await db
        .from('alert_events')
        .select('id,created_at')
        .eq('device_id', deviceId)
        .in('email_status', ['pending', 'sent'])
        .gte('created_at', cooldownStarted)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lookupError && recentAlert) {
        isCooldownActive = true;
      }
    } catch {
      // Table may not exist yet, rely on in-memory cooldown
    }
  }

  const lastMemoryAlert = inMemoryCooldowns.get(deviceId);
  if (lastMemoryAlert && (now - lastMemoryAlert) < cooldownMs) {
    isCooldownActive = true;
  }

  if (isCooldownActive) {
    console.log(`[Alert] Cooldown active for ${deviceId}. Next alert allowed after ${ALERT_COOLDOWN_MINUTES} mins.`);
    return { triggered: false, reason: 'cooldown_active' };
  }

  // 2. Attempt to log pending alert in DB if table exists (non-blocking)
  let alertEventId = null;
  if (db && telemetry?.id) {
    try {
      const { data: alertEvent } = await db
        .from('alert_events')
        .insert({
          device_id: deviceId,
          telemetry_id: telemetry.id,
          alert_type: 'CRITICAL',
          risk: risk,
          email_status: 'pending'
        })
        .select('id')
        .single();
      if (alertEvent?.id) alertEventId = alertEvent.id;
    } catch {
      // Table doesn't exist, proceed to send email regardless
    }
  }

  // 3. Format Alert Email
  const device = escapeHtml(deviceId);
  const formattedRisk = risk.toFixed(1);
  const subject = `⚠️ CRITICAL ALERT: ${deviceId} Risk Exceeded ${formattedRisk}%`;
  
  const recipientList = process.env.ALERT_EMAIL
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#162033">
      <div style="background:#b91c1c;color:white;padding:20px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;font-size:24px">RESILIENT AI — Critical Hazard Alert</h1>
      </div>
      <div style="border:1px solid #e5e7eb;padding:22px;border-radius:0 0 12px 12px">
        <p>A critical hazard condition has been detected by <strong>${device}</strong>.</p>
        <h2 style="color:#b91c1c;margin:15px 0">Overall Risk: ${formattedRisk}% (Threshold: ${ALERT_THRESHOLD}%)</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:15px">
          <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px"><strong>Temperature</strong></td><td>${escapeHtml(reading.temperature ?? 'N/A')} °C</td></tr>
          <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px"><strong>Humidity</strong></td><td>${escapeHtml(reading.humidity ?? 'N/A')}%</td></tr>
          <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px"><strong>Gas Density (MQ-2)</strong></td><td>${escapeHtml(reading.gas_raw ?? 'N/A')}</td></tr>
          <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px"><strong>Soil Moisture</strong></td><td>${escapeHtml(reading.soil_percent ?? 'N/A')}%</td></tr>
          <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px"><strong>Object/Water Distance</strong></td><td>${escapeHtml(reading.distance_cm ?? 'N/A')} cm</td></tr>
          <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px"><strong>Fire Hazard Vector</strong></td><td>${escapeHtml(reading.fire_risk ?? 'N/A')}%</td></tr>
          <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px"><strong>Flood Hazard Vector</strong></td><td>${escapeHtml(reading.flood_risk ?? 'N/A')}%</td></tr>
          <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px"><strong>Intrusion Vector</strong></td><td>${escapeHtml(reading.intrusion_risk ?? 'N/A')}%</td></tr>
          <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px"><strong>Edge Anomaly (Z-score)</strong></td><td>${escapeHtml(reading.anomaly_score ?? 'N/A')} σ</td></tr>
          <tr><td style="padding:8px"><strong>Detected At</strong></td><td>${escapeHtml(telemetry?.created_at || new Date().toISOString())}</td></tr>
        </table>
        <p style="margin-top:20px;padding:12px;background:#fef2f2;border-left:4px solid #b91c1c;color:#991b1b">
          <strong>Action Required:</strong> Immediate physical or remote inspection is recommended.
        </p>
      </div>
    </div>`;

  // 4. Send Email via Resend API
  try {
    const fromAddress = process.env.ALERT_FROM || 'RESILIENT AI <onboarding@resend.dev>';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: recipientList,
        subject,
        html
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || `Resend API returned status ${response.status}`);
    }

    inMemoryCooldowns.set(deviceId, now);

    if (db && alertEventId) {
      await db.from('alert_events').update({
        email_status: 'sent',
        email_id: result.id || null
      }).eq('id', alertEventId).catch(() => {});
    }

    console.log(`[Alert] Critical email sent successfully to ${recipientList.join(', ')} (ID: ${result.id})`);
    return { triggered: true, status: 'sent', email_id: result.id, to: recipientList };
  } catch (error) {
    console.error('[Alert] Email delivery failed:', error.message);
    if (db && alertEventId) {
      await db.from('alert_events').update({
        email_status: 'failed',
        error_message: String(error.message || error).slice(0, 500)
      }).eq('id', alertEventId).catch(() => {});
    }
    return { triggered: true, status: 'failed', error: error.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      if (!process.env.DEVICE_API_KEY || req.headers['x-device-key'] !== process.env.DEVICE_API_KEY) {
        return res.status(401).json({ ok: false, error: 'Unauthorized device' });
      }

      let parsedBody = req.body;
      if (typeof parsedBody === 'string') {
        try {
          parsedBody = JSON.parse(parsedBody);
        } catch {
          return res.status(400).json({ ok: false, error: 'Invalid JSON in request body' });
        }
      }
      if (!parsedBody || typeof parsedBody !== 'object') {
        return res.status(400).json({ ok: false, error: 'Request body must be an object' });
      }

      const db = database();
      const row = clean(parsedBody);
      const { data, error } = await db.from('telemetry').insert(row).select('id,created_at').single();
      if (error) throw error;

      let alert;
      try {
        alert = await sendCriticalAlert(db, data, row);
      } catch (alertError) {
        console.error('[Alert] Processing failed:', alertError);
        alert = { triggered: false, reason: 'alert_processing_failed', error: alertError.message };
      }
      return res.status(201).json({ ok: true, ...data, alert });
    }

    if (req.method === 'GET') {
      const limit = Math.min(Math.max(Number(req.query?.limit) || 60, 1), 300);
      const db = database();
      const { data, error } = await db.from('telemetry').select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return res.status(200).json({ ok: true, rows: data || [] });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('[API Error]:', error);
    return res.status(500).json({ ok: false, error: 'Telemetry service unavailable' });
  }
}
