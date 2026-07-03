let map;
let activeInfoWindow = null;
let mapInitialized = false;
let googleMapsLoaded = false;
let markers = [];
let activeTab = "convert";

const TAB_LABELS = {
  convert: "Convert Blob to Addresses",
  plot: "Plot Addresses on Map",
  optimize: "Optimize Route",
  map: "Map View",
  results: "Optimized Route Results",
};

const API_KEY_CONFIG = {
  openai: { tab: "convert", inputId: "openaiApiKey" },
  googleMapsGeo: { tab: "plot", inputId: "googleMapsGeoApiKey" },
  googleMapsGeoOptimize: { tab: "optimize", inputId: "googleMapsGeoApiKeyOptimize" },
  googleMapsJs: { tab: "plot", inputId: "googleMapsJsApiKey" },
  ors: { tab: "optimize", inputId: "orsApiKey" },
};

function getGoogleMapsGeoKey() {
  const plotKey = document.getElementById("googleMapsGeoApiKey").value.trim();
  const optimizeKey = document.getElementById("googleMapsGeoApiKeyOptimize").value.trim();
  return plotKey || optimizeKey;
}

function getApiKeys() {
  return {
    googleMapsGeo: getGoogleMapsGeoKey(),
    googleMapsJs: document.getElementById("googleMapsJsApiKey").value.trim(),
    openai: document.getElementById("openaiApiKey").value.trim(),
    ors: document.getElementById("orsApiKey").value.trim(),
  };
}

function syncGoogleMapsGeoKeys(sourceId) {
  const plotInput = document.getElementById("googleMapsGeoApiKey");
  const optimizeInput = document.getElementById("googleMapsGeoApiKeyOptimize");
  const value = document.getElementById(sourceId).value;

  if (sourceId === "googleMapsGeoApiKey") {
    optimizeInput.value = value;
  } else {
    plotInput.value = value;
  }
}

function validateApiKeys(requiredKeys = [], contextTab = null) {
  const apiKeys = getApiKeys();
  const missing = requiredKeys.filter((key) => !apiKeys[key]);

  if (missing.length > 0) {
    const labels = {
      googleMapsGeo: "Google Maps Geocoding API key",
      googleMapsJs: "Google Maps JavaScript API key",
      openai: "OpenAI API key",
      ors: "OpenRouteService API key",
    };
    const names = missing.map((key) => labels[key] || key);
    alert(`Please provide the following API keys: ${names.join(", ")}`);

    const firstMissing = missing[0];
    let config = API_KEY_CONFIG[firstMissing];
    if (firstMissing === "googleMapsGeo" && contextTab === "optimize") {
      config = API_KEY_CONFIG.googleMapsGeoOptimize;
    }
    if (config) {
      switchTab(config.tab);
      const input = document.getElementById(config.inputId);
      if (input) {
        input.focus();
      }
    }

    return false;
  }

  return true;
}

