#!/bin/bash
# Starts the FitFlow recipe server on port 8000.
set -e
cd "$(dirname "$0")"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is missing. Install it with:  brew install ffmpeg"
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created server/.env. Open it, paste your ANTHROPIC_API_KEY, then run ./start.sh again."
  exit 1
fi

# Whisper needs PyTorch, which only supports established Python versions.
# Very new Pythons (3.14+) usually don't have it yet, so use 3.12 / 3.11.
PY=""
for candidate in python3.12 python3.11 /opt/homebrew/bin/python3.12 /usr/local/bin/python3.12; do
  if command -v "$candidate" >/dev/null 2>&1; then PY="$candidate"; break; fi
done
if [ -z "$PY" ]; then
  echo "This server needs Python 3.12. Install it with:"
  echo "  brew install python@3.12"
  echo "then run ./start.sh again."
  exit 1
fi

# Rebuild the environment if it was made with a different Python.
if [ -d .venv ] && ! .venv/bin/python -c 'import sys; exit(0 if sys.version_info[:2] in [(3,11),(3,12)] else 1)' 2>/dev/null; then
  echo "Rebuilding the Python environment with $PY…"
  rm -rf .venv
fi

if [ ! -d .venv ]; then
  echo "First run: setting up Python packages (this takes a few minutes)…"
  "$PY" -m venv .venv
fi
source .venv/bin/activate
pip install -q --upgrade pip wheel
# openai-whisper's installer still uses pkg_resources, which newer setuptools removed.
pip install -q "setuptools<81"
pip install -q --no-build-isolation openai-whisper
pip install -q -r requirements.txt
# TikTok and Instagram change often; a fresh yt-dlp keeps downloads working.
pip install -q --upgrade yt-dlp

IP=$(ipconfig getifaddr en0 2>/dev/null || echo "your-mac-ip")
echo ""
echo "Recipe server running. Your phone will reach it at http://$IP:8000"
echo "Leave this window open while you use the app. Press Ctrl+C to stop."
echo ""
exec uvicorn main:app --host 0.0.0.0 --port 8000
