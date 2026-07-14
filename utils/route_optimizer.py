"""Reorder stops between a fixed start and end using OR-Tools."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from utils.address_format import format_address

import openrouteservice
from ortools.constraint_solver import pywrapcp, routing_enums_pb2

ORS_MATRIX_PAIR_LIMIT = 3500
DEFAULT_ORS_CHUNK_SIZE = 50
DEFAULT_STOP_SERVICE_SECONDS = 15 * 60
DEFAULT_TRUCK_PROFILE = "driving-hgv"
VALID_TRUCK_ROUTE_MODES = frozenset({"local_delivery", "cross_city"})
DEFAULT_TRUCK_ROUTE_MODE = "local_delivery"
DEFAULT_TRUCK_RESTRICTIONS = {
    "height": 4.0,
    "width": 2.6,
    "length": 13.7,
    "weight": 18.0,
}


@dataclass(frozen=True)
class Location:
    lat: float
    lng: float
    street_address_1: str = ""
    city: str = ""
    state: str = ""
    zip: str = ""

    @classmethod
    def from_value(cls, value: Sequence[float] | dict) -> "Location":
        if isinstance(value, dict):
            if "lat" not in value or "lng" not in value:
                raise ValueError(
                    f"Location object must include 'lat' and 'lng', got {value!r}"
                )
            return cls(
                lat=float(value["lat"]),
                lng=float(value["lng"]),
                street_address_1=str(value.get("street_address_1", "")),
                city=str(value.get("city", "")),
                state=str(value.get("state", "")),
                zip=str(value.get("zip", "")),
            )
        if isinstance(value, (list, tuple)) and len(value) == 2:
            return cls(lat=float(value[0]), lng=float(value[1]))
        raise ValueError(
            f"Expected [lat, lng] or location object, got {value!r}"
        )

    def to_ors(self) -> list[float]:
        return [self.lng, self.lat]

    @property
    def label(self) -> str:
        formatted = format_address(
            self.street_address_1, self.city, self.state, self.zip
        )
        if formatted:
            return formatted
        return f"{self.lat}, {self.lng}"

    def to_dict(self) -> dict:
        return {
            "lat": self.lat,
            "lng": self.lng,
            "street_address_1": self.street_address_1,
            "city": self.city,
            "state": self.state,
            "zip": self.zip,
            "label": self.label,
        }


def _ors_distance_to_int(value: float | None, from_idx: int, to_idx: int) -> int:
    if from_idx == to_idx:
        return 0
    if value is None:
        raise RuntimeError(
            f"No route found between location {from_idx} and {to_idx}."
        )
    return int(round(value))


def normalize_truck_route_mode(raw_mode: str | None) -> str:
    mode = (raw_mode or DEFAULT_TRUCK_ROUTE_MODE).strip()
    if mode not in VALID_TRUCK_ROUTE_MODES:
        raise ValueError(
            "truck_route_mode must be 'local_delivery' or 'cross_city'."
        )
    return mode


def build_truck_routing_options(truck_route_mode: str) -> dict:
    """Build ORS HGV options for delivery vs cross-city truck routing."""
    mode = normalize_truck_route_mode(truck_route_mode)
    vehicle_type = "delivery" if mode == "local_delivery" else "hgv"
    return {
        "vehicle_type": vehicle_type,
        "profile_params": {
            "restrictions": dict(DEFAULT_TRUCK_RESTRICTIONS),
        },
    }


def build_route_matrices_ors(
    locations: Sequence[Location],
    *,
    api_key: str,
    profile: str = DEFAULT_TRUCK_PROFILE,
    truck_route_mode: str = DEFAULT_TRUCK_ROUTE_MODE,
    chunk_size: int = DEFAULT_ORS_CHUNK_SIZE,
) -> tuple[list[list[int]], list[list[int]]]:
    """Build road distance (meters) and duration (seconds) matrices via ORS."""
    n = len(locations)
    if n == 0:
        return [], []

    if chunk_size * chunk_size > ORS_MATRIX_PAIR_LIMIT:
        raise ValueError(
            f"chunk_size must be <= {int(ORS_MATRIX_PAIR_LIMIT ** 0.5)} "
            f"so each matrix request stays within ORS limits."
        )

    ors_locations = [loc.to_ors() for loc in locations]
    distance_matrix = [[0] * n for _ in range(n)]
    duration_matrix = [[0] * n for _ in range(n)]
    client = openrouteservice.Client(key=api_key, timeout=300)
    routing_options = build_truck_routing_options(truck_route_mode)

    for src_start in range(0, n, chunk_size):
        sources = list(range(src_start, min(src_start + chunk_size, n)))
        for dst_start in range(0, n, chunk_size):
            destinations = list(range(dst_start, min(dst_start + chunk_size, n)))
            pair_count = len(sources) * len(destinations)
            if pair_count > ORS_MATRIX_PAIR_LIMIT:
                raise RuntimeError(
                    f"Matrix chunk exceeds ORS limit ({pair_count} > "
                    f"{ORS_MATRIX_PAIR_LIMIT}). Reduce chunk_size."
                )

            response = client.request(
                f"/v2/matrix/{profile}/json",
                {},
                post_json={
                    "locations": ors_locations,
                    "sources": sources,
                    "destinations": destinations,
                    "metrics": ["distance", "duration"],
                    "units": "m",
                    "options": routing_options,
                },
            )
            distances = response["distances"]
            durations = response["durations"]
            for i, src_idx in enumerate(sources):
                for j, dst_idx in enumerate(destinations):
                    distance_matrix[src_idx][dst_idx] = _ors_distance_to_int(
                        distances[i][j], src_idx, dst_idx
                    )
                    duration_matrix[src_idx][dst_idx] = _ors_distance_to_int(
                        durations[i][j], src_idx, dst_idx
                    )

    return distance_matrix, duration_matrix


def build_distance_matrix_ors(
    locations: Sequence[Location],
    *,
    api_key: str,
    profile: str = DEFAULT_TRUCK_PROFILE,
    truck_route_mode: str = DEFAULT_TRUCK_ROUTE_MODE,
    chunk_size: int = DEFAULT_ORS_CHUNK_SIZE,
) -> list[list[int]]:
    distance_matrix, _ = build_route_matrices_ors(
        locations,
        api_key=api_key,
        profile=profile,
        truck_route_mode=truck_route_mode,
        chunk_size=chunk_size,
    )
    return distance_matrix


def _route_leg_totals(
    ordered_indices: Sequence[int],
    distance_matrix: list[list[int]],
    duration_matrix: list[list[int]],
) -> tuple[int, int]:
    total_distance = 0
    total_duration = 0
    for left, right in zip(ordered_indices, ordered_indices[1:]):
        total_distance += distance_matrix[left][right]
        total_duration += duration_matrix[left][right]
    return total_distance, total_duration


def compute_vrp_time_limit(
    num_stops: int,
    num_routes: int,
    *,
    minimum: int = 30,
    maximum: int = 300,
) -> int:
    """Scale solver time with problem size for multi-stop VRP."""
    return min(maximum, max(minimum, 15 + num_stops + num_routes * 10))


def _max_route_cost_cap(
    cost_matrix: list[list[int]],
    max_stops_on_route: int,
    service_seconds: int = 0,
) -> int:
    max_leg = max(
        cost_matrix[i][j]
        for i in range(len(cost_matrix))
        for j in range(len(cost_matrix))
        if i != j
    )
    return (max_leg + service_seconds) * (max_stops_on_route + 2)


def _solve_routing_model(
    routing: pywrapcp.RoutingModel,
    *,
    time_limit_seconds: int,
):
    strategies = (
        routing_enums_pb2.FirstSolutionStrategy.AUTOMATIC,
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC,
        routing_enums_pb2.FirstSolutionStrategy.SAVINGS,
        routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION,
    )
    remaining = max(10, time_limit_seconds)

    for index, strategy in enumerate(strategies):
        attempts_left = len(strategies) - index
        attempt_seconds = max(10, remaining // attempts_left)
        remaining -= attempt_seconds

        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = strategy
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.FromSeconds(attempt_seconds)

        solution = routing.SolveWithParameters(search_parameters)
        if solution is not None:
            return solution

    return None


def optimize_route(
    start: Location,
    stops: Sequence[Location],
    end: Location,
    *,
    api_key: str,
    profile: str = DEFAULT_TRUCK_PROFILE,
    truck_route_mode: str = DEFAULT_TRUCK_ROUTE_MODE,
    time_limit_seconds: int = 5,
    ors_chunk_size: int = DEFAULT_ORS_CHUNK_SIZE,
    stop_service_seconds: int = DEFAULT_STOP_SERVICE_SECONDS,
) -> dict:
    locations = [start, *stops, end]

    if len(locations) == 2:
        distance_matrix, duration_matrix = build_route_matrices_ors(
            locations,
            api_key=api_key,
            profile=profile,
            truck_route_mode=truck_route_mode,
            chunk_size=ors_chunk_size,
        )
        total_distance, total_duration = _route_leg_totals(
            [0, 1], distance_matrix, duration_matrix
        )
        ordered_locations = [start.to_dict(), end.to_dict()]
        return {
            "ordered_locations": ordered_locations,
            "ordered_coordinates": [
                [start.lat, start.lng],
                [end.lat, end.lng],
            ],
            "ordered_indices": [0, 1],
            "stop_order": [],
            "total_distance_meters": total_distance,
            "total_duration_seconds": total_duration,
            "total_service_seconds": 0,
            "total_time_seconds": total_duration,
            "stop_service_seconds": stop_service_seconds,
            "optimization_metric": "total_time",
            "distance_source": "openrouteservice",
            "profile": profile,
            "truck_route_mode": normalize_truck_route_mode(truck_route_mode),
        }

    distance_matrix, duration_matrix = build_route_matrices_ors(
        locations,
        api_key=api_key,
        profile=profile,
        truck_route_mode=truck_route_mode,
        chunk_size=ors_chunk_size,
    )
    num_locations = len(locations)
    start_index = 0
    end_index = num_locations - 1

    manager = pywrapcp.RoutingIndexManager(
        num_locations,
        1,
        [start_index],
        [end_index],
    )
    routing = pywrapcp.RoutingModel(manager)

    def time_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        travel = duration_matrix[from_node][to_node]
        service = stop_service_seconds if to_node != end_index else 0
        return travel + service

    transit_callback_index = routing.RegisterTransitCallback(time_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_parameters.time_limit.FromSeconds(time_limit_seconds)

    solution = routing.SolveWithParameters(search_parameters)
    if solution is None:
        raise RuntimeError("No solution found. Check coordinates and try again.")

    ordered_indices: list[int] = []
    index = routing.Start(0)

    while not routing.IsEnd(index):
        node = manager.IndexToNode(index)
        ordered_indices.append(node)
        index = solution.Value(routing.NextVar(index))

    ordered_indices.append(manager.IndexToNode(index))
    total_distance, total_duration = _route_leg_totals(
        ordered_indices, distance_matrix, duration_matrix
    )

    ordered_coordinates = [
        [locations[i].lat, locations[i].lng] for i in ordered_indices
    ]
    ordered_locations = [locations[i].to_dict() for i in ordered_indices]
    stop_order = [i - 1 for i in ordered_indices if 0 < i < end_index]

    total_service = len(stop_order) * stop_service_seconds
    total_time = total_duration + total_service

    return {
        "ordered_locations": ordered_locations,
        "ordered_coordinates": ordered_coordinates,
        "ordered_indices": ordered_indices,
        "stop_order": stop_order,
        "total_distance_meters": total_distance,
        "total_duration_seconds": total_duration,
        "total_service_seconds": total_service,
        "total_time_seconds": total_time,
        "stop_service_seconds": stop_service_seconds,
        "optimization_metric": "total_time",
        "distance_source": "openrouteservice",
        "profile": profile,
        "truck_route_mode": normalize_truck_route_mode(truck_route_mode),
    }


def optimize_multi_route(
    depot: Location,
    stops: Sequence[Location],
    route_capacities: Sequence[int],
    *,
    api_key: str,
    profile: str = DEFAULT_TRUCK_PROFILE,
    truck_route_mode: str = DEFAULT_TRUCK_ROUTE_MODE,
    time_limit_seconds: int = 30,
    ors_chunk_size: int = DEFAULT_ORS_CHUNK_SIZE,
    stop_service_seconds: int = DEFAULT_STOP_SERVICE_SECONDS,
) -> dict:
    """Split stops across multiple routes from a shared depot, minimizing total time.

    Total time per route is drive time plus a fixed service time per stop.
    Every route starts and ends at the same depot location.
    """
    if not route_capacities:
        raise ValueError("At least one route capacity is required.")
    if any(capacity < 1 for capacity in route_capacities):
        raise ValueError("Each route must have at least one stop.")
    if sum(route_capacities) != len(stops):
        raise ValueError(
            f"Sum of route capacities ({sum(route_capacities)}) must equal "
            f"the number of stops ({len(stops)})."
        )

    num_routes = len(route_capacities)
    locations = [depot, *stops]
    depot_index = 0

    distance_matrix, duration_matrix = build_route_matrices_ors(
        locations,
        api_key=api_key,
        profile=profile,
        truck_route_mode=truck_route_mode,
        chunk_size=ors_chunk_size,
    )

    manager = pywrapcp.RoutingIndexManager(
        len(locations),
        num_routes,
        depot_index,
    )
    routing = pywrapcp.RoutingModel(manager)

    def duration_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return duration_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(duration_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    def stop_demand_callback(from_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        return 0 if from_node == depot_index else 1

    stop_callback_index = routing.RegisterUnaryTransitCallback(stop_demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        stop_callback_index,
        0,
        list(route_capacities),
        True,
        "StopsDimension",
    )

    stops_dimension = routing.GetDimensionOrDie("StopsDimension")
    for vehicle_id, target_stops in enumerate(route_capacities):
        routing.solver().Add(
            stops_dimension.CumulVar(routing.End(vehicle_id)) == target_stops
        )

    solution = _solve_routing_model(
        routing,
        time_limit_seconds=time_limit_seconds,
    )
    if solution is None:
        raise RuntimeError(
            "No solution found. Check that route capacities sum to the total "
            "number of stops and that all coordinates are reachable."
        )

    routes: list[dict] = []
    total_distance = 0
    total_duration = 0
    total_service = 0

    for vehicle_id in range(num_routes):
        ordered_indices: list[int] = []
        index = routing.Start(vehicle_id)

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            ordered_indices.append(node)
            index = solution.Value(routing.NextVar(index))

        ordered_indices.append(manager.IndexToNode(index))
        route_distance, route_duration = _route_leg_totals(
            ordered_indices, distance_matrix, duration_matrix
        )
        total_distance += route_distance
        total_duration += route_duration

        stop_indices = [i for i in ordered_indices if i != depot_index]
        route_service = len(stop_indices) * stop_service_seconds
        route_time = route_duration + route_service
        total_service += route_service
        routes.append({
            "route_number": vehicle_id + 1,
            "target_stops": route_capacities[vehicle_id],
            "ordered_indices": ordered_indices,
            "stop_indices": stop_indices,
            "ordered_locations": [locations[i].to_dict() for i in ordered_indices],
            "ordered_coordinates": [
                [locations[i].lat, locations[i].lng] for i in ordered_indices
            ],
            "stop_order": [i - 1 for i in stop_indices],
            "ordered_stop_labels": [locations[i].label for i in stop_indices],
            "distance_meters": route_distance,
            "duration_seconds": route_duration,
            "service_seconds": route_service,
            "time_seconds": route_time,
        })

    return {
        "depot": depot.to_dict(),
        "routes": routes,
        "route_capacities": list(route_capacities),
        "split_mode": "manual",
        "total_distance_meters": total_distance,
        "total_duration_seconds": total_duration,
        "total_service_seconds": total_service,
        "total_time_seconds": total_duration + total_service,
        "stop_service_seconds": stop_service_seconds,
        "optimization_metric": "total_time",
        "distance_source": "openrouteservice",
        "profile": profile,
        "truck_route_mode": normalize_truck_route_mode(truck_route_mode),
    }


def optimize_balanced_multi_route(
    depot: Location,
    stops: Sequence[Location],
    num_routes: int,
    *,
    api_key: str,
    profile: str = DEFAULT_TRUCK_PROFILE,
    truck_route_mode: str = DEFAULT_TRUCK_ROUTE_MODE,
    time_limit_seconds: int = 30,
    ors_chunk_size: int = DEFAULT_ORS_CHUNK_SIZE,
    balance_weight: int = 100,
    stop_service_seconds: int = DEFAULT_STOP_SERVICE_SECONDS,
) -> dict:
    """Split stops across routes from a shared depot, balancing total time per route.

    Total time is drive time plus a fixed service time per stop. Stops are
    assigned to minimize the combined total time while keeping each route's
    total time as equal as possible. Every route starts and ends at the depot.
    """
    if num_routes < 1:
        raise ValueError("At least one route is required.")
    if not stops:
        raise ValueError("At least one stop is required.")
    if num_routes > len(stops):
        raise ValueError(
            f"Cannot create {num_routes} routes with only {len(stops)} stop(s). "
            "Each route needs at least one stop."
        )

    locations = [depot, *stops]
    depot_index = 0

    distance_matrix, duration_matrix = build_route_matrices_ors(
        locations,
        api_key=api_key,
        profile=profile,
        truck_route_mode=truck_route_mode,
        chunk_size=ors_chunk_size,
    )

    manager = pywrapcp.RoutingIndexManager(
        len(locations),
        num_routes,
        depot_index,
    )
    routing = pywrapcp.RoutingModel(manager)

    def time_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        travel = duration_matrix[from_node][to_node]
        service = stop_service_seconds if to_node != depot_index else 0
        return travel + service

    transit_callback_index = routing.RegisterTransitCallback(time_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    max_route_time = _max_route_cost_cap(
        duration_matrix, len(stops), service_seconds=stop_service_seconds
    )
    routing.AddDimension(
        transit_callback_index,
        0,
        max_route_time,
        True,
        "Time",
    )
    time_dimension = routing.GetDimensionOrDie("Time")
    time_dimension.SetGlobalSpanCostCoefficient(balance_weight)

    def stop_demand_callback(from_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        return 0 if from_node == depot_index else 1

    stop_callback_index = routing.RegisterUnaryTransitCallback(stop_demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        stop_callback_index,
        0,
        [len(stops)] * num_routes,
        True,
        "StopsDimension",
    )
    stops_dimension = routing.GetDimensionOrDie("StopsDimension")
    for vehicle_id in range(num_routes):
        routing.solver().Add(
            stops_dimension.CumulVar(routing.End(vehicle_id)) >= 1
        )

    solution = _solve_routing_model(
        routing,
        time_limit_seconds=time_limit_seconds,
    )
    if solution is None:
        raise RuntimeError(
            "No solution found for the current stops and route count. "
            "Verify all addresses geocoded correctly and are reachable by truck."
        )

    routes: list[dict] = []
    total_distance = 0
    total_duration = 0
    total_service = 0

    for vehicle_id in range(num_routes):
        ordered_indices: list[int] = []
        index = routing.Start(vehicle_id)

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            ordered_indices.append(node)
            index = solution.Value(routing.NextVar(index))

        ordered_indices.append(manager.IndexToNode(index))
        route_distance, route_duration = _route_leg_totals(
            ordered_indices, distance_matrix, duration_matrix
        )
        total_distance += route_distance
        total_duration += route_duration

        stop_indices = [i for i in ordered_indices if i != depot_index]
        route_service = len(stop_indices) * stop_service_seconds
        route_time = route_duration + route_service
        total_service += route_service
        routes.append({
            "route_number": vehicle_id + 1,
            "target_stops": len(stop_indices),
            "ordered_indices": ordered_indices,
            "stop_indices": stop_indices,
            "ordered_locations": [locations[i].to_dict() for i in ordered_indices],
            "ordered_coordinates": [
                [locations[i].lat, locations[i].lng] for i in ordered_indices
            ],
            "stop_order": [i - 1 for i in stop_indices],
            "ordered_stop_labels": [locations[i].label for i in stop_indices],
            "distance_meters": route_distance,
            "duration_seconds": route_duration,
            "service_seconds": route_service,
            "time_seconds": route_time,
        })

    return {
        "depot": depot.to_dict(),
        "routes": routes,
        "route_capacities": [route["target_stops"] for route in routes],
        "split_mode": "balanced_duration",
        "num_routes": num_routes,
        "total_distance_meters": total_distance,
        "total_duration_seconds": total_duration,
        "total_service_seconds": total_service,
        "total_time_seconds": total_duration + total_service,
        "stop_service_seconds": stop_service_seconds,
        "optimization_metric": "total_time",
        "distance_source": "openrouteservice",
        "profile": profile,
        "truck_route_mode": normalize_truck_route_mode(truck_route_mode),
    }
