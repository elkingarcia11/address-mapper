# Address Mapper

## Overview

Address Mapper is a web application for working with address lists: extract addresses from unstructured text, geocodes and plot them on a map, and optimize driving routes across one or more vehicles. Users provide their own API keys through the browser — nothing is stored on the server.

The interface is organized as a full-screen tabbed workflow. Each tab handles one step, and results flow forward (for example, converted addresses are copied into the Plot tab automatically).

## Features

- **Convert Blob to Addresses** — Use OpenAI to extract structured addresses from pasted text, normalized to a consistent format.
- **Plot Addresses on Map** — Geocode a list of addresses and display them as interactive markers on Google Maps.
- **Map View** — Dedicated map tab that fills the available screen space; markers show the sanitized address for each stop.
- **Multi-route optimization** — Split stops across multiple routes from a shared start/end hub, with manual stop counts per route or automatic balancing by driving distance.
- **Optimized Route Results** — View each route with numbered stop order, per-route distance, and total distance.
- **Sanitized address format** — Addresses use `street address, city, ST ZIP`. ZIP is optional when geocoding can resolve the location (example without ZIP: `1101 Forest Ave, Bronx, NY`).
- **Input validation** — Plot and Optimize reject malformed addresses and list lines that need fixing.
- **Per-tab API keys** — Enter only the keys needed for the tab you are using. Keys can be shown/hidden with the eye toggle.
- **Browser-side settings cache** — API keys and optimize start/end fields are saved in `localStorage` so you do not have to re-enter them on every visit.
- **Tab badges** — Visual indicators when a tab has new results waiting (Plot, Map View, Optimized Route Results).
- **Copy extracted addresses** — Copy the clean address list directly from the Convert tab.

## Tabs

| Tab | Purpose | API keys required |
| --- | --- | --- |
| Convert Blob to Addresses | Extract addresses from unstructured text | OpenAI |
| Plot Addresses on Map | Geocode and plot addresses | Google Maps Geocoding, Google Maps JavaScript |
| Map View | View plotted markers on a full-height map | (uses keys from Plot tab) |
| Optimize Route | Split and optimize stops across one or more routes | Google Maps Geocoding, OpenRouteService |
| Optimized Route Results | View optimized routes and total distance | (uses keys from Optimize tab) |

The Google Maps Geocoding key entered on the Plot or Optimize tab is kept in sync between those two tabs.

## Address format

All addresses in the app use this format:

```text
street address, city, ST ZIP
```

Examples:

- `2249 Washington Ave, Bronx, NY 10456`
- `1101 Forest Ave, Bronx, NY` (ZIP optional)

During conversion, the app removes apartment numbers, unit numbers, suite numbers, floor/building details, country names, and list numbering. Plot and Optimize require input that already matches this format. After plotting or optimizing, results are written back in the same standardized form.

| Step | Format enforcement |
| --- | --- |
| Convert Blob to Addresses | Extracts and normalizes addresses automatically |
| Plot Addresses on Map | Requires sanitized input; validates before geocoding |
| Optimize Route | Requires sanitized input; validates before optimizing |
| Optimized Route Results | Shows numbered stop order per route (`1.`, `2.`, `3.`, …) |

## Requirements

- Python 3.9+
- Two Google Maps API keys: one with Geocoding enabled and one with Maps JavaScript enabled
- An OpenAI API key
- An OpenRouteService API key (for route optimization)
- Flask and dependencies listed in `requirements.txt` (including `ortools` and `openrouteservice`)

## API Key Security

The application has been designed with security in mind for handling user-provided API keys:

- **No Authentication Required**: The login system has been removed for simplified access.
- **User-Provided API Keys**: Users input their own API keys through secure password fields in the frontend.
- **Secure Transmission**: API keys are transmitted securely via HTTPS with proper security headers.
- **No Server Storage**: API keys are not stored on the server — they are only used for the duration of each request.
- **Browser localStorage**: API keys and optimize start/end fields can be cached in the browser on your device for convenience. Do not use this on shared machines.
- **Input Validation**: API keys are validated for proper format before being used.
- **CORS Protection**: Cross-Origin Resource Sharing is properly configured for security.

## Setup and Usage

1. Clone or download the repository.
2. Create and activate a virtual environment (recommended):
   ```sh
   python -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
4. Run the Python server:
   ```sh
   python app.py
   ```
5. Open `http://127.0.0.1:5001/` in your browser.
6. Enter the API keys on the tab where you need them (expand **API Configuration** on Optimize):
   - **Convert Blob to Addresses**: OpenAI API key
   - **Plot Addresses on Map**: Google Maps Geocoding and JavaScript API keys
   - **Optimize Route**: Google Maps Geocoding and OpenRouteService API keys

Saved API keys and optimize start/end values reload automatically from browser `localStorage` on your next visit.

### Convert addresses from text

