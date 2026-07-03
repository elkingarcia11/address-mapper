let map;
let activeInfoWindow = null;
let mapInitialized = false;
let googleMapsLoaded = false;
let markers = [];
let activeTab = "convert";
let progressIntervalId = null;
let progressContext = null;

function formatElapsedDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function estimateOptimizeSeconds(stopCount, routeCount) {
  return Math.min(300, Math.max(30, 15 + stopCount + routeCount * 10));
}

function showProgress({ title, message, estimateSeconds = 30, steps = [] }) {
  hideProgress(false);

  const panel = document.getElementById("appProgress");
  const titleEl = document.getElementById("appProgressTitle");
  const messageEl = document.getElementById("appProgressMessage");
  const elapsedEl = document.getElementById("appProgressElapsed");
  const barEl = document.getElementById("appProgressBar");

  titleEl.textContent = title;
  messageEl.textContent = message;
  elapsedEl.textContent = "0s";
  barEl.style.width = "0%";
  panel.classList.remove("hidden");

  progressContext = {
    estimateSeconds,
    steps,
    stepIndex: 0,
    startedAt: Date.now(),
  };

  progressIntervalId = window.setInterval(() => {
    if (!progressContext) {
      return;
    }

    const elapsed = Date.now() - progressContext.startedAt;
    elapsedEl.textContent = formatElapsedDuration(elapsed);

    const ratio = Math.min(
      0.95,
      elapsed / (progressContext.estimateSeconds * 1000)
    );
    barEl.style.width = `${Math.round(ratio * 100)}%`;

    if (progressContext.steps.length > 0) {
      const stepDuration =
        (progressContext.estimateSeconds * 1000) / progressContext.steps.length;
      const nextIndex = Math.min(
        progressContext.steps.length - 1,
        Math.floor(elapsed / stepDuration)
      );
      if (nextIndex !== progressContext.stepIndex) {
        progressContext.stepIndex = nextIndex;
        messageEl.textContent = progressContext.steps[nextIndex];
      }
    }
  }, 250);
}

function updateProgressMessage(message) {
  document.getElementById("appProgressMessage").textContent = message;
}

function completeProgress(message) {
  document.getElementById("appProgressBar").style.width = "100%";
  if (message) {
    updateProgressMessage(message);
  }
}

function hideProgress(resetBar = true) {
  if (progressIntervalId !== null) {
    window.clearInterval(progressIntervalId);
    progressIntervalId = null;
  }
  progressContext = null;
  document.getElementById("appProgress").classList.add("hidden");
  if (resetBar) {
    document.getElementById("appProgressBar").style.width = "0%";
  }
}

function setButtonLoading(buttonId, isLoading) {
  const button = document.getElementById(buttonId);
  if (!button) {
    return;
  }
  button.disabled = isLoading;
  button.classList.toggle("is-loading", isLoading);
}

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

  savePersistedSettings();
}

const PERSISTED_SETTINGS_KEY = "addressMapper.settings";

function readPersistedSettings() {
  try {
    const raw = localStorage.getItem(PERSISTED_SETTINGS_KEY);
    if (!raw) {
      return null;
    }
    const data = JSON.parse(raw);
    return typeof data === "object" && data ? data : null;
  } catch (error) {
    console.warn("Could not read saved settings:", error);
    return null;
  }
}

function collectPersistedSettings() {
  return {
    openaiApiKey: document.getElementById("openaiApiKey").value,
    googleMapsGeoApiKey: getGoogleMapsGeoKey(),
    googleMapsJsApiKey: document.getElementById("googleMapsJsApiKey").value,
    orsApiKey: document.getElementById("orsApiKey").value,
    optimizeStartInput: document.getElementById("optimizeStartInput").value,
    optimizeEndInput: document.getElementById("optimizeEndInput").value,
    optimizeEndSameAsStart: document.getElementById("optimizeEndSameAsStart").checked,
  };
}

function savePersistedSettings() {
  try {
    localStorage.setItem(
      PERSISTED_SETTINGS_KEY,
      JSON.stringify(collectPersistedSettings())
    );
  } catch (error) {
    console.warn("Could not save settings:", error);
  }
}

