# RESILIENT AI

### Edge-AI Environmental Intelligence and Multi-Hop Emergency Monitoring Network

<p align="center">
  <strong>Smart India Hackathon Prototype</strong><br>
  An intelligent, low-cost and resilient environmental monitoring network built using ESP32, ESP-NOW, Edge AI, Supabase and Vercel.
</p>

<p align="center">
  <a href="https://resilient-ai-sih.vercel.app">
    <img src="https://img.shields.io/badge/Live_Dashboard-Open-22d3c5?style=for-the-badge">
  </a>
  <img src="https://img.shields.io/badge/Platform-ESP32-ef4444?style=for-the-badge">
  <img src="https://img.shields.io/badge/Communication-ESP--NOW-3b82f6?style=for-the-badge">
  <img src="https://img.shields.io/badge/Cloud-Supabase-3ecf8e?style=for-the-badge">
  <img src="https://img.shields.io/badge/Deployment-Vercel-black?style=for-the-badge">
</p>

---

## Live Dashboard

**Dashboard:** https://resilient-ai-sih.vercel.app

**Telemetry API:** https://resilient-ai-sih.vercel.app/api/telemetry

The public dashboard provides live environmental readings, Edge-AI risk scores, node status, hazard indicators and historical telemetry charts.

---

## Project Overview

RESILIENT AI is an ESP32-based environmental intelligence network designed to monitor hazardous conditions in locations where continuous internet connectivity and conventional monitoring infrastructure may be unreliable.

The system combines multiple environmental and proximity sensors with lightweight Edge-AI processing. Sensor readings are analysed directly on Node 1 before being transmitted through ESP-NOW.

Node 2 acts as an internet gateway. It receives the Edge-AI telemetry and securely uploads it through a protected Vercel API to a Supabase database. The results are displayed through a responsive, publicly accessible dashboard.

An optional relay node can be positioned between Node 1 and Node 2 to extend the communication range and overcome walls, distance and other signal obstructions.

---

## Problem Statement

Conventional environmental monitoring systems often depend on:

* Continuous internet access
* Centralised cloud processing
* Expensive communication infrastructure
* Static sensor thresholds
* Direct connectivity between every sensor and gateway
* Continuous manual supervision

These limitations make them less suitable for rural areas, disaster-prone locations, industrial zones, agricultural fields and temporary emergency-monitoring deployments.

RESILIENT AI addresses these limitations through local intelligence, multi-sensor analysis, low-latency ESP-NOW communication and cloud-connected visual monitoring.

---

## Proposed Solution

The prototype uses a distributed three-layer architecture:

```text
Node 1: Sensors + Edge-AI Processing
                  │
                  │ ESP-NOW
                  ▼
Node A: Optional Store-and-Forward Relay
                  │
                  │ ESP-NOW
                  ▼
Node 2: Wi-Fi and Cloud Gateway
                  │
                  │ Secure HTTPS
                  ▼
Vercel Telemetry API
                  │
                  ▼
Supabase Database
                  │
                  ▼
Public Web Dashboard
```

Node 1 remains responsible for sensing and risk evaluation. Therefore, basic hazard detection and local alarms can continue even if internet access becomes unavailable.

---

## Current Prototype Architecture

### Node 1 — Edge Intelligence Sensor Node

Node 1 performs the following operations:

* Reads all connected sensors
* Learns the normal environmental baseline
* Calculates statistical deviations
* Performs multi-sensor risk fusion
* Calculates fire, flood and intrusion risks
* Generates a composite risk score
* Controls local LED indicators
* Activates the buzzer during critical conditions
* Sends processed telemetry through ESP-NOW

### Node A — Optional Relay Node

The proposed relay node:

* Receives packets from Node 1
* Validates packet size and signature
* Prevents duplicate forwarding
* Preserves the original sensor-node identity
* Forwards valid packets to Node 2
* Extends ESP-NOW communication range
* Requires no sensors or internet connection

### Node 2 — Cloud Gateway

Node 2:

* Connects to a 2.4 GHz Wi-Fi network or mobile hotspot
* Receives Edge-AI telemetry through ESP-NOW
* Converts the telemetry packet into JSON
* Authenticates using a device API key
* Uploads data through HTTPS
* Automatically reconnects after Wi-Fi interruptions
* Displays gateway and upload status through Serial Monitor

### Cloud Platform

The cloud layer contains:

* A Vercel serverless telemetry API
* Device-key authentication
* Server-side Supabase credentials
* A PostgreSQL telemetry database
* Time-stamped environmental history
* A publicly deployed monitoring dashboard

---

## Hardware Components

