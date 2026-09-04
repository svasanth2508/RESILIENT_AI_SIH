# Resilient AI SIH Dashboard

Vercel-hosted dashboard and protected telemetry API for the ESP32 Edge-AI prototype.

## Deploy

1. Upload all files and folders at this repository root to GitHub.
2. Import the repository in Vercel.
3. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `DEVICE_API_KEY` under Vercel Project Settings > Environment Variables.
4. Redeploy. Never commit real keys to GitHub.

Node 2 sends JSON with HTTP POST to `https://YOUR-DOMAIN.vercel.app/api/telemetry` and header `x-device-key: YOUR_DEVICE_API_KEY`.