function loadPersistedSettings() {
  const data = readPersistedSettings();
  if (!data) {
    return;
  }

  if (typeof data.openaiApiKey === "string") {
    document.getElementById("openaiApiKey").value = data.openaiApiKey;
  }
  if (typeof data.googleMapsGeoApiKey === "string") {
    document.getElementById("googleMapsGeoApiKey").value = data.googleMapsGeoApiKey;
    document.getElementById("googleMapsGeoApiKeyOptimize").value =
      data.googleMapsGeoApiKey;
  }
  if (typeof data.googleMapsJsApiKey === "string") {
    document.getElementById("googleMapsJsApiKey").value = data.googleMapsJsApiKey;
  }
  if (typeof data.orsApiKey === "string") {
    document.getElementById("orsApiKey").value = data.orsApiKey;
  }
  if (typeof data.optimizeStartInput === "string") {
    document.getElementById("optimizeStartInput").value = data.optimizeStartInput;
  }
  if (typeof data.optimizeEndSameAsStart === "boolean") {
    document.getElementById("optimizeEndSameAsStart").checked =
      data.optimizeEndSameAsStart;
  }
  if (typeof data.optimizeEndInput === "string") {
    document.getElementById("optimizeEndInput").value = data.optimizeEndInput;
  }
}

function bindPersistedSettings() {
  [
    "openaiApiKey",
    "googleMapsGeoApiKey",
    "googleMapsGeoApiKeyOptimize",
    "googleMapsJsApiKey",
    "orsApiKey",
    "optimizeStartInput",
    "optimizeEndInput",
  ].forEach((inputId) => {
    document.getElementById(inputId).addEventListener("input", savePersistedSettings);
  });

  document
    .getElementById("optimizeEndSameAsStart")
    .addEventListener("change", savePersistedSettings);
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

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderConvertOutput(addressesText) {
  const output = document.getElementById("convertOutput");
  const lines = addressesText.split("\n").filter((line) => line.trim());

  output.innerHTML = lines
    .map(
      (address, index) =>
        `<div class="convert-output-row"><span class="convert-output-text">${escapeHtml(address)}</span><span class="convert-output-line">${index + 1}</span></div>`
    )
    .join("");
}

async function extractAddresses() {
  if (!validateApiKeys(["openai"])) {
    return;
  }

  const text = document.getElementById("blobInput").value;
  const apiKeys = getApiKeys();

  showProgress({
    title: "Converting addresses",
    message: "Extracting addresses from text...",
    estimateSeconds: 20,
    steps: ["Extracting addresses from text...", "Formatting results..."],
  });
  setButtonLoading("buttonSubmit", true);

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
    renderConvertOutput(addresses);

    const lineCount = addresses.split("\n").filter((line) => line.trim()).length;
    document.getElementById("convertOutputMeta").textContent =
      `${lineCount} address${lineCount === 1 ? "" : "es"} extracted`;
    document.getElementById("convertOutputSection").classList.remove("hidden");

    setTabBadge("plot");
    updateButtonStates();
    completeProgress("Addresses extracted.");
  } catch (error) {
    console.error("Failed to extract addresses:", error);
    alert(`Error: ${error.message}`);
  } finally {
    hideProgress();
    setButtonLoading("buttonSubmit", false);
  }
}

