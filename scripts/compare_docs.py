import json
import re

with open("api_documentation.md", "r", encoding="utf-8") as f:
    doc = f.read()

doc_eps = set()
# Find all occurrences of HTTP Method and Path in markdown blocks
sections = doc.split("### ")
for s in sections[1:]:
    m = re.search(r"HTTP Method\*\*: `([A-Z]+)`", s)
    p = re.search(r"Path\*\*: `([^`]+)`", s)
    if m and p:
        doc_eps.add((m.group(1).upper(), p.group(1).strip()))

with open("openapi.json", "r", encoding="utf-8") as f:
    schema = json.load(f)

openapi_eps = set()
for path, spec in schema.get("paths", {}).items():
    for method in spec:
        if method in ["get", "post", "put", "delete", "patch"]:
            openapi_eps.add((method.upper(), path))

api_v1_openapi = set(e for e in openapi_eps if e[1].startswith("/api/v1") or e[1] in ["/", "/health"])

print(f"Doc endpoints count: {len(doc_eps)}")
print(f"OpenAPI v1 endpoints count: {len(api_v1_openapi)}")

missing_in_doc = api_v1_openapi - doc_eps
print(f"\nMissing in api_documentation.md ({len(missing_in_doc)}):")
for m, p in sorted(list(missing_in_doc)):
    print(f"  {m} {p}")

extra_in_doc = doc_eps - api_v1_openapi
print(f"\nIn doc but not in openapi.json ({len(extra_in_doc)}):")
for m, p in sorted(list(extra_in_doc)):
    print(f"  {m} {p}")
