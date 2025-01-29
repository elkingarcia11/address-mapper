# Address Mapper

## Overview
This is a simple web application that allows users to paste a list of addresses and visualize them on a Google Map.

## Features
- Paste a list of addresses into a text area
- Uses Google Maps API to geocode addresses
- Plots locations on an interactive map

## Requirements
- A Google Maps API key
- A web browser

## Setup and Usage
1. Clone or download the repository.
2. Create a `.env` file in the project directory and add your Google Maps API key:
   ```
   GOOGLE_MAPS_API_KEY=your_actual_api_key
   ```
3. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
4. Run the Python server:
   ```sh
   python server.py
   ```
5. Open `http://127.0.0.1:5000/` in your browser.
6. Paste addresses into the text area and click the "Plot Addresses" button.

## Running Locally
To run the application locally:

### Option 1: Open in Browser (Basic, Insecure)
- Simply double-click `index.html` or right-click → "Open With" → Choose a browser.

### Option 2: Use a Local Server (Recommended)
#### Python
Run the following command in the terminal:
```sh
python server.py
```
Then open `http://127.0.0.1:5000/` in your browser.

#### VS Code Live Server
- Install the **Live Server** extension in VS Code.
- Right-click `index.html` → "Open with Live Server".

## Notes
- Ensure your Google Maps API key has geocoding and maps JavaScript enabled.
- Restrict your API key to prevent unauthorized use.

## License
This project is open-source and available for use under the MIT License.