async function optimizeRoute() {
  if (!validateApiKeys(["googleMapsGeo", "ors"], "optimize")) {
    return;
  }

  const startAddress = document.getElementById("optimizeStartInput").value.trim();
  const endAddress = document.getElementById("optimizeEndInput").value.trim();
  const addressText = document.getElementById("optimizeInput").value;
  const { valid: stops, invalid } = validateSanitizedAddresses(addressText);

  const endpointInvalid = [];
  if (startAddress && !isSanitizedAddressLine(startAddress)) {
    endpointInvalid.push(`Start: ${startAddress}`);
  }
  if (endAddress && !isSanitizedAddressLine(endAddress)) {
    endpointInvalid.push(`End: ${endAddress}`);
  }

  if (!startAddress || !endAddress) {
    alert("Enter both a start and end address.");
    return;
  }

  if (endpointInvalid.length > 0) {
    alert(formatSanitizedAddressError(endpointInvalid));
    return;
  }

  if (stops.length === 0) {
    alert("Enter at least one stop address.");
    return;
  }

  if (invalid.length > 0) {
    alert(formatSanitizedAddressError(invalid));
    return;
  }

  const routeCapacities = getRouteCapacities();
  const totalStops = stops.length;
  const capacitySum = routeCapacities.reduce((sum, value) => sum + value, 0);
  const splitMode = getSplitMode();
  const numRoutes = getNumRoutes();

  if (splitMode === "manual") {
    if (routeCapacities.length === 0) {
      alert("Enter the number of routes and stops per route.");
      return;
    }

    if (capacitySum !== totalStops) {
      alert(
        `Route capacities must sum to ${totalStops} stops ` +
          `(currently ${capacitySum}). Adjust stops per route.`
      );
      return;
    }
  } else if (totalStops < numRoutes) {
    alert(
      `Need at least ${numRoutes} stops for ${numRoutes} routes ` +
        `(currently ${totalStops}). Add more stop addresses or reduce routes.`
    );
    return;
  }

  const apiKeys = getApiKeys();
  const requestBody = {
    start_address: startAddress,
    end_address: endAddress,
    stops,
    google_maps_geo_api_key: apiKeys.googleMapsGeo,
    ors_api_key: apiKeys.ors,
    split_mode: splitMode,
    num_routes: numRoutes,
  };

  if (splitMode === "manual") {
    requestBody.route_capacities = routeCapacities;
  }

  const estimateSeconds = estimateOptimizeSeconds(totalStops, numRoutes);
  showProgress({
    title: "Optimizing routes",
    message: "Geocoding addresses...",
    estimateSeconds,
    steps: [
      "Geocoding addresses...",
      "Building driving distance matrix...",
      "Assigning stops to routes...",
      "Finalizing route order...",
    ],
  });
  setButtonLoading("optimizeSubmit", true);

  try {
    const response = await fetch("/optimize-route", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.invalid_addresses?.length) {
        throw new Error(formatSanitizedAddressError(data.invalid_addresses));
      }
      if (data.geocoding_errors) {
        const failed = data.geocoding_errors
          .map((item) => `${item.address}: ${item.error}`)
          .join("\n");
        throw new Error(`${data.error}\n\n${failed}`);
      }
      throw new Error(data.error || "Failed to optimize route");
    }

    const startLabel = data.start_label || data.depot_label;
    const endLabel = data.end_label || data.depot_label;
    const outputLines = [
      `Start: ${startLabel}`,
      `End: ${endLabel}`,
      "",
      `Total distance: ${data.total_distance_miles} miles (${data.total_distance_meters.toLocaleString()} meters)`,
    ];

    if (data.split_mode === "balanced_distance") {
      outputLines.push("Split mode: balanced by driving distance per route");
    }

    outputLines.push("");

    data.routes.forEach((route) => {
      outputLines.push(
        `--- Route ${route.route_number} (${route.target_stops} stops, ${route.distance_miles} mi) ---`
      );
      outputLines.push(`Start: ${startLabel}`);
      outputLines.push(`End: ${endLabel}`);
      route.ordered_stop_labels.forEach((address, index) => {
        outputLines.push(`${index + 1}. ${address}`);
      });
      outputLines.push("");
    });

    document.getElementById("optimizeOutput").value = outputLines.join("\n").trim();
    document.getElementById("optimizeDistance").textContent =
      `${data.routes.length} routes · ${data.total_distance_miles} miles total`;

    document.getElementById("resultsEmptyHint").classList.add("hidden");
    document.getElementById("optimizeDistance").classList.remove("hidden");
    document.getElementById("optimizeOutput").classList.remove("hidden");
    document.querySelector(".results-output-label").classList.remove("hidden");

    const successMessage =
      data.split_mode === "balanced_distance"
        ? `${data.routes.length} routes optimized with balanced driving distance.`
        : `${data.routes.length} routes optimized successfully.`;

    showResultBanner(
      "optimizeResultBanner",
      successMessage,
      "results"
    );
    completeProgress("Routes optimized.");
  } catch (error) {
    console.error("Failed to optimize route:", error);
    alert(`Error: ${error.message}`);
  } finally {
    hideProgress();
    setButtonLoading("optimizeSubmit", false);
    updateButtonStates();
  }
}

