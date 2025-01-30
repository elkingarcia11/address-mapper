def extract_street_address(result):
    """Extracts the street address from the geocoding result."""
    address_components = result["address_components"]
    street_number = next(
        (c["long_name"]
         for c in address_components if "street_number" in c["types"]), ""
    )
    route = next(
        (c["long_name"]
         for c in address_components if "route" in c["types"]), ""
    )
    street_address = f"{street_number} {route}".strip()
    if not street_address:
        print("Warning: Could not extract street address for",
              result['formatted_address'])
    return street_address
