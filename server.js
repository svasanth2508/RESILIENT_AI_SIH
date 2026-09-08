import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Attempt to load environment variables from .env or .env.local
for (const envFile of ['.env.local', '.env']) {
  const envPath = path.join(__dirname, envFile);
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
      console.log(`[Config] Loaded environment variables from ${envFile}`);
      break;
    } catch (e) {
      console.warn(`[Config] Failed loading ${envFile}:`, e.message);
    }
  }
}

// In-memory mock telemetry store for local development when Supabase is not configured
const mockTelemetry = [];

// Seed initial mock data so dashboard is immediately functional locally
function seedMockData() {
  const now = Date.now();
  for (let i = 20; i >= 0; i--) {
    const time = new Date(now - i * 3000).toISOString();
    const temp = 27.5 + Math.sin(i * 0.4) * 3;
    const humidity = 55.0 + Math.cos(i * 0.4) * 8;
    const gas = 320 + Math.floor(Math.random() * 40);
    const soil = 45 + Math.floor(Math.random() * 10);
    const dist = 35 + Math.floor(Math.random() * 5);
    const fireRisk = Math.max(5, Math.min(65, (gas - 280) * 0.4 + (temp - 25) * 1.5));
    const floodRisk = Math.max(5, Math.min(50, (soil - 30) * 1.2));
    const intrusionRisk = 0;
    const overallRisk = Math.max(fireRisk, floodRisk, intrusionRisk);
    
    mockTelemetry.push({
      id: 21 - i,
      created_at: time,
      device_id: 'NODE_01',
      sequence_number: 100 + (20 - i),
      device_uptime_ms: 60000 + (20 - i) * 3000,
      temperature: Number(temp.toFixed(1)),
      humidity: Number(humidity.toFixed(1)),
      gas_raw: gas,
      soil_raw: 2100,
      soil_percent: soil,
      ldr_detected: false,
      pir_motion: false,
      ir_obstacle: false,
      distance_cm: dist,
      anomaly_score: 0.42,
      fire_risk: Number(fireRisk.toFixed(1)),
      flood_risk: Number(floodRisk.toFixed(1)),
      intrusion_risk: intrusionRisk,
      overall_risk: Number(overallRisk.toFixed(1)),
      risk_level: overallRisk >= 75 ? 3 : overallRisk >= 50 ? 2 : overallRisk >= 25 ? 1 : 0,
      ml_confidence: Math.min(99, Math.round(55 + overallRisk * 0.35 + 0.42 * 2.5)),
      failed_transmissions: 0
    });
  }
}

seedMockData();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
let telemetryHandler = null;

if (hasSupabase) {
  try {
    const mod = await import('./api/telemetry.js');
    telemetryHandler = mod.default;
    console.log('[Database] Connected to remote Supabase via api/telemetry.js');
  } catch (err) {
    console.warn('[Database] Could not load api/telemetry.js with Supabase, using mock fallback:', err.message);
  }
} else {
  console.log('[Dev Server] Supabase credentials not found in .env; using local in-memory telemetry simulation.');
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  // Handle /api/telemetry
  if (pathname === '/api/telemetry') {
    if (telemetryHandler) {
      // Mock Next/Vercel req/res adapter
      const query = Object.fromEntries(urlObj.searchParams);
      req.query = query;
      
      let bodyData = '';
      req.on('data', chunk => { bodyData += chunk; });
      req.on('end', async () => {
        req.body = bodyData;
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        res.json = (data) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };
        try {
          await telemetryHandler(req, res);
        } catch (e) {
          console.error('[API Error]:', e);
          res.status(500).json({ ok: false, error: 'Internal server error' });
        }
      });
      return;
    }

    // In-memory fallback
    if (req.method === 'GET') {
      const limit = Math.min(Math.max(Number(urlObj.searchParams.get('limit')) || 60, 1), 300);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      // Return newest first
      const rows = mockTelemetry.slice().reverse().slice(0, limit);
      res.end(JSON.stringify({ ok: true, rows, mode: 'local_simulation' }));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const newRow = {
            id: mockTelemetry.length + 1,
            created_at: new Date().toISOString(),
            device_id: parsed.device_id || 'NODE_01',
            sequence_number: Number(parsed.sequence_number) || (mockTelemetry.length + 1),
            device_uptime_ms: Number(parsed.device_uptime_ms) || Date.now(),
            temperature: parsed.temperature ?? 28.0,
            humidity: parsed.humidity ?? 50.0,
            gas_raw: parsed.gas_raw ?? 300,
            soil_raw: parsed.soil_raw ?? 2000,
            soil_percent: parsed.soil_percent ?? 50,
            ldr_detected: Boolean(parsed.ldr_detected),
            pir_motion: Boolean(parsed.pir_motion),
            ir_obstacle: Boolean(parsed.ir_obstacle),
            distance_cm: parsed.distance_cm ?? 40.0,
            anomaly_score: parsed.anomaly_score ?? 0.1,
            fire_risk: parsed.fire_risk ?? 10.0,
            flood_risk: parsed.flood_risk ?? 10.0,
            intrusion_risk: parsed.intrusion_risk ?? 0.0,
            overall_risk: parsed.overall_risk ?? 10.0,
            risk_level: parsed.risk_level ?? 0,
            ml_confidence: parsed.ml_confidence !== undefined ? Number(parsed.ml_confidence) : undefined,
            failed_transmissions: Number(parsed.failed_transmissions) || 0
          };
          mockTelemetry.push(newRow);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, id: newRow.id, created_at: newRow.created_at }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  // Static file serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  
  // Security check: ensure filePath stays inside __dirname
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 RESILIENT AI Dashboard running at:`);
  console.log(`   ➜ Local:   http://localhost:${PORT}`);
  console.log(`   ➜ Network: http://127.0.0.1:${PORT}`);
  console.log(`   ➜ API:     http://localhost:${PORT}/api/telemetry`);
  console.log(`======================================================\n`);
});