const SANITIZED_ADDRESS_RE =
  /^.+,\s*[^,]+,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?\s*$/i;
const LEADING_NUMBER_RE = /^\s*\d+[.)]\s*/;
const APT_IN_ADDRESS_RE =
  /(?:,\s*(?:Apt|Apartment|Unit|Ste|Suite|Rm|Room)\.?\s*#?\s*[\w-]+|\s+(?:Apt|Apartment|Unit|Ste|Suite|Rm|Room)\.?\s*#?\s*[\w-]+|\s+#\s*[\w-]+)/i;

function isSanitizedAddressLine(line) {
  if (LEADING_NUMBER_RE.test(line)) {
    return false;
  }
  if (APT_IN_ADDRESS_RE.test(line)) {
    return false;
  }
  return SANITIZED_ADDRESS_RE.test(line);
}

function validateSanitizedAddresses(text) {
  const valid = [];
  const invalid = [];

  for (const line of text.split("\n")) {
    const stripped = line.trim();
    if (!stripped) {
      continue;
    }
    if (isSanitizedAddressLine(stripped)) {
      valid.push(stripped);
    } else {
      invalid.push(stripped);
    }
  }

  return { valid, invalid };
}

function formatSanitizedAddressError(invalidAddresses) {
  const preview = invalidAddresses.slice(0, 5).join("\n");
  const suffix =
    invalidAddresses.length > 5
      ? `\n...and ${invalidAddresses.length - 5} more`
      : "";
  return (
    "Each address must use the format: street address, city, ST ZIP\n" +
    "ZIP is optional. Example: 2249 Washington Ave, Bronx, NY 10456\n" +
    "Example without ZIP: 1101 Forest Ave, Bronx, NY\n\n" +
    "Fix these lines:\n" +
    preview +
    suffix
  );
}

async function geocodeAddresses() {
  if (!validateApiKeys(["googleMapsGeo", "googleMapsJs"])) {
    return;
  }

  const addressText = document.getElementById("addressInput").value;
  const { valid: addresses, invalid } = validateSanitizedAddresses(addressText);

  if (addresses.length === 0) {
    alert("Enter at least one address.");
    return;
  }

  if (invalid.length > 0) {
    alert(formatSanitizedAddressError(invalid));
    return;
  }

  const apiKeys = getApiKeys();
  const mapElement = document.getElementById("map");
  const spinnerContainer = document.getElementById("spinnerContainer");

  showProgress({
    title: "Plotting addresses",
    message: "Preparing map...",
    estimateSeconds: Math.max(20, addresses.length * 2),
    steps: ["Preparing map...", "Geocoding addresses...", "Adding markers..."],
  });
  setButtonLoading("addressSubmit", true);

  try {
    if (!map) {
      spinnerContainer.style.display = "flex";
      await loadGoogleMapsIfNeeded();
      spinnerContainer.style.display = "none";
    }

    updateProgressMessage("Geocoding addresses...");

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
      if (errorData.invalid_addresses?.length) {
        throw new Error(formatSanitizedAddressError(errorData.invalid_addresses));
      }
      throw new Error(errorData.error || "Failed to geocode addresses");
    }

    updateProgressMessage("Adding markers...");
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

    const formattedAddresses = results
      .filter((result) => !result.error && result.address)
      .map((result) => result.address)
      .join("\n");
    if (formattedAddresses) {
      document.getElementById("addressInput").value = formattedAddresses;
    }

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

    completeProgress("Addresses plotted on map.");
  } catch (error) {
    console.error("Failed to geocode addresses:", error);
    alert(`Error: ${error.message}`);
  } finally {
    spinnerContainer.style.display = "none";
    hideProgress();
    setButtonLoading("addressSubmit", false);
  }
}

