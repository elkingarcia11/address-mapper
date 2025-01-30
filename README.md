# Address Mapper

## Overview

This is a web application that enables users to extract a list of addresses from a block of text using OpenAI's GPT model. It also enables users to geocode a list of addresses and plot them on a Google Map using interactive markers by leveraging the Google Maps API.

## Features

- Transform a block of text into a list of addresses (including street name, number, city, state, and zip code) by utilizing OpenAI's GPT model to identify and extract addresses from the text.
- Uses the Google Maps API to geocode a list of addresses.
- Consumes a list of addresses and plots them on an interactive map with clickable markers displaying address details.

## Requirements

- Two Google Maps API key one with geocoding enabled and one with maps JavaScript enabled.
- An OpenAI API key

## Setup and Usage

1. Clone or download the repository.
2. Create a `.env` file in the project directory and add your API keys:
   ```bash
   GOOGLE_MAPS_JS_API_KEY=your_google_maps_js_api_key
   GOOGLE_MAPS_GEO_API_KEY=your_google_maps_geo_api_key
   OPENAI_API_KEY=your_openai_api_key
   ```
3. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
4. Run the Python server:
   ```sh
   python app.py
   ```
5. Open `http://127.0.0.1:5000/` in your browser.
6. Paste a block of text into the input field and click the "Convert Blob to Addresses" button to extract addresses.
7. Click the "Plot Addresses" button to visualize the extracted addresses on the map.

## ChatGPT Integration

This application uses OpenAI's GPT model to extract addresses from blocks of text. When you paste a block of text into the input field and click the "Convert Blob to Addresses" button, the GPT model processes the text and returns the addresses found within it. The extracted addresses are then displayed in the second text area, where they can be geocoded and visualized on the map.

## Notes

- Ensure the Google Maps API key with Maps JavaScript enabled is restricted to your IP address.
- Ensure your OpenAI API key is valid and can access the GPT models.
- Make sure the map container has an explicit height set to ensure the map displays correctly.

## License

This project is open-source and available for use under the MIT License.
