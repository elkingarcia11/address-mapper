let map;
let activeInfoWindow = null;
let mapInitialized = false;
let googleMapsLoaded = false;

// Function to get API keys from input fields
function getApiKeys() {
  return {
    googleMapsGeo: document.getElementById("googleMapsGeoApiKey").value.trim(),
    googleMapsJs: document.getElementById("googleMapsJsApiKey").value.trim(),
    openai: document.getElementById("openaiApiKey").value.trim()
  };
}

// Function to validate API keys
function validateApiKeys(requiredKeys = []) {
  const apiKeys = getApiKeys();
  const missing = [];
  
  requiredKeys.forEach(key => {
    if (!apiKeys[key]) {
      missing.push(key);
    }
  });
  
  if (missing.length > 0) {
    alert(`Please provide the following API keys: ${missing.join(', ')}`);
    return false;
  }
  
  return true;
}

// Function to dynamically load Google Maps
function loadGoogleMapsIfNeeded() {
  return new Promise((resolve, reject) => {
    if (!validateApiKeys(['googleMapsJs'])) {
      reject(new Error('Google Maps JavaScript API key is required'));
      return;
    }
    
    if (googleMapsLoaded) {
      resolve();
      return;
    }
    
    const apiKeys = getApiKeys();
    
    // Set up the global callback before loading the script
    window.initMapCallback = function() {
      initMap();
      resolve();
    };
    
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKeys.googleMapsJs}&callback=initMapCallback`;
    script.async = true;
    script.defer = true;
    script.onerror = function() {
      reject(new Error('Failed to load Google Maps. Please check your API key.'));
    };
    
    document.head.appendChild(script);
    googleMapsLoaded = true;
  });
}

// Check and expand the address section if there's text in the input field
function checkAndExpandAddressSection() {
  const addressInput = document.getElementById("addressInput");
  const addressSection = document.getElementById("addressSection");
  const indicator = document.getElementById("addressSectionIndicator");
  
  if (addressInput.value.trim() !== "" && addressSection.classList.contains("hidden")) {
    addressSection.classList.remove("hidden");
    indicator.textContent = "▲"; // Chevron up when visible
  }
}

function initMap() {
  // Only show spinner if map is being displayed
  const mapElement = document.getElementById("map");
  const spinnerContainer = document.getElementById("spinnerContainer");
  
  // Initialize the map without geocoding logic
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 40.8448, lng: -73.8648 }, // Default center (Bronx)
    zoom: 12,
    styles: [
      {
        featureType: "poi", // Targets Points of Interest
        elementType: "labels", // Targets labels/icons of POIs
        stylers: [{ visibility: "off" }], // Hides them
      },
      {
        featureType: "poi",
        elementType: "geometry", // Targets the geometry (shapes) of POIs
        stylers: [{ visibility: "off" }], // Hides them
      },
    ],
    mapTypeControl: false, // Disable map type controls
    streetViewControl: false, // Disable Street View control
    rotateControl: false, // Optional: Disable rotate control
    gestureHandling: "cooperative", // Improve touch gestures on mobile
  });

  // Listen for the 'idle' event to ensure the map is fully loaded
  google.maps.event.addListenerOnce(map, "idle", () => {
    console.log("Map is ready!");
    mapInitialized = true;
    if (mapElement.style.display === "block") {
      spinnerContainer.style.display = "none"; // Hide spinner when map is ready and visible
    }
  });
  
  // Check if there's text in the address input and expand section if needed
  checkAndExpandAddressSection();
}

async function extractAddresses() {
  if (!validateApiKeys(['openai'])) {
    return;
  }
  
  const text = document.getElementById("blobInput").value;
  const apiKeys = getApiKeys();
  const spinnerContainer = document.getElementById("spinnerContainer");
  
  spinnerContainer.style.display = "flex"; // Display the spinner
  
  try {
    const response = await fetch("/extract-addresses", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest" // CSRF protection
      },
      body: JSON.stringify({ 
        text: text,
        openai_api_key: apiKeys.openai
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to extract addresses");
    }
    
    const data = await response.json();
    document.getElementById("addressInput").value = data.addresses;
    
    // Expand the address section after extracting addresses
    checkAndExpandAddressSection();
    updateButtonStates();
  } catch (error) {
    console.error("Failed to extract addresses:", error);
    alert(`Error: ${error.message}`);
  } finally {
    spinnerContainer.style.display = "none";
  }
}

async function geocodeAddresses() {
  if (!validateApiKeys(['googleMapsGeo', 'googleMapsJs'])) {
    return;
  }
  
  const addresses = document.getElementById("addressInput").value.split("\n");
  const apiKeys = getApiKeys();
  const spinnerContainer = document.getElementById("spinnerContainer");
  const mapElement = document.getElementById("map");
  
  spinnerContainer.style.display = "flex"; // Display the spinner
  
  try {
    // Load Google Maps if not already loaded
    if (!map) {
      await loadGoogleMapsIfNeeded();
    }
    
    const response = await fetch("/geocode", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest" // CSRF protection
      },
      body: JSON.stringify({ 
        addresses: addresses,
        google_maps_geo_api_key: apiKeys.googleMapsGeo
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to geocode addresses");
    }
    
    const data = await response.json();
    const results = data.results;

    // Clear existing markers before adding new ones
    if (markers.length > 0) {
      markers.forEach(marker => {
        marker.setMap(null);
      });
      markers = [];
    }
    
    // Reset map center
    if (map) {
      map.setCenter({ lat: 40.8448, lng: -73.8648 }); // Reset map center
    }
    
    results.forEach((result, index) => {
      if (result.error) {
        console.error(`Geocoding failed for: ${result.address}`);
        return;
      }
      const marker = new google.maps.Marker({
        position: { lat: result.latitude, lng: result.longitude },
        map: map,
        title: result.street_address,
      });
      
      // Store marker in global array
      markers.push(marker);
      
      // Center the map on the first address
      if (index === 0) {
        map.setCenter({ lat: result.latitude, lng: result.longitude });
      }
      const infoWindow = new google.maps.InfoWindow({
        content: `<strong>${result.street_address}</strong><br>${result.address}`,
      });
      marker.addListener("click", () => {
        if (activeInfoWindow) {
          activeInfoWindow.close();
        }
        infoWindow.open(map, marker);
        activeInfoWindow = infoWindow;
      });
    });
    
    // Show the map
    mapElement.style.display = "block";
    
    // Show the clear map button if there are markers
    if (markers.length > 0) {
      document.getElementById("clearMapContainer").style.display = "block";
    }
    
    // If map is already initialized, hide spinner now
    if (mapInitialized) {
      spinnerContainer.style.display = "none";
    } else {
      // Otherwise, wait for map to be ready before hiding spinner
      google.maps.event.addListenerOnce(map, "idle", () => {
        spinnerContainer.style.display = "none";
      });
    }
  } catch (error) {
    console.error("Failed to geocode addresses:", error);
    alert(`Error: ${error.message}`);
    spinnerContainer.style.display = "none"; // Hide spinner on error
  }
}

function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  const indicator = document.getElementById(`${sectionId}Indicator`);

  // Toggle the 'hidden' class on the section
  section.classList.toggle("hidden");

  // Update the indicator text based on the visibility state
  if (section.classList.contains("hidden")) {
    indicator.textContent = "▼"; // Chevron down when hidden
  } else {
    indicator.textContent = "▲"; // Chevron up when visible
  }
}

// Function to check and update button states based on input content
function updateButtonStates() {
  const blobInput = document.getElementById("blobInput");
  const addressInput = document.getElementById("addressInput");
  const convertButton = document.getElementById("buttonSubmit");
  const plotButton = document.getElementById("addressSubmit");
  const clearBlobButton = document.getElementById("clearBlobButton");
  const clearAddressButton = document.getElementById("clearAddressButton");
  
  // Check blob input and update convert/clear buttons
  const blobHasContent = blobInput.value.trim() !== "";
  convertButton.disabled = !blobHasContent;
  clearBlobButton.disabled = !blobHasContent;
  
  // Check address input and update plot/clear buttons
  const addressHasContent = addressInput.value.trim() !== "";
  plotButton.disabled = !addressHasContent;
  clearAddressButton.disabled = !addressHasContent;
}

// Set up event listeners when the document is loaded
document.addEventListener("DOMContentLoaded", function() {
  const addressInput = document.getElementById("addressInput");
  const blobInput = document.getElementById("blobInput");
  
  // Add event listeners to check and expand section when text is added
  addressInput.addEventListener("input", function() {
    checkAndExpandAddressSection();
    updateButtonStates();
  });
  addressInput.addEventListener("paste", function() {
    // Use setTimeout to allow the paste operation to complete first
    setTimeout(function() {
      checkAndExpandAddressSection();
      updateButtonStates();
    }, 0);
  });
  
  // Add event listeners for blob input
  blobInput.addEventListener("input", updateButtonStates);
  blobInput.addEventListener("paste", function() {
    setTimeout(updateButtonStates, 0);
  });
  
  // Check on page load
  checkAndExpandAddressSection();
  updateButtonStates();
});

// Clear functions
function clearBlobInput() {
  document.getElementById("blobInput").value = "";
  updateButtonStates();
}

function clearAddressInput() {
  document.getElementById("addressInput").value = "";
  // Also collapse the address section if it's empty
  const addressSection = document.getElementById("addressSection");
  const indicator = document.getElementById("addressSectionIndicator");
  
  if (!addressSection.classList.contains("hidden")) {
    addressSection.classList.add("hidden");
    indicator.textContent = "▼"; // Chevron down when hidden
  }
  
  updateButtonStates();
}

// Global variable to store markers
let markers = [];

function clearMap() {
  if (map && markers.length > 0) {
    // Clear all markers from the map
    markers.forEach(marker => {
      marker.setMap(null);
    });
    markers = []; // Reset the markers array
    
    // Reset map center and zoom
    map.setCenter({ lat: 40.8448, lng: -73.8648 }); // Default center (Bronx)
    map.setZoom(12);
    
    // Hide both the map and the clear map button
    document.getElementById("map").style.display = "none";
    document.getElementById("clearMapContainer").style.display = "none";
    
    console.log("Map cleared and hidden successfully");
  }
}