function switchTab(tabId) {
  activeTab = tabId;

  document.querySelectorAll(".tab").forEach((tab) => {
    const isActive = tab.dataset.tab === tabId;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabId}`);
  });

  if (tabId === "map" && map) {
    google.maps.event.trigger(map, "resize");
    if (markers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((marker) => bounds.extend(marker.getPosition()));
      map.fitBounds(bounds);
    }
  }

  clearTabBadge(tabId);
}

function setTabBadge(tabId) {
  const badge = document.getElementById(`${tabId}TabBadge`);
  if (badge) {
    badge.classList.remove("hidden");
  }
}

function clearTabBadge(tabId) {
  const badge = document.getElementById(`${tabId}TabBadge`);
  if (badge) {
    badge.classList.add("hidden");
  }
}

function showResultBanner(bannerId, message, targetTabId) {
  const banner = document.getElementById(bannerId);
  if (!banner) {
    return;
  }

  banner.innerHTML = "";
  banner.appendChild(document.createTextNode(message + " "));

  const link = document.createElement("button");
  link.type = "button";
  link.className = "tab-link";
  link.textContent = `Go to ${TAB_LABELS[targetTabId]} tab`;
  link.addEventListener("click", () => switchTab(targetTabId));
  banner.appendChild(link);

  banner.classList.remove("hidden");
  setTabBadge(targetTabId);
}

function hideResultBanner(bannerId) {
  const banner = document.getElementById(bannerId);
  if (banner) {
    banner.classList.add("hidden");
    banner.innerHTML = "";
  }
}

function loadGoogleMapsIfNeeded() {
  return new Promise((resolve, reject) => {
    if (!validateApiKeys(["googleMapsJs"])) {
      reject(new Error("Google Maps JavaScript API key is required"));
      return;
    }

    if (googleMapsLoaded) {
      resolve();
      return;
    }

    const apiKeys = getApiKeys();

    window.initMapCallback = function () {
      initMap();
      resolve();
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKeys.googleMapsJs}&callback=initMapCallback`;
    script.async = true;
    script.defer = true;
    script.onerror = function () {
      reject(new Error("Failed to load Google Maps. Please check your API key."));
    };

    document.head.appendChild(script);
    googleMapsLoaded = true;
  });
}

function initMap() {
  const mapElement = document.getElementById("map");
  const spinnerContainer = document.getElementById("spinnerContainer");

  map = new google.maps.Map(mapElement, {
    center: { lat: 40.8448, lng: -73.8648 },
    zoom: 12,
    styles: [
      {
        featureType: "poi",
        elementType: "labels",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "poi",
        elementType: "geometry",
        stylers: [{ visibility: "off" }],
      },
    ],
    mapTypeControl: false,
    streetViewControl: false,
    rotateControl: false,
    gestureHandling: "cooperative",
  });

  google.maps.event.addListenerOnce(map, "idle", () => {
    mapInitialized = true;
    if (mapElement.style.display === "block") {
      spinnerContainer.style.display = "none";
    }
  });
}

async function extractAddresses() {
  if (!validateApiKeys(["openai"])) {
    return;
  }

  const text = document.getElementById("blobInput").value;
  const apiKeys = getApiKeys();
  const spinnerContainer = document.getElementById("spinnerContainer");

  spinnerContainer.style.display = "flex";

  try {
    const response = await fetch("/extract-addresses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        text: text,
        openai_api_key: apiKeys.openai,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to extract addresses");
    }

    const data = await response.json();
    const addresses = data.addresses;

    document.getElementById("addressInput").value = addresses;
    document.getElementById("convertOutput").value = addresses;

    const lineCount = addresses.split("\n").filter((line) => line.trim()).length;
    document.getElementById("convertOutputMeta").textContent =
      `${lineCount} address${lineCount === 1 ? "" : "es"} extracted`;
    document.getElementById("convertOutputSection").classList.remove("hidden");

    setTabBadge("plot");
    updateButtonStates();
  } catch (error) {
    console.error("Failed to extract addresses:", error);
    alert(`Error: ${error.message}`);
  } finally {
    spinnerContainer.style.display = "none";
  }
}

