#!/bin/bash
echo "Testing AI Aggregator at https://aia-client.pages.dev/"
echo "=== Test 1: Homepage Load ==="
curl -s -o /dev/null -w "%{http_code}" https://aia-client.pages.dev/
echo
echo "=== Test 2: Manifest Load ==="
curl -s -o /dev/null -w "%{http_code}" https://aia-client.pages.dev/manifest.json
echo
echo "=== Test 3: Service Worker Load ==="
curl -s -o /dev/null -w "%{http_code}" https://aia-client.pages.dev/sw.js
echo
echo "=== Test 4: Main App JS Load ==="
curl -s -o /dev/null -w "%{http_code}" https://aia-client.pages.dev/src/app.js
echo
echo "=== Test 5: CSS Load ==="
curl -s -o /dev/null -w "%{http_code}" https://aia-client.pages.dev/src/styles/theme.css
echo
