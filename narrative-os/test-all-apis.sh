#!/bin/bash
set -e

BASE="http://localhost:3001"
ACTIVE_PROJECT="d070b885-6d96-4d61-b841-1e50108da907"
HATCH_PROJECT="553cedb5-693f-4067-8af2-eed261dd5373"

echo "========== 1. HEALTH CHECK =========="
curl -s "$BASE/health" | jq .

echo ""
echo "========== 2. PROJECT LIST =========="
curl -s "$BASE/projects" | jq '.[0:3] | map({id: .id, title: .title, status: .status})'

echo ""
echo "========== 3. GET ACTIVE PROJECT =========="
curl -s "$BASE/projects/$ACTIVE_PROJECT" | jq '{id: .id, title: .title, status: .status, genre: .genre}'

echo ""
echo "========== 4. GET HATCHING PROJECT =========="
curl -s "$BASE/projects/$HATCH_PROJECT" | jq '{id: .id, title: .title, status: .status, genre: .genre}'

echo ""
echo "========== 5. HATCH - PROPOSALS (hatching) =========="
curl -s "$BASE/hatch/$HATCH_PROJECT/proposals" | jq 'map({id: .id, type: .type, title: .title, status: .status})'

echo ""
echo "========== 6. HATCH - ENGINES (hatching) =========="
curl -s "$BASE/hatch/$HATCH_PROJECT/engines" | jq .

echo ""
echo "========== 7. SETTINGS (active) =========="
curl -s "$BASE/settings/$ACTIVE_PROJECT" | jq '{locked: .locked, itemCount: (.items | length), types: [.items[].type]}'

echo ""
echo "========== 8. OUTLINE LIST (active) =========="
curl -s "$BASE/outline/$ACTIVE_PROJECT/outline" | jq .

echo ""
echo "========== 9. VOLUME LIST (active) =========="
curl -s "$BASE/outline/$ACTIVE_PROJECT/volumes" | jq .

echo ""
echo "========== 10. NOTIFICATIONS (active) =========="
curl -s "$BASE/notifications/$ACTIVE_PROJECT" | jq '{total: .total, unread: .unread, byPriority: .byPriority}'

echo ""
echo "========== 11. LLM LOGS =========="
curl -s "$BASE/llm-logs?limit=3" | jq 'map({id: .id, caller: .caller, model: .model, status: .status})'

echo ""
echo "========== 12. WORLD QUERY (active) =========="
curl -s "$BASE/world/query/$ACTIVE_PROJECT" | jq '{projectTitle: .projectTitle, totalItems: .totalItems, totalRelations: .totalRelations, engines: (.engines | keys)}'

echo ""
echo "========== 13. MEMORY QUERY (active) =========="
curl -s "$BASE/memory/query/$ACTIVE_PROJECT?type=power_system" | jq '{total: .total, items: [.items[] | {name: .name, type: .type}]}'

echo ""
echo "========== 14. SESSIONS =========="
curl -s "$BASE/sessions?project_id=$ACTIVE_PROJECT" | jq '.[0:3]'

echo ""
echo "========== 15. SCHEDULER STATUS =========="
curl -s -X POST "$BASE/scheduler/$ACTIVE_PROJECT/run" | jq .

echo ""
echo "========== ALL BASIC TESTS COMPLETED =========="