| Component            | Purpose                                     |
| -------------------- | ------------------------------------------- |
| ESP32 Node 1         | Sensor acquisition and Edge-AI processing   |
| ESP32 Node 2         | ESP-NOW receiver and cloud gateway          |
| ESP32 Node A         | Optional communication relay                |
| DHT11                | Temperature and humidity measurement        |
| MQ-2                 | Gas and smoke-level detection               |
| Soil-moisture sensor | Ground-moisture and saturation monitoring   |
| LDR module           | Light-event detection                       |
| HC-SR04              | Distance and water/object-level measurement |
| PIR sensor           | Motion detection                            |
| IR obstacle sensor   | Nearby object detection                     |
| Active buzzer module | Critical local alarm                        |
| Red LED              | Critical-condition indicator                |
| Yellow LED           | Warning/elevated-condition indicator        |
| Green LED            | Normal-condition indicator                  |

---

## Node 1 Pin Connections

| Component            | Module pin             | ESP32 connection                |
| -------------------- | ---------------------- | ------------------------------- |
| MQ-2                 | AO                     | GPIO 34                         |
| LDR module           | DO                     | GPIO 35                         |
| Soil-moisture sensor | AO                     | GPIO 32                         |
| DHT11                | DATA                   | GPIO 27                         |
| HC-SR04              | TRIG                   | GPIO 12                         |
| HC-SR04              | ECHO                   | GPIO 13 through voltage divider |
| PIR sensor           | OUT                    | GPIO 26                         |
| IR obstacle sensor   | OUT                    | GPIO 25                         |
| Active buzzer        | SIGNAL                 | GPIO 18                         |
| Red LED              | Anode through resistor | GPIO 2                          |
| Yellow LED           | Anode through resistor | GPIO 5                          |
| Green LED            | Anode through resistor | GPIO 4                          |

All modules and ESP32 boards must share a common ground.

> **Electrical safety:** The HC-SR04 Echo output is approximately 5 V. It must be reduced to approximately 3.3 V using a voltage divider before connecting it to GPIO 13.

> Check the MQ-2 module’s analog-output voltage. Do not apply more than 3.3 V to an ESP32 ADC pin.

---

## Edge-AI Engine

The prototype does not depend only on basic fixed thresholds. It combines adaptive statistical modelling with multi-sensor risk fusion.

### Adaptive Baseline Learning

During startup, Node 1 observes normal environmental readings and develops running models for:

* Temperature
* Humidity
* Gas level
* Soil moisture

The baseline gradually adapts to normal environmental variation.

### Multivariate Anomaly Detection

The system calculates the deviation of each sensor from its learned baseline using standardised statistical scores.

The individual deviations are combined into a multivariate anomaly score:

```text
Anomaly Score =
√(Temperature Z² + Humidity Z² + Gas Z² + Soil Z²)
```

This helps identify unusual environmental combinations even when one sensor alone has not crossed a fixed limit.

### Multi-Sensor Risk Fusion

The system calculates separate continuous risks:

* Fire risk
* Flood risk
* Intrusion risk
* Overall environmental risk

Examples:

* Increased gas combined with increased temperature produces a stronger fire warning.
* High soil saturation combined with high humidity produces a stronger flood warning.
* PIR motion combined with IR detection and short ultrasonic distance produces a stronger intrusion warning.

### Risk Levels

| Overall risk | Classification | Indicator | Buzzer |
| -----------: | -------------- | --------- | ------ |
|        0–24% | Normal         | Green     | OFF    |
|       25–49% | Observe        | Yellow    | OFF    |
|       50–74% | Elevated       | Yellow    | OFF    |
|      75–100% | Critical       | Red       | ON     |

The active-LOW buzzer automatically activates only during critical conditions.

---

## Implemented Features

### Environmental Monitoring

* Temperature monitoring
* Humidity monitoring
* Gas and smoke sensing
* Soil-moisture monitoring
* Light-event detection
* Distance measurement
* Motion detection
* Obstacle detection

### Edge Intelligence

* Adaptive environmental baseline
* Continuous anomaly scoring
* Nonlinear risk calculation
* Multi-sensor correlation
* Fire-risk estimation
* Flood-risk estimation
* Intrusion-risk estimation
* Composite risk index
* Protection against baseline learning during strong anomalies

### Local Safety System

* Green normal-status indicator
* Yellow warning-status indicator
* Red critical-status indicator
* Automatic critical buzzer
* Immediate local response without cloud dependency

### Communication

* Low-latency ESP-NOW transmission
* Packet signature validation
* Matching packed telemetry structures
* Configurable communication channel
* Peer-to-peer MAC addressing
* Transmission-failure tracking
* Optional intermediate relay architecture

### Cloud Integration

* Secure HTTPS telemetry upload
* Vercel serverless API
* Device API-key authentication
* Supabase PostgreSQL storage
* Protected service-role credentials
* Historical, time-stamped sensor data
* Wi-Fi reconnection handling