function countOptimizeStops() {
  const addressText = document.getElementById("optimizeInput").value;
  const { valid: stops } = validateSanitizedAddresses(addressText);
  return stops.length;
}

function syncOptimizeEndFromStart() {
  const endInput = document.getElementById("optimizeEndInput");
  const sameAsStart = document.getElementById("optimizeEndSameAsStart").checked;
  if (sameAsStart) {
    endInput.value = document.getElementById("optimizeStartInput").value;
    endInput.disabled = true;
  } else {
    endInput.disabled = false;
  }
  updateRouteCapacitySummary();
  updateButtonStates();
}

function hasValidOptimizeEndpoints() {
  const startAddress = document.getElementById("optimizeStartInput").value.trim();
  const endAddress = document.getElementById("optimizeEndInput").value.trim();
  return (
    startAddress &&
    endAddress &&
    isSanitizedAddressLine(startAddress) &&
    isSanitizedAddressLine(endAddress)
  );
}

function getSplitMode() {
  const splitModeInput = document.getElementById("splitMode");
  return splitModeInput?.value === "balanced_distance"
    ? "balanced_distance"
    : "manual";
}

function getNumRoutes() {
  const numRoutesInput = document.getElementById("numRoutes");
  return Math.min(
    50,
    Math.max(1, parseInt(numRoutesInput?.value, 10) || 1)
  );
}

