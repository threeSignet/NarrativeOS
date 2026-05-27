#!/usr/bin/env python3
"""SSE client for testing NarrativeOS streaming endpoints"""
import sys
import json
import urllib.request

def stream_sse(url, method="POST", data=None, timeout=300):
    req = urllib.request.Request(url, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(data).encode("utf-8")
    req.add_header("Accept", "text/event-stream")
    
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        print(f"[SSE] Connected: {resp.status}")
        buffer = ""
        for chunk in resp:
            text = chunk.decode("utf-8", errors="replace")
            buffer += text
            while "\n\n" in buffer:
                block, buffer = buffer.split("\n\n", 1)
                lines = [l.strip() for l in block.split("\n") if l.strip()]
                event_type = "message"
                data_payload = ""
                for line in lines:
                    if line.startswith("event:"):
                        event_type = line[6:].strip()
                    elif line.startswith("data:"):
                        data_payload = line[5:].strip()
                if data_payload:
                    try:
                        parsed = json.loads(data_payload)
                        print(f"[{event_type}] {json.dumps(parsed, ensure_ascii=False)[:300]}")
                        if event_type == "done":
                            return parsed
                        if event_type == "error":
                            print(f"[ERROR] {parsed}")
                            return None
                    except json.JSONDecodeError:
                        print(f"[{event_type}] {data_payload[:200]}")
        print("[SSE] Stream ended without 'done' event")
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test-sse.py <url> [json_body]")
        sys.exit(1)
    url = sys.argv[1]
    data = json.loads(sys.argv[2]) if len(sys.argv) > 2 else None
    result = stream_sse(url, data=data)
    if result:
        print("\n=== FINAL RESULT ===")
        print(json.dumps(result, ensure_ascii=False, indent=2)[:2000])