### Dashboard

* Publicly accessible deployment
* Responsive desktop and mobile interface
* Node online/offline status
* Cloud-link status
* Composite risk display
* AI confidence display
* Live environmental readings
* Fire, flood and intrusion vectors
* Historical hazard chart
* Motion and obstacle status
* Packet number and transmission diagnostics
* Automatic data refresh
* Empty, online, offline and error states

---

## Dashboard Data Fields

Each telemetry record contains:

```json
{
  "device_id": "NODE_01",
  "sequence_number": 1,
  "device_uptime_ms": 1000,
  "temperature": 32.5,
  "humidity": 58.2,
  "gas_raw": 420,
  "soil_raw": 2300,
  "soil_percent": 52,
  "ldr_detected": false,
  "pir_motion": false,
  "ir_obstacle": false,
  "distance_cm": 48.6,
  "anomaly_score": 0.82,
  "fire_risk": 12.4,
  "flood_risk": 21.7,
  "intrusion_risk": 0,
  "overall_risk": 21.7,
  "risk_level": 0,
  "failed_transmissions": 0
}
```

---

## Repository Structure

```text
RESILIENT_AI_SIH/
├── api/
│   └── telemetry.js
├── app.js
├── index.html
├── styles.css
├── package.json
├── vercel.json
├── .env.example
├── .gitignore
└── README.md
```

The Arduino firmware can be maintained in an additional structure:

```text
firmware/
├── node1_edge_sensor/
│   └── Node1_EdgeAI_Sensor.ino
├── nodeA_relay/
│   └── NodeA_ESPNow_Relay.ino
└── node2_cloud_gateway/
    └── Node2_Cloud_Gateway.ino
```

---

## Cloud Configuration

The Vercel project requires the following protected environment variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DEVICE_API_KEY
```

Never commit the real values to GitHub.

The `.env.example` file must contain placeholders only.

---

## Supabase Database

The `telemetry` table stores:

* Sensor readings
* Edge-AI results
* Risk vectors
* Detection states
* Device identity
* Packet sequence
* Device uptime
* Transmission failures
* Server-generated timestamps

Row Level Security is enabled. Database writes are performed through the protected server-side Vercel API.

---

## Installation and Operation

### 1. Configure the cloud

1. Create a Supabase project.
2. Create the `telemetry` table.
3. Deploy the repository through Vercel.
4. Add the required environment variables.
5. Confirm that `/api/telemetry` returns:

```json
{
  "ok": true,
  "rows": []
}
```

### 2. Configure Node 2

1. Enter the 2.4 GHz Wi-Fi name and password.
2. Enter the Vercel API URL.
3. Enter the device API key.
4. Upload the gateway firmware.
5. Open Serial Monitor at 115200 baud.
6. Record Node 2’s STA MAC address and Wi-Fi channel.

Current prototype configuration:

```text
Node 2 STA MAC: 14:08:08:A4:D5:90
ESP-NOW channel: 11
```

The Wi-Fi channel may change if the hotspot or router changes.

### 3. Configure Node 1

Set Node 2’s MAC and current channel:

```cpp
uint8_t NODE2_MAC[] = {
  0x14, 0x08, 0x08, 0xA4, 0xD5, 0x90
};

