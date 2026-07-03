def _component(components, *types, use_short=False):
    for component in components:
        if any(t in component["types"] for t in types):
            return component["short_name" if use_short else "long_name"]
    return ""


def extract_street_address(result):
    """Extracts the street address from the geocoding result."""
    address_components = result["address_components"]
    street_number = _component(address_components, "street_number")
    route = _component(address_components, "route")
    street_address = f"{street_number} {route}".strip()
    if not street_address:
        print("Warning: Could not extract street address for",
              result['formatted_address'])
    return street_address


def extract_address_fields(result):
    """Extract structured address fields from a geocoding result."""
    components = result["address_components"]
    return {
        "street_address_1": extract_street_address(result),
        "city": _component(
            components, "locality", "sublocality", "neighborhood"
        ),
        "state": _component(components, "administrative_area_level_1", use_short=True),
        "zip": _component(components, "postal_code"),
    }