async function optimizeRoute() {
  if (!validateApiKeys(["googleMapsGeo", "ors"], "optimize")) {
    return;
  }

  const addresses = document
    .getElementById("optimizeInput")
    .value.split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (addresses.length < 2) {
    alert("Enter at least two addresses: one start and one end.");
    return;
  }

  const apiKeys = getApiKeys();
  const spinnerContainer = document.getElementById("spinnerContainer");

  spinnerContainer.style.display = "flex";

  try {
    const response = await fetch("/optimize-route", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        addresses,
        google_maps_geo_api_key: apiKeys.googleMapsGeo,
        ors_api_key: apiKeys.ors,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.geocoding_errors) {
        const failed = data.geocoding_errors
          .map((item) => `${item.address}: ${item.error}`)
          .join("\n");
        throw new Error(`${data.error}\n\n${failed}`);
      }
      throw new Error(data.error || "Failed to optimize route");
    }

    document.getElementById("optimizeOutput").value =
      data.ordered_addresses.join("\n");
    document.getElementById("optimizeDistance").textContent =
      `Total distance: ${data.total_distance_miles} miles (${data.total_distance_meters.toLocaleString()} meters)`;

    document.getElementById("resultsEmptyHint").classList.add("hidden");
    document.getElementById("optimizeDistance").classList.remove("hidden");
    document.getElementById("optimizeOutput").classList.remove("hidden");
    document.querySelector(".results-output-label").classList.remove("hidden");

    showResultBanner(
      "optimizeResultBanner",
      "Route optimized successfully.",
      "results"
    );
  } catch (error) {
    console.error("Failed to optimize route:", error);
    alert(`Error: ${error.message}`);
  } finally {
    spinnerContainer.style.display = "none";
  }
}

async function geocodeAddresses() {
  if (!validateApiKeys(["googleMapsGeo", "googleMapsJs"])) {
    return;
  }

  const addresses = document.getElementById("addressInput").value.split("\n");
  const apiKeys = getApiKeys();
  const spinnerContainer = document.getElementById("spinnerContainer");
  const mapElement = document.getElementById("map");

  spinnerContainer.style.display = "flex";

  try {
    if (!map) {
      await loadGoogleMapsIfNeeded();
    }

    const response = await fetch("/geocode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        addresses: addresses,
        google_maps_geo_api_key: apiKeys.googleMapsGeo,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to geocode addresses");
    }

    const data = await response.json();
    const results = data.results;

    markers.forEach((marker) => marker.setMap(null));
    markers = [];

    if (map) {
      map.setCenter({ lat: 40.8448, lng: -73.8648 });
    }

    results.forEach((result, index) => {
      if (result.error) {
        console.error(`Geocoding failed for: ${result.address}`);
        return;
      }

      const marker = new google.maps.Marker({
        position: { lat: result.latitude, lng: result.longitude },
        map: map,
        title: result.address,
      });

      markers.push(marker);

      if (index === 0) {
        map.setCenter({ lat: result.latitude, lng: result.longitude });
      }

      const infoWindow = new google.maps.InfoWindow({
        content: result.address,
      });

      marker.addListener("click", () => {
        if (activeInfoWindow) {
          activeInfoWindow.close();
        }
        infoWindow.open(map, marker);
        activeInfoWindow = infoWindow;
      });
    });

    mapElement.style.display = "block";
    document.getElementById("mapEmptyHint").classList.add("hidden");
    document.getElementById("clearMapButton").classList.remove("hidden");

    switchTab("map");
    if (map) {
      google.maps.event.trigger(map, "resize");
      if (markers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        markers.forEach((marker) => bounds.extend(marker.getPosition()));
        map.fitBounds(bounds);
      }
    }

    if (mapInitialized) {
      spinnerContainer.style.display = "none";
    } else {
      google.maps.event.addListenerOnce(map, "idle", () => {
        spinnerContainer.style.display = "none";
      });
    }
  } catch (error) {
    console.error("Failed to geocode addresses:", error);
    alert(`Error: ${error.message}`);
    spinnerContainer.style.display = "none";
  }
}

function updateButtonStates() {
  const blobInput = document.getElementById("blobInput");
  const addressInput = document.getElementById("addressInput");
  const optimizeInput = document.getElementById("optimizeInput");
  const convertButton = document.getElementById("buttonSubmit");
  const plotButton = document.getElementById("addressSubmit");
  const optimizeButton = document.getElementById("optimizeSubmit");
  const clearBlobButton = document.getElementById("clearBlobButton");
  const clearAddressButton = document.getElementById("clearAddressButton");
  const clearOptimizeButton = document.getElementById("clearOptimizeButton");

  const blobHasContent = blobInput.value.trim() !== "";
  convertButton.disabled = !blobHasContent;
  clearBlobButton.disabled = !blobHasContent;

  const addressHasContent = addressInput.value.trim() !== "";
  plotButton.disabled = !addressHasContent;
  clearAddressButton.disabled = !addressHasContent;

  const optimizeHasContent = optimizeInput.value.trim() !== "";
  optimizeButton.disabled = !optimizeHasContent;
  clearOptimizeButton.disabled = !optimizeHasContent;
}

