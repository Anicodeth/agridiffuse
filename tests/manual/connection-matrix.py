"""Test every connection type + direction against the live server.
Run from project root: python tests/manual/connection-matrix.py"""
import json
import urllib.request

BASE = "http://localhost:3000"


def post(path: str, body: dict | None = None) -> tuple[int, dict]:
    data = json.dumps(body).encode() if body is not None else b""
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"} if body else {},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def get(path: str) -> dict:
    with urllib.request.urlopen(f"{BASE}{path}", timeout=30) as r:
        return json.loads(r.read())


def edges_for(snapshot, type_):
    return [e for e in snapshot["edges"] if e["type"] == type_]


def edge_exists(snapshot, type_, a, b):
    """Symmetric existence check — either direction."""
    for e in snapshot["edges"]:
        if e["type"] != type_:
            continue
        if (e["source"] == a and e["target"] == b) or (e["source"] == b and e["target"] == a):
            return True
    return False


def find_unconnected_pair(snapshot, kind_a, kind_b, type_):
    """Find a pair of node ids of the given kinds with no `type_` edge between them."""
    a_ids = [n["id"] for n in snapshot["nodes"] if n["type"] == kind_a]
    b_ids = [n["id"] for n in snapshot["nodes"] if n["type"] == kind_b]
    for a in a_ids:
        for b in b_ids:
            if a == b:
                continue
            if not edge_exists(snapshot, type_, a, b):
                return a, b
    return None


PASS, FAIL = "✓", "✗"
out = []
fails = 0


def check(name, ok, detail=""):
    global fails
    out.append(f"  {PASS if ok else FAIL} {name}  {detail}")
    if not ok:
        fails += 1


snapshot = get("/api/graph")
print(f"Starting state: {len(snapshot['nodes'])} nodes, {len(snapshot['edges'])} edges\n")

# ── 1. Forward + reverse for each valid combo ────────────────────────────
print("--- Forward direction ---")

# Expert -> Farmer (forward ADVISES)
pair = find_unconnected_pair(snapshot, "expert", "farmer", "ADVISES")
if pair:
    status, body = post("/api/edge", {"source": pair[0], "target": pair[1]})
    snapshot = get("/api/graph")
    check(
        f"expert->farmer (ADVISES forward) {pair[0]} -> {pair[1]}",
        status == 200 and edge_exists(snapshot, "ADVISES", *pair),
        f"status={status} edge_id={body.get('edge', {}).get('id', '-')}",
    )

# Expert -> Practice (forward RECOMMENDS)
pair = find_unconnected_pair(snapshot, "expert", "practice", "RECOMMENDS")
if pair:
    status, body = post("/api/edge", {"source": pair[0], "target": pair[1]})
    snapshot = get("/api/graph")
    check(
        f"expert->practice (RECOMMENDS forward) {pair[0]} -> {pair[1]}",
        status == 200 and edge_exists(snapshot, "RECOMMENDS", *pair),
        f"status={status} edge_id={body.get('edge', {}).get('id', '-')}",
    )

# Farmer -> Farmer (KNOWS)
pair = find_unconnected_pair(snapshot, "farmer", "farmer", "KNOWS")
if pair:
    status, body = post("/api/edge", {"source": pair[0], "target": pair[1]})
    snapshot = get("/api/graph")
    check(
        f"farmer->farmer (KNOWS) {pair[0]} -> {pair[1]}",
        status == 200 and edge_exists(snapshot, "KNOWS", *pair),
        f"status={status} edge_id={body.get('edge', {}).get('id', '-')}",
    )

print("\n--- Reverse direction (server should auto-flip) ---")

# Farmer -> Expert (should auto-flip to ADVISES)
pair = find_unconnected_pair(snapshot, "expert", "farmer", "ADVISES")
if pair:
    # NOTE: dragging the farmer first then expert — opposite direction
    status, body = post("/api/edge", {"source": pair[1], "target": pair[0]})
    snapshot = get("/api/graph")
    edge = body.get("edge", {})
    check(
        f"farmer->expert (auto-flips to ADVISES) {pair[1]} -> {pair[0]}",
        status == 200 and edge.get("type") == "ADVISES" and edge.get("source") == pair[0],
        f"status={status} flipped_to=({edge.get('source')}->{edge.get('target')})",
    )

