# Address Mapper

## Overview

This is a web application that enables users to extract a list of addresses from a block of text using OpenAI's GPT model. It also enables users to geocode a list of addresses and plot them on a Google Map using interactive markers by leveraging the Google Maps API.

## Features

- Transform a block of text into a list of addresses (including street name, number, city, state, and zip code) by utilizing OpenAI's GPT model to identify and extract addresses from the text.
- Uses the Google Maps API to geocode a list of addresses.
- Consumes a list of addresses and plots them on an interactive map with clickable markers displaying address details.
- Implements user authentication to restrict access to features.

## Requirements

- Two Google Maps API keys: one with geocoding enabled and one with maps JavaScript enabled.
- An OpenAI API key.
- Flask framework for handling authentication and session management.

## Authentication

The application includes a simple authentication system using Flask sessions. User credentials are stored in a JSON file (`users.json`), and authentication is handled through login and logout routes. The authentication system ensures that only logged-in users can access the main features of the application.

### Login & Logout

- Users can log in via the `/login` route by providing a username and password.
- If authentication is successful, the session stores the username and grants access to the main application.
- Users can log out via the `/logout` route, which clears the session.

## Setup and Usage

1. Clone or download the repository.
2. Create a `.env` file in the project directory and add your API keys and authentication secret:
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
5. Open `http://127.0.0.1:5001/` in your browser.
6. Log in with your credentials.
7. Paste a block of text into the input field and click the "Convert Blob to Addresses" button to extract addresses.
8. Click the "Plot Addresses" button to visualize the extracted addresses on the map.

## Set up Continuous Integration using Google Cloud's Cloud Run and Secret Manager

1. Build the Docker image: `docker build -t address-mapper .`
2. Test locally: `docker run -p 80:80 address-mapper` and visit http://localhost
3. Deploy to Cloud Run:
   - Store your users.json as a file in Secret Manager
   - Store your .env variables one by one in Secret Manager
   - Connect your repository and configure the Dockerfile as the build source.
   - Add environment variables in the Cloud Run configuration.
   - Mount users.json as a volume in the Cloud Run configuration.
   - Grant the Cloud Run service account the Secret Manager Secret Accessor role.
   - Deploy and verify the application.

## ChatGPT Integration

This application uses OpenAI's GPT model to extract addresses from blocks of text. When you paste a block of text into the input field and click the "Convert Blob to Addresses" button, the GPT model processes the text and returns the addresses found within it. The extracted addresses are then displayed in the second text area, where they can be geocoded and visualized on the map.

## Notes

- Ensure the Google Maps API key with Maps JavaScript enabled is restricted to your IP address.
- Ensure your OpenAI API key is valid and can access the GPT models.
- Make sure the map container has an explicit height set to ensure the map displays correctly.
- Authentication credentials are stored in `users.json`. Ensure this file is kept secure and is not exposed publicly.

## License

This project is open-source and available for use under the MIT License.
