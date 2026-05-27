#!/usr/bin/env python3
import json
import urllib.request
import urllib.error
import sys

BASE = "http://localhost:3001"
ACTIVE_PROJECT = "d070b885-6d96-4d61-b841-1e50108da907"
HATCH_PROJECT = "553cedb5-693f-4067-8af2-eed261dd5373"

results = []

def call(method, path, data=None, headers=None):
    url = BASE + path
    req = urllib.request.Request(url, method=method)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    if data and method in ("POST", "PATCH", "PUT"):
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(data).encode("utf-8")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            try:
                return resp.status, json.loads(body)
            except:
                return resp.status, body[:500]
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(body)
        except:
            return e.code, body[:500]
    except Exception as e:
        return None, str(e)

def test(name, method, path, data=None):
    status, body = call(method, path, data)
    ok = status is not None and 200 <= status < 300
    results.append({"name": name, "method": method, "path": path, "status": status, "ok": ok})
    icon = "✅" if ok else "❌"
    print(f"{icon} [{status}] {method} {path}")
    if not ok:
        print(f"   Response: {json.dumps(body, ensure_ascii=False, indent=2)[:400]}")
    return status, body

print("=" * 60)
print("NARRATIVEOS API COMPREHENSIVE TEST")
print(f"Active Project: {ACTIVE_PROJECT}")
print(f"Hatching Project: {HATCH_PROJECT}")
print("=" * 60)

# ── 1. Health & Core ──
test("Health Check", "GET", "/health")
test("Project List", "GET", "/projects")

# ── 2. Project CRUD ──
_, project = test("Get Active Project", "GET", f"/projects/{ACTIVE_PROJECT}")
_, hproject = test("Get Hatching Project", "GET", f"/projects/{HATCH_PROJECT}")

# ── 3. Hatching APIs ──
test("Hatch Proposals (hatching)", "GET", f"/hatch/{HATCH_PROJECT}/proposals")
test("Hatch Engines (hatching)", "GET", f"/hatch/{HATCH_PROJECT}/engines")

# ── 4. Settings ──
test("Settings (active)", "GET", f"/settings/{ACTIVE_PROJECT}")
test("Settings (hatching)", "GET", f"/settings/{HATCH_PROJECT}")

# ── 5. Outline APIs ──
test("Outline List", "GET", f"/outline/{ACTIVE_PROJECT}/outline")
test("Volume List", "GET", f"/outline/{ACTIVE_PROJECT}/volumes")

# ── 6. Notifications & Logs ──
test("Notifications", "GET", f"/notifications/{ACTIVE_PROJECT}")
test("LLM Logs", "GET", "/llm-logs?limit=3")

# ── 7. NEW: World & Memory Query ──
test("World Query", "GET", f"/world/query/{ACTIVE_PROJECT}")
test("Memory Query (filter)", "GET", f"/memory/query/{ACTIVE_PROJECT}?type=power_system")

# ── 8. Sessions ──
test("Sessions List", "GET", f"/sessions?project_id={ACTIVE_PROJECT}")

# ── 9. Scheduler ──
test("Scheduler Run", "POST", f"/scheduler/{ACTIVE_PROJECT}/run")

# ── 10. Summary ──
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
passed = sum(1 for r in results if r["ok"])
total = len(results)
print(f"Passed: {passed}/{total}")
for r in results:
    if not r["ok"]:
        print(f"  ❌ FAIL: {r['name']} [{r['status']}] {r['method']} {r['path']}")

sys.exit(0 if passed == total else 1)