const uint8_t ESPNOW_CHANNEL = 11;
```

Install:

```text
DHT sensor library by Adafruit
Adafruit Unified Sensor
```

Upload the firmware and allow the sensors to remain in normal conditions during the initial baseline-learning period.

### 4. Verify communication

Node 1 should display:

```text
[ESP-NOW] Node 2 peer registered
[Node 1] Packet queued
```

Node 2 should display:

```text
[ESP-NOW] Node 1 packet received
[Cloud] HTTP 201
```

The dashboard will then change from:

```text
Awaiting first telemetry packet
```

to the live monitoring interface.

---

## Future Feature-Integration Ideas

### Resilient Networking

* ESP-NOW store-and-forward relay node
* Automatic relay discovery
* Multi-relay mesh routing
* Dynamic route selection
* Packet hop-count monitoring
* Duplicate-packet rejection
* Delivery acknowledgement
* Automatic channel synchronisation
* Offline packet buffering
* Gateway failover
* Multiple cloud gateways

### Advanced Edge AI

* TinyML environmental classification
* TensorFlow Lite Micro models
* Sensor-drift detection
* Sensor-failure identification
* Confidence-aware predictions
* Time-series forecasting
* Multi-node anomaly correlation
* Automatic seasonal-baseline adjustment
* Explainable hazard decisions
* Federated baseline learning
* Model version tracking
* Over-the-air model updates

### Emergency Response

* SMS and email notifications
* Telegram or WhatsApp alerts
* GPS location integration
* Emergency escalation workflow
* Local siren control
* Relay switching for pumps or ventilation
* Emergency contact management
* Acknowledgement and response tracking
* Automatic incident-report generation
* QR-based field-node identification

### Dashboard Enhancements

* Interactive geographic node map
* Multiple-node comparison
* Historical date filtering
* Downloadable CSV reports
* PDF incident reports
* Sensor calibration panel
* Alert timeline
* Maintenance reminders
* Device battery monitoring
* Signal-strength visualisation
* Role-based administrator login
* Dark and light themes
* Progressive Web App support
* Mobile push notifications
* Predictive-risk timeline

### Hardware Enhancements

* Solar charging
* Battery backup
* Waterproof enclosure
* H₂S, CO and CH₄-specific sensors
* Rainfall sensor
* Water-flow sensor
* Barometric-pressure sensor
* GPS module
* LoRaWAN option for long-range deployment
* SD-card backup storage
* Watchdog and brownout recovery
* Tamper detection
* Battery-voltage monitoring

### Security Enhancements

* Per-device API keys
* ESP-NOW encryption
* API rate limiting
* Packet replay prevention
* Signed telemetry payloads
* Key rotation
* Device registration
* Audit logging
* Administrator authentication
* Restricted dashboard access

---

## Potential Applications

* Flood-prone locations
* Agricultural fields
* Forest-fire monitoring
* Industrial safety
* Smart campuses
* Warehouses
* Drain and manhole monitoring
* Disaster-response areas
* Remote rural infrastructure
* Temporary emergency deployments

---

## Innovation Highlights

1. **Local intelligence:** Risk assessment takes place directly on the sensor node.
2. **Multi-sensor fusion:** Hazards are evaluated using correlated sensor behaviour.
3. **Resilient communication:** ESP-NOW operates independently of internet connectivity.
4. **Optional relay extension:** Communication can be extended without adding internet infrastructure.
5. **Local and remote alerts:** The system provides physical alarms and a public cloud dashboard.
6. **Adaptive baseline:** The model responds to environmental changes rather than relying entirely on static limits.
7. **Low-cost architecture:** The prototype uses commonly available ESP32 boards and sensors.
8. **Modular expansion:** Additional sensing, relay and gateway nodes can be integrated.

---

## Important Prototype Limitations

This is a functional academic prototype and not a certified industrial safety system.

* MQ-2 is a general-purpose gas/smoke sensor and cannot independently identify a specific gas.
* Sensor readings require calibration.
* Low-cost soil-moisture probes may corrode over time.
* ESP-NOW range depends on walls, interference, antenna orientation and power conditions.
* Mobile-hotspot channels may change after restarting.
* HTTPS certificate verification is simplified in the prototype gateway.
* Environmental risk values are decision-support indicators, not official emergency declarations.
* Certified sensors and field testing are required before real safety deployment.

---

## Team and Collaborators

### Project Owner

* [Vasanth — @svasanth2508](https://github.com/svasanth2508)

### Collaborators

* [Sree Dharani C — @csreedharani90-boop](https://github.com/csreedharani90-boop) — Invitation pending
* [Thamarai Selvi D — @thamaraiselvid14-design](https://github.com/thamaraiselvid14-design)
* [Thirumurgan S — @thirumurugansk-coder](https://github.com/thirumurugansk-coder)
* [Vigneshwar — @VIGNESHWAR0221](https://github.com/VIGNESHWAR0221)
* [Vishnuharan — @Vishnuharan008](https://github.com/Vishnuharan008)

---

## Collaboration Workflow

Contributors should:

1. Pull the latest `main` branch.
2. Create a separate feature branch.
3. Make and test one focused change.
4. Avoid committing passwords or API keys.
5. Open a pull request.
6. Describe the hardware or software change clearly.
7. Wait for review before merging into `main`.

Example:

```bash
git checkout -b feature/relay-node
git add .
git commit -m "Add ESP-NOW relay-node firmware"
git push -u origin feature/relay-node
```

---

## Repository

https://github.com/svasanth2508/RESILIENT_AI_SIH

---

## Project Status

```text
Cloud database           ✅ Completed
Vercel API               ✅ Completed
Public dashboard         ✅ Completed
Node 2 Wi-Fi connection  ✅ Completed
Node 2 ESP-NOW receiver  ✅ Completed
Node 1 sensor firmware   ✅ Developed
Edge-AI risk engine      ✅ Developed
Local LED/buzzer alerts  ✅ Developed
Hardware calibration     🔄 In progress
End-to-end live testing  🔄 In progress
Node A relay             📋 Planned
Multi-node deployment    📋 Planned
```

---

<p align="center">
  <strong>RESILIENT AI</strong><br>
  Sense locally. Decide intelligently. Communicate resiliently.
</p>
