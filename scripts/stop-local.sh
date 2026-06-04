#!/usr/bin/env bash
# stop-local.sh — stopper alle lokale utviklingsservere.

pkill -f 'uvicorn main:app'    2>/dev/null && echo "Backend stoppet"    || echo "Backend kjørte ikke"
pkill -f 'uvicorn agent.main:app' 2>/dev/null && echo "Agent stoppet"  || echo "Agent kjørte ikke"
pkill -f 'vite'                2>/dev/null && echo "Frontend stoppet"   || echo "Frontend kjørte ikke"
