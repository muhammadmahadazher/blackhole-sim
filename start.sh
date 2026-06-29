#!/usr/bin/env bash
# Black Hole Explorer — launcher for macOS & Linux.
# Serves the folder on http://localhost:8765 and opens your browser.
cd "$(dirname "$0")" || exit 1
URL="http://localhost:8765"

echo ""
echo "  ◉  Black Hole Explorer"
echo "     opening $URL   (press Ctrl+C to stop)"
echo ""

# open the browser shortly after the server starts
( sleep 1
  if command -v open       >/dev/null 2>&1; then open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
  fi ) >/dev/null 2>&1 &

# prefer Node, fall back to Python 3
if command -v node >/dev/null 2>&1; then
  node serve.js 8765
elif command -v python3 >/dev/null 2>&1; then
  python3 serve.py 8765
else
  echo "Please install Node.js (https://nodejs.org) or Python 3, then run this again."
  exit 1
fi
