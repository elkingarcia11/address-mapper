# Address Mapper

## Overview

This is a web application that enables users to extract a list of addresses from a block of text using OpenAI's GPT model. It also enables users to geocode a list of addresses and plot them on a Google Map using interactive markers by leveraging the Google Maps API.

## Features

- Transform a block of text into a list of addresses (including street name, number, city, state, and zip code) by utilizing OpenAI's GPT model to identify and extract addresses from the text.
- Uses the Google Maps API to geocode a list of addresses.
- Consumes a list of addresses and plots them on an interactive map with clickable markers displaying address details.
- Secure API key input system - users provide their own API keys through the frontend interface.

## Requirements

- Two Google Maps API keys: one with geocoding enabled and one with maps JavaScript enabled.
- An OpenAI API key.
- Flask framework for handling API requests and secure transmission.

## API Key Security

The application has been designed with security in mind for handling user-provided API keys:

- **No Authentication Required**: The login system has been removed for simplified access.
- **User-Provided API Keys**: Users input their own API keys through secure password fields in the frontend.
- **Secure Transmission**: API keys are transmitted securely via HTTPS with proper security headers.
- **No Storage**: API keys are not stored on the server - they are only used for the duration of each request.
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
5. Enter your API keys in the "API Configuration" section:
   - **Google Maps Geocoding API Key**: For converting addresses to coordinates
   - **Google Maps JavaScript API Key**: For displaying the interactive map
   - **OpenAI API Key**: For extracting addresses from text
6. Click "Load Map" to initialize Google Maps with your JavaScript API key.
7. Paste a block of text into the input field and click "Convert" to extract addresses using OpenAI.
8. Click "Plot" to visualize the extracted addresses on the map using Google Maps geocoding.

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
- Should start with 'sk-' and be properly formatted

## Set up Continuous Integration using Google Cloud's Cloud Run

1. Connect your repository and set up the Dockerfile as the build configuration type.
2. Deploy your application - no additional environment variables or secrets are needed since users provide their own API keys.
3. Ensure your deployment uses HTTPS for secure API key transmission.

## ChatGPT Integration

This application uses OpenAI's GPT model to extract addresses from blocks of text. When you paste a block of text and provide your OpenAI API key, the GPT model processes the text and returns the addresses found within it. The extracted addresses are then displayed in the address input area, where they can be geocoded and visualized on the map.

## Security Features

- **HTTPS Enforcement**: Strict Transport Security headers ensure secure transmission
- **Content Security Policy**: Restricts resource loading to trusted domains
- **Input Validation**: API keys are validated for proper format
- **No Data Persistence**: API keys are not stored or logged
- **CORS Configuration**: Properly configured Cross-Origin Resource Sharing
- **XSS Protection**: Headers prevent cross-site scripting attacks

## Notes

- API keys are transmitted securely but users should still be cautious about using them on untrusted networks.
- Ensure your Google Maps API keys are properly restricted to prevent unauthorized usage.
- The application validates API key formats but cannot guarantee their validity until they are used.
- Make sure to use HTTPS in production environments for maximum security.

## License

This project is open-source and available for use under the MIT License.
