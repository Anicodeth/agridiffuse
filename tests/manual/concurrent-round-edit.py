"""Reproduce the 'lost connections' race: kick off a round, immediately
create an edge during the round, verify both survive.

Run: python tests/manual/concurrent-round-edit.py
"""
import json
import threading
import time
import urllib.request

BASE = "http://localhost:3000"


def post(path, body=None):
    data = json.dumps(body).encode() if body is not None else b""
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"} if body else {},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def get(path):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=60) as r:
        return json.loads(r.read())


def find_unconnected_farmer_pair(snapshot):
    farmers = [n["id"] for n in snapshot["nodes"] if n["type"] == "farmer"]
    existing = set()
    for e in snapshot["edges"]:
        if e["type"] == "KNOWS":
            existing.add(frozenset([e["source"], e["target"]]))
    for i, a in enumerate(farmers):
        for b in farmers[i + 1:]:
            if frozenset([a, b]) not in existing:
                return a, b
    return None


print("Resetting graph...")
post("/api/reset")
snapshot = get("/api/graph")
print(f"After reset: {len(snapshot['edges'])} edges, round={snapshot['round']}")

pair = find_unconnected_farmer_pair(snapshot)
if not pair:
    raise SystemExit("no unconnected farmer pair available")
print(f"\nWill connect: {pair[0]} -> {pair[1]} (KNOWS)")

# Kick off the round in a background thread (it takes ~7s with live Featherless)
round_result = {}

def run_round():
    print("  [round] starting POST /api/round...")
    t0 = time.time()
    status, body = post("/api/round")
    elapsed = time.time() - t0
    print(f"  [round] done in {elapsed:.1f}s, status={status}")
    round_result["status"] = status
    round_result["body"] = body
    round_result["elapsed"] = elapsed


round_thread = threading.Thread(target=run_round)
round_thread.start()

# Wait briefly so the round route reads its snapshot at T0
time.sleep(1.0)

# Create a concurrent edge — this is what the user does mid-round
print(f"\n  [edit] POST /api/edge while round is in flight...")
t1 = time.time()
status, edge_body = post("/api/edge", {"source": pair[0], "target": pair[1]})
elapsed1 = time.time() - t1
print(f"  [edit] returned in {elapsed1:.1f}s, status={status}")

# Wait for round to finish
round_thread.join()

# Verify
print("\n--- Verifying ---")
final = get("/api/graph")
edge_in_final = any(
    e["type"] == "KNOWS"
    and (
        (e["source"] == pair[0] and e["target"] == pair[1])
        or (e["source"] == pair[1] and e["target"] == pair[0])
    )
    for e in final["edges"]
)
edge_in_round_response = any(
    e["type"] == "KNOWS"
    and (
        (e["source"] == pair[0] and e["target"] == pair[1])
        or (e["source"] == pair[1] and e["target"] == pair[0])
    )
    for e in round_result["body"]["snapshot"]["edges"]
) if round_result.get("body") else False

print(f"  user's edge in subsequent /api/graph read:  {edge_in_final}")
print(f"  user's edge in round POST response payload: {edge_in_round_response}")
print(f"  round result newAdoptions: {round_result['body']['result']['newAdoptions']}")
print(f"  round result round: {round_result['body']['snapshot']['round']}")

if edge_in_final and edge_in_round_response:
    print("\n[PASS] both survive — race fixed!")
else:
    print("\n[FAIL] something lost:")
    print(f"  in Aura: {edge_in_final}")
    print(f"  in round response: {edge_in_round_response}")