1. Open the **Convert Blob to Addresses** tab.
2. Paste unstructured text and click **Convert**.
3. Extracted addresses appear in the output area with line numbers on the right for easy reference. The clean address list is copied into the **Plot Addresses on Map** tab automatically.
4. Use **Copy** to copy the sanitized list, or switch to the Plot tab to continue.

### Plot addresses on a map

1. Open the **Plot Addresses on Map** tab (or use addresses from the Convert step).
2. Enter one sanitized address per line and click **Plot**.
3. The app validates each line, geocodes the addresses, and switches to **Map View**, where markers appear on a full-height map.
4. Click a marker to see the sanitized address. After plotting, the address list is updated with geocoded, standardized formatting.

### Optimize routes

1. Open the **Optimize Route** tab and expand **API Configuration** if needed.
2. Set **Start** and **End**. Every route begins and ends at these locations (use **End same as start** for a depot-style hub).
3. Enter **Stops** — one address per line. These are the deliveries/visits to split across routes.
4. Choose how stops are assigned:
   - **Specify stops per route** — Set the number of routes and how many stops each route should get.
   - **Balance routes by distance** — Set only the number of routes; the optimizer splits stops to keep driving distance per route roughly even.
5. Click **Optimize**.
6. Results appear on the **Optimized Route Results** tab, including:
   - Start and end for each route
   - Numbered stop order per route
   - Per-route and total distance in miles and meters

#### Optimize API request (multi-route)

```json
{
  "start_address": "2249 Washington Ave, Bronx, NY 10456",
  "end_address": "2249 Washington Ave, Bronx, NY 10456",
  "stops": ["100 Grand Concourse, Bronx, NY 10451"],
  "split_mode": "manual",
  "route_capacities": [5, 5],
  "google_maps_geo_api_key": "...",
  "ors_api_key": "..."
}
```

For balanced splitting, send `"split_mode": "balanced_distance"` and `"num_routes": 3` instead of `route_capacities`.

## Docker Testing Locally

To test the application using Docker:

1. Build the Docker image:

   ```sh
   docker build -t address-mapper .
   ```

2. Run the Docker container:

   ```sh
   docker run -p 8080:80 address-mapper
   ```

3. Visit `http://localhost:8080` in your browser to access the application.

The Docker container uses Gunicorn as the WSGI server and exposes the application on port 80 internally, which is mapped to port 8080 on your local machine.

## API Key Requirements

### Google Maps API Keys

- **Geocoding API Key**: Must have the Geocoding API enabled
- **JavaScript API Key**: Must have the Maps JavaScript API enabled
- Both keys should be restricted to your domain/IP for security

### OpenAI API Key

- Must have access to GPT models (specifically gpt-4o-mini)
- Should start with `sk-` and be properly formatted

### OpenRouteService API Key

- Required for route optimization (driving distance matrix)
- Sign up at [openrouteservice.org](https://openrouteservice.org/) to obtain a key
- Used to calculate distances between stops; OR-Tools handles stop assignment and reordering

## Set up Continuous Integration using Google Cloud's Cloud Run

1. Connect your repository and set up the Dockerfile as the build configuration type.
2. Deploy your application — no additional environment variables or secrets are needed since users provide their own API keys.
3. Ensure your deployment uses HTTPS for secure API key transmission.

## ChatGPT Integration

This application uses OpenAI's GPT model to extract addresses from blocks of text. When you paste a block of text and provide your OpenAI API key, the GPT model processes the text and returns the addresses found within it. The extracted addresses are displayed in the Convert tab output area, copied to the Plot tab input, and can be geocoded and visualized on the map from there.

## Security Features

- **HTTPS Enforcement**: Strict Transport Security headers ensure secure transmission
- **Content Security Policy**: Restricts resource loading to trusted domains
- **Input Validation**: API keys are validated for proper format
- **No Server Persistence**: API keys are not stored or logged on the server
- **Browser localStorage**: Optional client-side caching of API keys and optimize endpoints
- **CORS Configuration**: Properly configured Cross-Origin Resource Sharing
- **XSS Protection**: Headers prevent cross-site scripting attacks

## Notes

- API keys are transmitted securely but users should still be cautious about using them on untrusted networks.
- Ensure your Google Maps and OpenRouteService API keys are properly restricted to prevent unauthorized usage.
- The application validates API key formats but cannot guarantee their validity until they are used.
- Make sure to use HTTPS in production environments for maximum security.
- Multi-route optimization requires at least one stop plus valid start and end addresses. Balanced mode requires at least as many stops as routes.
- Multi-route optimization currently requires the same start and end address for every route.
- Map markers and optimized route results use the sanitized address format, not raw pasted text.
- Invalid addresses on the Plot or Optimize tabs are rejected with a list of lines that need fixing.

## License

This project is open-source and available for use under the MIT License.
