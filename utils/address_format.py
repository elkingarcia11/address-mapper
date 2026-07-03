import re

_LEADING_NUMBER_RE = re.compile(r"^\s*\d+[.)]\s*")
_BULLET_PREFIX_RE = re.compile(r"^\s*[-•*]\s*")
_APT_PATTERNS = (
    re.compile(
        r",\s*(?:Apt|Apartment|Unit|Ste|Suite|Rm|Room)\.?\s*#?\s*[\w-]+",
        re.I,
    ),
    re.compile(
        r"\s+(?:Apt|Apartment|Unit|Ste|Suite|Rm|Room)\.?\s*#?\s*[\w-]+",
        re.I,
    ),
    re.compile(r"\s+#\s*[\w-]+"),
    re.compile(r",\s*(?:Floor|Fl|Bldg|Building)\.?\s*[\w-]+", re.I),
)
_COUNTRY_SUFFIX_RE = re.compile(
    r",\s*(?:USA|U\.S\.A\.?|United States of America|United States)\.?\s*$",
    re.I,
)
_US_ADDRESS_RE = re.compile(
    r"^(?P<street>.+?),\s*(?P<city>[^,]+),\s*(?P<state>[A-Z]{2})\s+(?P<zip>\d{5}(?:-\d{4})?)\s*$",
    re.I,
)


def format_address(street, city, state, zip_code):
    """Format as: street address, city, state zip"""
    street = " ".join(street.split()).strip().rstrip(",")
    city = " ".join(city.split()).strip().rstrip(",")
    state = state.strip().upper()
    zip_code = zip_code.strip()
    if not street:
        return ""
    if city and state and zip_code:
        return f"{street}, {city}, {state} {zip_code}"
    if city and state:
        return f"{street}, {city}, {state}"
    if city:
        return f"{street}, {city}"
    return street


def cleanse_address_line(line):
    line = _BULLET_PREFIX_RE.sub("", line)
    line = _LEADING_NUMBER_RE.sub("", line.strip())
    for pattern in _APT_PATTERNS:
        line = pattern.sub("", line)
    line = _COUNTRY_SUFFIX_RE.sub("", line)
    line = re.sub(r"\s{2,}", " ", line).strip().rstrip(",")
    return re.sub(r"\s*,\s*", ", ", line)


def standardize_address_line(line):
    cleaned = cleanse_address_line(line)
    if not cleaned:
        return ""
    match = _US_ADDRESS_RE.match(cleaned)
    if match:
        return format_address(
            match.group("street"),
            match.group("city"),
            match.group("state"),
            match.group("zip"),
        )
    return cleaned


def parse_sanitized_address(line):
    """Return a formatted address when line matches sanitized input, else None."""
    line = line.strip()
    if not line:
        return None
    if _LEADING_NUMBER_RE.match(line) or _BULLET_PREFIX_RE.match(line):
        return None
    for pattern in _APT_PATTERNS:
        if pattern.search(line):
            return None
    if _COUNTRY_SUFFIX_RE.search(line):
        return None
    match = _US_ADDRESS_RE.match(line)
    if not match:
        return None
    formatted = format_address(
        match.group("street"),
        match.group("city"),
        match.group("state"),
        match.group("zip"),
    )
    if line != formatted and line.lower() != formatted.lower():
        return None
    return formatted


def is_sanitized_address(line):
    return parse_sanitized_address(line) is not None


def validate_sanitized_address_lines(lines):
    valid = []
    invalid = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        parsed = parse_sanitized_address(stripped)
        if parsed:
            valid.append(parsed)
        else:
            invalid.append(stripped)
    return valid, invalid


def normalize_extracted_addresses(raw):
    lines = []
    for line in raw.splitlines():
        standardized = standardize_address_line(line)
        if standardized:
            lines.append(standardized)
    return "\n".join(lines)
