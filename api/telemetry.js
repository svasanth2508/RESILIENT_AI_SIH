import { createClient } from '@supabase/supabase-js';

const fields = ['device_id','sequence_number','device_uptime_ms','temperature','humidity','gas_raw','soil_raw','soil_percent','ldr_detected','pir_motion','ir_obstacle','distance_cm','anomaly_score','fire_risk','flood_risk','intrusion_risk','overall_risk','risk_level','failed_transmissions'];
const numeric = new Set(['sequence_number','device_uptime_ms','temperature','humidity','gas_raw','soil_raw','soil_percent','distance_cm','anomaly_score','fire_risk','flood_risk','intrusion_risk','overall_risk','risk_level','failed_transmissions']);
const boolean = new Set(['ldr_detected','pir_motion','ir_obstacle']);

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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const db = database();
    if (req.method === 'POST') {
      if (!process.env.DEVICE_API_KEY || req.headers['x-device-key'] !== process.env.DEVICE_API_KEY) return res.status(401).json({ ok: false, error: 'Unauthorized device' });
      const row = clean(typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}));
      const { data, error } = await db.from('telemetry').insert(row).select('id,created_at').single();
      if (error) throw error;
      return res.status(201).json({ ok: true, ...data });
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
