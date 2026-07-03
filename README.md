# Address Mapper

## Overview

Address Mapper is a web application for working with address lists: extract addresses from unstructured text, geocode and plot them on a map, and optimize driving routes between stops. Users provide their own API keys through the browser — nothing is stored on the server.

The interface is organized as a full-screen tabbed workflow. Each tab handles one step, and results flow forward (for example, converted addresses are copied into the Plot tab automatically).

## Features

- **Convert Blob to Addresses** — Use OpenAI to extract structured addresses from pasted text, normalized to a consistent format.
- **Plot Addresses on Map** — Geocode a list of addresses and display them as interactive markers on Google Maps.
- **Map View** — Dedicated map tab that fills the available screen space; markers show the sanitized address for each stop.
- **Optimize Route** — Reorder middle stops between a fixed start and end to minimize driving distance using OpenRouteService and Google OR-Tools.
- **Optimized Route Results** — View the reordered address list with numbered stop order and total route distance.
- **Sanitized address format** — All addresses use `street address, city, ST ZIP` (example: `2249 Washington Ave, Bronx, NY 10456`). Apartment, unit, suite, and other extra details are stripped during conversion.
- **Input validation** — Plot and Optimize reject addresses that are not already in the sanitized format.
- **Per-tab API keys** — Enter only the keys needed for the tab you are using.
- **Tab badges** — Visual indicators when a tab has new results waiting (Plot, Map View, Optimized Route Results).
- **Copy extracted addresses** — Copy the clean address list directly from the Convert tab.

## Tabs

| Tab | Purpose | API keys required |
| --- | --- | --- |
| Convert Blob to Addresses | Extract addresses from unstructured text | OpenAI |
| Plot Addresses on Map | Geocode and plot addresses | Google Maps Geocoding, Google Maps JavaScript |
| Map View | View plotted markers on a full-height map | (uses keys from Plot tab) |
| Optimize Route | Reorder stops to minimize driving distance | Google Maps Geocoding, OpenRouteService |
| Optimized Route Results | View optimized order and total distance | (uses keys from Optimize tab) |

The Google Maps Geocoding key entered on the Plot or Optimize tab is kept in sync between those two tabs.

## Address format

All addresses in the app use this format:

```text
street address, city, ST ZIP
```

Example: `2249 Washington Ave, Bronx, NY 10456`

During conversion, the app removes apartment numbers, unit numbers, suite numbers, floor/building details, country names, and list numbering. Plot and Optimize require input that already matches this format. After plotting or optimizing, results are written back in the same standardized form.

| Step | Format enforcement |
| --- | --- |
| Convert Blob to Addresses | Extracts and normalizes addresses automatically |
| Plot Addresses on Map | Requires sanitized input; validates before geocoding |
| Optimize Route | Requires sanitized input; validates before optimizing |
| Optimized Route Results | Shows numbered stop order (`1.`, `2.`, `3.`, …) for the optimized route |

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
- **No Storage**: API keys are not stored on the server — they are only used for the duration of each request.
- **Input Validation**: API keys are validated for proper format before being used.
- **CORS Protection**: Cross-Origin Resource Sharing is properly configured for security.

## Setup and Usage

1. Clone or download the repository.
2. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
3. Run the Python server:
   ```sh
   python app.py
   ```
4. Open `http://127.0.0.1:5001/` in your browser.
5. Enter the API keys on the tab where you need them:
   - **Convert Blob to Addresses**: OpenAI API key
   - **Plot Addresses on Map**: Google Maps Geocoding and JavaScript API keys
   - **Optimize Route**: Google Maps Geocoding and OpenRouteService API keys

### Convert addresses from text

1. Open the **Convert Blob to Addresses** tab.
2. Paste unstructured text and click **Convert**.
3. Extracted addresses appear in the output area with line numbers on the right for easy reference. The clean address list is copied into the **Plot Addresses on Map** tab automatically.
4. Use **Copy** to copy the sanitized list, or switch to the Plot tab to continue.

### Plot addresses on a map

1. Open the **Plot Addresses on Map** tab (or use addresses from the Convert step).
2. Enter one sanitized address per line in the format `street address, city, ST ZIP` and click **Plot**.
3. The app validates each line, geocodes the addresses, and switches to **Map View**, where markers appear on a full-height map.
4. Click a marker to see the sanitized address. After plotting, the address list is updated with geocoded, standardized formatting.

### Optimize a route

1. Open the **Optimize Route** tab.
2. Enter one sanitized address per line in the format `street address, city, ST ZIP`. The **first** address is the start, the **last** is the end, and middle stops are reordered to minimize driving distance.
3. Click **Optimize**.
4. Results appear on the **Optimized Route Results** tab, including the reordered address list with numbered stop order and total distance in miles and meters.

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
- Used to calculate distances between stops; OR-Tools handles the reordering

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
- **No Data Persistence**: API keys are not stored or logged
- **CORS Configuration**: Properly configured Cross-Origin Resource Sharing
- **XSS Protection**: Headers prevent cross-site scripting attacks

## Notes

- API keys are transmitted securely but users should still be cautious about using them on untrusted networks.
- Ensure your Google Maps and OpenRouteService API keys are properly restricted to prevent unauthorized usage.
- The application validates API key formats but cannot guarantee their validity until they are used.
- Make sure to use HTTPS in production environments for maximum security.
- Route optimization requires at least two addresses (a start and an end). With only two addresses, no reordering is needed.
- Map markers and optimized route results use the sanitized address format, not raw pasted text.
- Invalid addresses on the Plot or Optimize tabs are rejected with a list of lines that need fixing.

## License

This project is open-source and available for use under the MIT License.
