let map;
let activeInfoWindow = null;

function initMap() {
  const spinnerContainer = document.getElementById("spinnerContainer");
  spinnerContainer.style.display = "flex"; // Show spinner while map loads
  
  // Define a style to hide Points of Interest (POIs)
  const mapStyle = [
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
  ];
  // Initialize the map without geocoding logic
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 40.8448, lng: -73.8648 }, // Default center (Bronx)
    zoom: 12,
    styles: mapStyle, // Apply the custom styles
    mapTypeControl: false, // Disable map type controls (Map/Satellite/Terrain)
    streetViewControl: false, // Disable Street View control (pegman icon),
    rotateControl: false, // Optional: Disable rotate control
    gestureHandling: "cooperative", // Improve touch gestures on mobile
  });

  // Listen for the 'idle' event to ensure the map is fully loaded
  google.maps.event.addListenerOnce(map, "idle", () => {
    console.log("Map is ready!");
    spinnerContainer.style.display = "none"; // Hide spinner when map is ready
  });
}

async function extractAddresses() {
  const text = document.getElementById("blobInput").value;
  const spinnerContainer = document.getElementById("spinnerContainer");
  spinnerContainer.style.display = "flex"; // Display the spinner
  try {
    const response = await fetch("/extract-addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to extract addresses");
    }
    const data = await response.json();
    document.getElementById("addressInput").value = data.addresses;
  } catch (error) {
    console.error("Failed to extract addresses:", error);
    alert(`Error: ${error.message}`);
  } finally {
    spinnerContainer.style.display = "none";
  }
}

async function geocodeAddresses() {
  const addresses = document.getElementById("addressInput").value.split("\n");
  const spinnerContainer = document.getElementById("spinnerContainer");
  spinnerContainer.style.display = "flex"; // Display the spinner
  try {
    const response = await fetch("/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to geocode addresses");
    }
    const data = await response.json();
    const results = data.results;

    if (!map) {
      console.error("Map is not initialized yet.");
      return;
    }

    // Clear existing markers
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
    document.getElementById("map").style.display = "block"; // Show the map
    spinnerContainer.style.display = "none"; // Hide spinner when map is displayed
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