function clearBlobInput() {
  document.getElementById("blobInput").value = "";
  document.getElementById("convertOutput").value = "";
  document.getElementById("convertOutputMeta").textContent = "";
  document.getElementById("convertOutputSection").classList.add("hidden");
  const copyBtn = document.getElementById("copyConvertOutput");
  copyBtn.textContent = "Copy";
  copyBtn.classList.remove("btn-copy--success");
  updateButtonStates();
}

async function copyConvertOutput() {
  const output = document.getElementById("convertOutput");
  const text = output.value;
  if (!text.trim()) {
    return;
  }

  const copyBtn = document.getElementById("copyConvertOutput");

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    output.focus();
    output.select();
    document.execCommand("copy");
  }

  copyBtn.textContent = "Copied!";
  copyBtn.classList.add("btn-copy--success");
  setTimeout(() => {
    copyBtn.textContent = "Copy";
    copyBtn.classList.remove("btn-copy--success");
  }, 2000);
}

function clearOptimizeInput() {
  document.getElementById("optimizeInput").value = "";
  document.getElementById("optimizeOutput").value = "";
  document.getElementById("optimizeDistance").textContent = "";
  document.getElementById("optimizeDistance").classList.add("hidden");
  document.getElementById("optimizeOutput").classList.add("hidden");
  document.querySelector(".results-output-label").classList.add("hidden");
  document.getElementById("resultsEmptyHint").classList.remove("hidden");
  hideResultBanner("optimizeResultBanner");
  clearTabBadge("results");
  updateButtonStates();
}

function clearAddressInput() {
  document.getElementById("addressInput").value = "";
  hideResultBanner("plotResultBanner");
  updateButtonStates();
}

function clearMap() {
  if (!map) {
    return;
  }

  markers.forEach((marker) => marker.setMap(null));
  markers = [];

  map.setCenter({ lat: 40.8448, lng: -73.8648 });
  map.setZoom(12);

  document.getElementById("map").style.display = "none";
  document.getElementById("mapEmptyHint").classList.remove("hidden");
  document.getElementById("clearMapButton").classList.add("hidden");
  hideResultBanner("plotResultBanner");
  clearTabBadge("map");
}

document.addEventListener("DOMContentLoaded", function () {
  const addressInput = document.getElementById("addressInput");
  const blobInput = document.getElementById("blobInput");
  const optimizeInput = document.getElementById("optimizeInput");

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  addressInput.addEventListener("input", updateButtonStates);
  addressInput.addEventListener("paste", () => setTimeout(updateButtonStates, 0));

  blobInput.addEventListener("input", updateButtonStates);
  blobInput.addEventListener("paste", () => setTimeout(updateButtonStates, 0));

  optimizeInput.addEventListener("input", updateButtonStates);
  optimizeInput.addEventListener("paste", () => setTimeout(updateButtonStates, 0));

  document.getElementById("googleMapsGeoApiKey").addEventListener("input", () => {
    syncGoogleMapsGeoKeys("googleMapsGeoApiKey");
  });
  document.getElementById("googleMapsGeoApiKeyOptimize").addEventListener("input", () => {
    syncGoogleMapsGeoKeys("googleMapsGeoApiKeyOptimize");
  });

  document.getElementById("convertOutput").addEventListener("focus", function () {
    this.select();
  });

  updateButtonStates();

  window.addEventListener("resize", () => {
    if (activeTab === "map" && map) {
      google.maps.event.trigger(map, "resize");
    }
  });
});