function getRouteCapacities() {
  const inputs = document.querySelectorAll("[data-route-capacity]");
  return Array.from(inputs).map((input) => {
    const value = parseInt(input.value, 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  });
}

function distributeStopsEvenly(totalStops, numRoutes) {
  if (numRoutes <= 0 || totalStops <= 0) {
    return Array.from({ length: Math.max(numRoutes, 0) }, () => 1);
  }

  const base = Math.floor(totalStops / numRoutes);
  const remainder = totalStops % numRoutes;
  return Array.from({ length: numRoutes }, (_, index) => {
    return base + (index < remainder ? 1 : 0);
  });
}

function renderRouteCapacityInputs() {
  const numRoutesInput = document.getElementById("numRoutes");
  const container = document.getElementById("routeCapacitiesContainer");
  const splitMode = getSplitMode();
  const numRoutes = getNumRoutes();
  numRoutesInput.value = String(numRoutes);

  if (splitMode === "balanced_distance") {
    container.innerHTML = "";
    updateRouteCapacitySummary();
    return;
  }

  const existingValues = getRouteCapacities();
  const totalStops = countOptimizeStops();
  const existingSum = existingValues.reduce((sum, value) => sum + value, 0);
  const defaultValues =
    existingValues.length === numRoutes && existingSum === totalStops
      ? existingValues
      : distributeStopsEvenly(totalStops, numRoutes);

  container.innerHTML = "";

  for (let routeIndex = 0; routeIndex < numRoutes; routeIndex += 1) {
    const field = document.createElement("div");
    field.className = "field-group";

    const label = document.createElement("label");
    label.setAttribute("for", `routeCapacity${routeIndex + 1}`);
    label.textContent = `Route ${routeIndex + 1} stops`;

    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.id = `routeCapacity${routeIndex + 1}`;
    input.dataset.routeCapacity = "true";
    input.value = String(defaultValues[routeIndex] || 1);
    input.addEventListener("input", () => {
      updateRouteCapacitySummary();
      updateButtonStates();
    });

    field.appendChild(label);
    field.appendChild(input);
    container.appendChild(field);
  }

  updateRouteCapacitySummary();
}

function updateRouteCapacitySummary() {
  const summary = document.getElementById("routeCapacitySummary");
  const totalStops = countOptimizeStops();
  const routeCapacities = getRouteCapacities();
  const capacitySum = routeCapacities.reduce((sum, value) => sum + value, 0);
  const splitMode = getSplitMode();
  const numRoutes = getNumRoutes();

  summary.classList.remove(
    "route-capacity-summary--match",
    "route-capacity-summary--mismatch"
  );

  if (totalStops === 0) {
    summary.textContent = "No stops listed yet.";
    return;
  }

  if (!hasValidOptimizeEndpoints()) {
    summary.textContent = `${totalStops} stop${totalStops === 1 ? "" : "s"} listed. Add valid start and end addresses.`;
    return;
  }

  if (splitMode === "balanced_distance") {
    if (totalStops < numRoutes) {
      summary.textContent =
        `${totalStops} stop${totalStops === 1 ? "" : "s"} for ${numRoutes} routes — ` +
        "add more stops or reduce the number of routes.";
      summary.classList.add("route-capacity-summary--mismatch");
      return;
    }

    summary.textContent =
      `${totalStops} stops across ${numRoutes} routes — ` +
      "optimizer will split stops to balance driving distance.";
    summary.classList.add("route-capacity-summary--match");
    return;
  }

  if (routeCapacities.length === 0) {
    summary.textContent = `${totalStops} stop${totalStops === 1 ? "" : "s"} to assign.`;
    return;
  }

  if (capacitySum === totalStops) {
    summary.textContent = `${capacitySum} of ${totalStops} stops assigned. Ready to optimize.`;
    summary.classList.add("route-capacity-summary--match");
    return;
  }

  summary.textContent = `${capacitySum} of ${totalStops} stops assigned. Adjust route stops to match.`;
  summary.classList.add("route-capacity-summary--mismatch");
}

function updateButtonStates() {
  const blobInput = document.getElementById("blobInput");
  const addressInput = document.getElementById("addressInput");
  const optimizeInput = document.getElementById("optimizeInput");
  const optimizeStartInput = document.getElementById("optimizeStartInput");
  const optimizeEndInput = document.getElementById("optimizeEndInput");
  const optimizeEndSameAsStart = document.getElementById("optimizeEndSameAsStart");
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

  const optimizeHasStops = optimizeInput.value.trim() !== "";
  const totalStops = countOptimizeStops();
  const splitMode = getSplitMode();
  const numRoutes = getNumRoutes();
  const capacitySum = getRouteCapacities().reduce((sum, value) => sum + value, 0);
  const capacitiesMatch = totalStops > 0 && capacitySum === totalStops;
  const balancedReady = totalStops >= numRoutes;
  const optimizeReady =
    splitMode === "balanced_distance" ? balancedReady : capacitiesMatch;
  const endpointsReady = hasValidOptimizeEndpoints();
  optimizeButton.disabled =
    !optimizeHasStops || !endpointsReady || !optimizeReady;
  clearOptimizeButton.disabled =
    !optimizeHasStops &&
    !optimizeStartInput.value.trim() &&
    !optimizeEndInput.value.trim();
}

function clearBlobInput() {
  document.getElementById("blobInput").value = "";
  document.getElementById("convertOutput").innerHTML = "";
  document.getElementById("convertOutputMeta").textContent = "";
  document.getElementById("convertOutputSection").classList.add("hidden");
  const copyBtn = document.getElementById("copyConvertOutput");
  copyBtn.textContent = "Copy";
  copyBtn.classList.remove("btn-copy--success");
  updateButtonStates();
}

async function copyConvertOutput() {
  const text = document.getElementById("addressInput").value;
  if (!text.trim()) {
    return;
  }

  const copyBtn = document.getElementById("copyConvertOutput");

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const temp = document.createElement("textarea");
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);
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
  document.getElementById("optimizeStartInput").value = "";
  document.getElementById("optimizeEndInput").value = "";
  document.getElementById("optimizeEndSameAsStart").checked = true;
  syncOptimizeEndFromStart();
  document.getElementById("numRoutes").value = "2";
  document.getElementById("splitMode").value = "manual";
  renderRouteCapacityInputs();
  document.getElementById("optimizeOutput").value = "";
  document.getElementById("optimizeDistance").textContent = "";
  document.getElementById("optimizeDistance").classList.add("hidden");
  document.getElementById("optimizeOutput").classList.add("hidden");
  document.querySelector(".results-output-label").classList.add("hidden");
  document.getElementById("resultsEmptyHint").classList.remove("hidden");
  hideResultBanner("optimizeResultBanner");
  clearTabBadge("results");
  savePersistedSettings();
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

function initPasswordVisibilityToggles() {
  const eyeShowIcon = `
    <svg class="password-toggle__icon password-toggle__icon--show" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>`;
  const eyeHideIcon = `
    <svg class="password-toggle__icon password-toggle__icon--hide" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18"></path>
      <path d="M10.58 10.58A3 3 0 0 0 12 15a3 3 0 0 0 2.42-4.42"></path>
      <path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a18.27 18.27 0 0 1-2.16 3.19"></path>
      <path d="M6.61 6.61A18.48 18.48 0 0 0 2 12s3.5 7 10 7a10.66 10.66 0 0 0 5.39-1.43"></path>
    </svg>`;

  document.querySelectorAll(".field-group input[type='password']").forEach((input) => {
    if (input.closest(".password-field")) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "password-field";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "password-toggle";
    toggleButton.setAttribute("aria-label", "Show API key");
    toggleButton.setAttribute("aria-pressed", "false");
    toggleButton.innerHTML = eyeShowIcon + eyeHideIcon;

    toggleButton.addEventListener("click", () => {
      const isVisible = input.type === "text";
      input.type = isVisible ? "password" : "text";
      toggleButton.setAttribute("aria-pressed", String(!isVisible));
      toggleButton.setAttribute(
        "aria-label",
        isVisible ? "Show API key" : "Hide API key"
      );
    });

    wrapper.appendChild(toggleButton);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  const addressInput = document.getElementById("addressInput");
  const blobInput = document.getElementById("blobInput");
  const optimizeInput = document.getElementById("optimizeInput");
  const optimizeStartInput = document.getElementById("optimizeStartInput");
  const optimizeEndInput = document.getElementById("optimizeEndInput");
  const optimizeEndSameAsStart = document.getElementById("optimizeEndSameAsStart");
  const numRoutesInput = document.getElementById("numRoutes");
  const splitModeInput = document.getElementById("splitMode");

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  initPasswordVisibilityToggles();
  loadPersistedSettings();
  bindPersistedSettings();

  addressInput.addEventListener("input", updateButtonStates);
  addressInput.addEventListener("paste", () => setTimeout(updateButtonStates, 0));

  blobInput.addEventListener("input", updateButtonStates);
  blobInput.addEventListener("paste", () => setTimeout(updateButtonStates, 0));

  optimizeInput.addEventListener("input", () => {
    renderRouteCapacityInputs();
    updateButtonStates();
  });
  optimizeInput.addEventListener("paste", () => {
    setTimeout(() => {
      renderRouteCapacityInputs();
      updateButtonStates();
    }, 0);
  });

  optimizeStartInput.addEventListener("input", syncOptimizeEndFromStart);
  optimizeStartInput.addEventListener("paste", () => {
    setTimeout(syncOptimizeEndFromStart, 0);
  });
  optimizeEndInput.addEventListener("input", () => {
    updateRouteCapacitySummary();
    updateButtonStates();
  });
  optimizeEndInput.addEventListener("paste", () => {
    setTimeout(() => {
      updateRouteCapacitySummary();
      updateButtonStates();
    }, 0);
  });
  optimizeEndSameAsStart.addEventListener("change", syncOptimizeEndFromStart);

  numRoutesInput.addEventListener("input", () => {
    renderRouteCapacityInputs();
    updateButtonStates();
  });

  splitModeInput.addEventListener("change", () => {
    renderRouteCapacityInputs();
    updateButtonStates();
  });

  renderRouteCapacityInputs();
  syncOptimizeEndFromStart();

  document.getElementById("googleMapsGeoApiKey").addEventListener("input", () => {
    syncGoogleMapsGeoKeys("googleMapsGeoApiKey");
  });
  document.getElementById("googleMapsGeoApiKeyOptimize").addEventListener("input", () => {
    syncGoogleMapsGeoKeys("googleMapsGeoApiKeyOptimize");
  });

  updateButtonStates();

  window.addEventListener("resize", () => {
    if (activeTab === "map" && map) {
      google.maps.event.trigger(map, "resize");
    }
  });
});
