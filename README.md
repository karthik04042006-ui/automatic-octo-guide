# Location-Aware AQI & NASA Weather Explorer

> **NASA POWER** · **CAMS air-quality model** · **FastAPI** · **React + TypeScript + Tailwind CSS**

Search for a city or region to see modeled current US AQI, particulate estimates, and up to five days of air-quality forecasts. NASA POWER near-real-time daily weather is shown as separate location context.

**Important:** NASA POWER does not provide instantaneous ground-level AQI. AQI and its forecast come from the CAMS air-quality model through Open-Meteo; NASA POWER daily weather data can have a reporting delay. These are model-based estimates, not local sensor readings or official health alerts.

---

## Project Structure

```
AQI/
├── backend/
│   ├── main.py                         ← Compatibility entry point and app assembly
│   ├── requirements.txt                ← Python dependencies
│   └── app/
│       ├── configs/settings.py         ← API metadata, environment settings, and constants
│       ├── controllers/                ← HTTP request orchestration
│       ├── middleware/cors.py          ← CORS configuration
│       ├── models/schemas.py           ← Pydantic request/response models
│       ├── routes/                     ← FastAPI endpoint and router definitions
│       ├── services/                   ← Forecasting, location data, and assistant logic
│       └── utils/                      ← Shared HTTP and place-query helpers
└── frontend/
    ├── src/
    │   ├── api/client.ts         ← Axios API client
    │   ├── components/
    │   │   ├── Dashboard.tsx     ← Location search and forecast dashboard
    │   │   ├── LocationAgent.tsx ← Natural-language AI location assistant
    │   ├── types.ts              ← Shared TypeScript interfaces
    │   ├── index.css             ← Tailwind + custom classes
    │   └── main.tsx              ← React entry point
    ├── index.html
    ├── .env                      ← VITE_API_URL=http://localhost:8000
    └── tailwind.config.js
```

---

## ⚙️ Setup & Run

### 1. Backend

```powershell
cd backend

# (optional) create a virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -r requirements.txt

# Start the FastAPI server (hot-reload enabled)
python main.py
# → http://localhost:8000
# → Swagger docs: http://localhost:8000/docs
```

> Location data comes from upstream services and requires an internet connection. Search and forecast failures are shown in the dashboard.

### 2. Frontend

```powershell
cd frontend
npm install          # already done if you followed setup
npm run dev
# → http://localhost:5173
```

Open **http://localhost:5173** — the dashboard loads a Delhi example forecast, and the search box lets you choose another place.

### 3. Optional: enable OpenAI responses

Place lookup and live AQI/weather data work without an AI key. By default, the backend parses the requested location, searches the geocoding service, fetches live data, and returns a guided response. To add OpenAI-generated responses and tool calling, set the key in the backend environment:

```powershell
$env:OPENAI_API_KEY = "your-OpenAI-API-key"
$env:OPENAI_MODEL = "gpt-4o-mini" # optional
cd backend
python main.py
```

Do not put the key in frontend code, `frontend/.env`, or a checked-in file. If the key is absent, the assistant uses its built-in location lookup instead of returning a configuration error.

---

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Liveness check + dataset metadata |
| GET | `/api/places?name=Delhi` | Search for cities and locations |
| GET | `/api/location?...` | Current modeled AQI, five-day forecast, and NASA POWER weather context |
| GET | `/api/weather?latitude=28.65&longitude=77.23` | NASA POWER daily weather context and Open-Meteo hourly/daily weather forecast |
| POST | `/api/agent/chat` | Location assistant (OpenAI tool-calling when configured; built-in lookup otherwise) |
| GET | `/api/historical?days=30` | Legacy synthetic historical dataset |
| GET | `/api/forecast?target=aqi&horizon=7&model_type=prophet` | Legacy Prophet/SARIMAX demo forecast |

The `/api/location` endpoint accepts `latitude`, `longitude`, `name`, `country`, `country_code`, and `place_id` query parameters returned by `/api/places`. It fetches current/hourly US AQI and particulate estimates from Open-Meteo's air-quality service, aggregates hourly values into daily means and ranges, and fetches the latest available NASA POWER daily weather values for the selected coordinates.

The dedicated `/api/weather` endpoint accepts latitude and longitude and returns NASA POWER daily observations together with Open-Meteo hourly and seven-day daily weather forecasts. NASA POWER daily observations can lag; use the dates and parameter values in the response to determine which observations are available.

### Query Parameters for `/api/forecast`

| Param | Options | Default |
|-------|---------|---------|
| `target` | `aqi` · `temperature` · `humidity` | `aqi` |
| `horizon` | `7` · `14` | `7` |
| `model_type` | `prophet` · `sarimax` | `prophet` |

---

## 🌍 Location Data Sources

### Current AQI and forecast
- Open-Meteo's air-quality API serves modeled current US AQI, PM2.5, PM10, and hourly CAMS forecast values.
- The dashboard aggregates available hourly forecast values into a maximum of five local-calendar-day averages. The displayed range is the minimum-to-maximum hourly model value, not a confidence interval.
- AQI values are model estimates and may not match a nearby regulatory monitor. Forecast availability and freshness depend on the upstream model.

### NASA POWER weather context
- The NASA POWER Daily Point API provides the latest available daily temperature, humidity, wind speed, and precipitation for the selected coordinates.
- Daily data is near-real-time but may lag. The dashboard labels its observation date and never presents it as instantaneous AQI.
- If NASA POWER is temporarily unavailable, the AQI forecast still loads and the dashboard shows the NASA data error separately.
- The dedicated weather forecast panel keeps NASA POWER observation dates separate from Open-Meteo's forecast dates and displays the latter as a seven-day outlook.

### Legacy model demo endpoints
- The original Prophet and SARIMAX endpoints remain available for the synthetic demonstration dataset; the location dashboard does not use those synthetic forecasts.

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | FastAPI + Uvicorn |
| Location search | Open-Meteo Geocoding API |
| AQI forecasts | Open-Meteo Air Quality API (CAMS) |
| NASA weather | NASA POWER Daily Point API |
| Location assistant | OpenAI tool-calling API |
| ML — Time Series | Facebook Prophet, statsmodels SARIMAX |
| Data | pandas, numpy, scikit-learn |
| Frontend framework | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v3 (dark mode) |
| Charts | Recharts (ComposedChart) |
| Icons | Lucide React |
| HTTP client | Axios |