# Practice -> Expert (auto-flip to RECOMMENDS)
pair = find_unconnected_pair(snapshot, "expert", "practice", "RECOMMENDS")
if pair:
    status, body = post("/api/edge", {"source": pair[1], "target": pair[0]})
    snapshot = get("/api/graph")
    edge = body.get("edge", {})
    check(
        f"practice->expert (auto-flips to RECOMMENDS) {pair[1]} -> {pair[0]}",
        status == 200 and edge.get("type") == "RECOMMENDS" and edge.get("source") == pair[0],
        f"status={status} flipped_to=({edge.get('source')}->{edge.get('target')})",
    )

print("\n--- Rejections (these should fail with a clear reason) ---")

# Two experts
experts = [n["id"] for n in snapshot["nodes"] if n["type"] == "expert"]
if len(experts) >= 2:
    status, body = post("/api/edge", {"source": experts[0], "target": experts[1]})
    check(
        "expert <-> expert is rejected",
        status == 400,
        f"status={status} reason={body.get('error', '-')}",
    )

# Two practices
practices = [n["id"] for n in snapshot["nodes"] if n["type"] == "practice"]
if len(practices) >= 2:
    status, body = post("/api/edge", {"source": practices[0], "target": practices[1]})
    check(
        "practice <-> practice is rejected",
        status == 400,
        f"status={status} reason={body.get('error', '-')}",
    )

# Farmer <-> Practice (ADOPTED is engine-only, manual creation rejected)
farmers = [n["id"] for n in snapshot["nodes"] if n["type"] == "farmer"]
if farmers and practices:
    status, body = post("/api/edge", {"source": farmers[0], "target": practices[0]})
    check(
        "farmer <-> practice is rejected (ADOPTED is engine-only)",
        status == 400,
        f"status={status} reason={body.get('error', '-')}",
    )

# Same pair twice → 409 dup
pair = find_unconnected_pair(snapshot, "farmer", "farmer", "KNOWS")
if pair:
    status1, _ = post("/api/edge", {"source": pair[0], "target": pair[1]})
    status2, body = post("/api/edge", {"source": pair[0], "target": pair[1]})
    check(
        f"same farmer pair twice → 409 dup {pair[0]} <-> {pair[1]}",
        status1 == 200 and status2 == 409,
        f"status1={status1} status2={status2}",
    )

# Same pair, REVERSED, should still 409 (symmetric dedup)
pair = find_unconnected_pair(snapshot, "farmer", "farmer", "KNOWS")
if pair:
    status1, _ = post("/api/edge", {"source": pair[0], "target": pair[1]})
    snapshot = get("/api/graph")
    status2, body = post("/api/edge", {"source": pair[1], "target": pair[0]})
    check(
        f"same farmer pair reverse direction → 409 (symmetric) {pair[1]} <-> {pair[0]}",
        status1 == 200 and status2 == 409,
        f"status1={status1} status2={status2}",
    )

# Self connection
if farmers:
    status, body = post("/api/edge", {"source": farmers[0], "target": farmers[0]})
    check(
        "self-connection rejected",
        status == 400,
        f"status={status} reason={body.get('error', '-')}",
    )

print("\n--- New nodes -> existing nodes (create-then-connect pipeline) ---")

# Add new farmer, immediately connect to an existing expert (most common
# build-mode workflow). This tests read-after-write consistency across Aura.
status, body = post(
    "/api/node",
    {"type": "farmer", "name": "TestFarmer", "region": "Test"},
)
new_farmer_id = body.get("node", {}).get("id")
if status == 200 and new_farmer_id:
    expert = next((n["id"] for n in snapshot["nodes"] if n["type"] == "expert"), None)
    status2, body2 = post("/api/edge", {"source": expert, "target": new_farmer_id})
    snapshot = get("/api/graph")
    check(
        f"new farmer -> existing expert connects after create  ({new_farmer_id})",
        status2 == 200 and edge_exists(snapshot, "ADVISES", expert, new_farmer_id),
        f"status={status2}",
    )

# Add new expert, connect to existing practice
status, body = post(
    "/api/node",
    {"type": "expert", "name": "TestExpert", "domain": "Testing"},
)
new_expert_id = body.get("node", {}).get("id")
if status == 200 and new_expert_id:
    practice = next((n["id"] for n in snapshot["nodes"] if n["type"] == "practice"), None)
    status2, body2 = post("/api/edge", {"source": new_expert_id, "target": practice})
    snapshot = get("/api/graph")
    check(
        f"new expert -> existing practice  ({new_expert_id})",
        status2 == 200 and edge_exists(snapshot, "RECOMMENDS", new_expert_id, practice),
        f"status={status2}",
    )

print("\n--- Summary ---")
for line in out:
    print(line)
print(f"\n{len(out) - fails} passed / {fails} failed")
