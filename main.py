"""
FitFlow recipe server.

Takes a TikTok / Instagram / YouTube Shorts link and returns a clean recipe:
  1. yt-dlp fetches the video, caption and cover image
  2. If the caption doesn't contain the recipe, Whisper transcribes the audio
  3. Claude turns caption + transcript into structured JSON with macros,
     and looks at a few video frames to pick the best "finished dish" photo
  4. Falls back to the cover image, then a Pexels stock photo, for the thumbnail

Run it with ./start.sh (see README).
"""

from __future__ import annotations

import base64
import glob
import io
import json
import logging
import os
import re
import subprocess
import tempfile
import threading
from typing import Any

import anthropic
import requests
import yt_dlp
from dotenv import load_dotenv
import traceback

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_WORKSPACE_ID = os.getenv("ANTHROPIC_WORKSPACE_ID", "").strip()  # only for keys made without a workspace
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-5-5")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")  # tiny | base | small | medium
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")
# Instagram often asks you to be logged in. Set this to "safari", "chrome" or
# "firefox" and yt-dlp borrows that browser's Instagram login.
COOKIES_FROM_BROWSER = os.getenv("COOKIES_FROM_BROWSER", "").strip().lower()

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("fitflow")

app = FastAPI(title="FitFlow recipe server")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    """Send the real reason back to the app instead of a bare '500'."""
    log.error("Unexpected error:\n%s", traceback.format_exc())
    return JSONResponse(status_code=500, content={"detail": f"Server error: {type(exc).__name__}: {exc}"})


class ExtractRequest(BaseModel):
    url: str


# ---------------------------------------------------------------- Whisper ----

_whisper_model = None
_whisper_lock = threading.Lock()


def transcribe(media_path: str) -> str:
    """Speech-to-text with OpenAI Whisper (runs locally on your Mac, free)."""
    global _whisper_model
    import whisper  # imported lazily: loading torch is slow

    with _whisper_lock:
        if _whisper_model is None:
            log.info("Loading Whisper '%s' model (first time only)…", WHISPER_MODEL)
            _whisper_model = whisper.load_model(WHISPER_MODEL)
        result = _whisper_model.transcribe(media_path, fp16=False)
    return (result.get("text") or "").strip()


# ------------------------------------------------------------- Downloading --

def download(url: str, workdir: str) -> dict[str, Any]:
    opts: dict[str, Any] = {
        "outtmpl": os.path.join(workdir, "video.%(ext)s"),
        # Small mp4 is plenty for audio + a few frames.
        "format": "best[height<=720][ext=mp4]/best[height<=720]/best",
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "socket_timeout": 30,
    }
    if COOKIES_FROM_BROWSER:
        opts["cookiesfrombrowser"] = (COOKIES_FROM_BROWSER,)

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
    except yt_dlp.utils.DownloadError as e:
        msg = str(e)
        log.warning("Download failed: %s", msg)
        if "login" in msg.lower() or "cookies" in msg.lower() or "private" in msg.lower():
            raise HTTPException(
                400,
                "This post needs a login to view. On your Mac, log in to Instagram in Safari or Chrome, "
                "then set COOKIES_FROM_BROWSER in server/.env and restart the server.",
            )
        raise HTTPException(400, "Couldn't open that link. Check it's a public TikTok, Reel or Short.")

    if info.get("_type") == "playlist" and info.get("entries"):
        info = next(e for e in info["entries"] if e)

    videos = [p for p in glob.glob(os.path.join(workdir, "video.*")) if not p.endswith(".part")]
    return {
        "caption": (info.get("description") or "").strip(),
        "title": (info.get("title") or "").strip(),
        "uploader": info.get("uploader") or info.get("channel") or "",
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration") or 0,
        "video_path": videos[0] if videos else None,
    }


def caption_has_recipe(caption: str) -> bool:
    """Rough check: does the caption already list ingredients and method?"""
    lines = [l.strip() for l in caption.splitlines() if l.strip()]
    qty = re.compile(
        r"(\d+\s*(g|kg|ml|l|oz|lb|cups?|tbsp|tsp|tablespoons?|teaspoons?|cloves?|cans?)\b)|"
        r"(^[-•*▪️✅🔸]\s*\w)|(^\d+[.)]\s+\w)|(½|¼|¾)",
        re.IGNORECASE,
    )
    hits = sum(1 for l in lines if qty.search(l))
    return hits >= 5 and len(caption) > 150


# ----------------------------------------------------------------- Frames ---

def to_data_uri(img: Image.Image, max_width: int = 720, quality: int = 72) -> str:
    img = img.convert("RGB")
    if img.width > max_width:
        img = img.resize((max_width, round(img.height * max_width / img.width)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def extract_frames(video_path: str, duration: float, workdir: str, count: int = 6) -> list[Image.Image]:
    """Grab evenly spaced frames, weighted to the end where the finished dish usually is."""
    if not duration:
        try:
            out = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video_path],
                capture_output=True, text=True, timeout=30,
            )
            duration = float(out.stdout.strip() or 0)
        except Exception:
            duration = 0
    if not duration:
        return []

    frames: list[Image.Image] = []
    for i in range(count):
        t = duration * (0.2 + 0.75 * i / max(count - 1, 1))
        path = os.path.join(workdir, f"frame{i}.jpg")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", video_path,
             "-frames:v", "1", "-q:v", "3", path],
            timeout=60,
        )
        if os.path.exists(path):
            frames.append(Image.open(path).copy())
    return frames


def fetch_image(url: str | None) -> Image.Image | None:
    if not url:
        return None
    try:
        r = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        return Image.open(io.BytesIO(r.content))
    except Exception:
        return None


def pexels_photo(query: str) -> Image.Image | None:
    """Free, properly licensed food photo by recipe name (needs a free Pexels API key)."""
    if not PEXELS_API_KEY or not query:
        return None
    try:
        r = requests.get(
            "https://api.pexels.com/v1/search",
            params={"query": query, "per_page": 1, "orientation": "landscape"},
            headers={"Authorization": PEXELS_API_KEY},
            timeout=20,
        )
        r.raise_for_status()
        photos = r.json().get("photos") or []
        return fetch_image(photos[0]["src"]["large"]) if photos else None
    except Exception:
        return None


# ----------------------------------------------------------------- Claude ---

RECIPE_TOOL = {
    "name": "save_recipe",
    "description": "Save the recipe extracted from the video.",
    "input_schema": {
        "type": "object",
        "properties": {
            "is_recipe": {"type": "boolean", "description": "False if the video doesn't contain a recipe."},
            "name": {"type": "string", "description": "Short, appetising recipe name, e.g. 'High Protein Creamy Pasta'."},
            "description": {"type": "string", "description": "One or two sentences describing the dish."},
            "servings": {"type": "integer", "minimum": 1},
            "prep_minutes": {"type": ["integer", "null"]},
            "cook_minutes": {"type": ["integer", "null"]},
            "difficulty": {"type": ["string", "null"], "enum": ["Easy", "Medium", "Hard", None]},
            "category": {"type": ["string", "null"], "enum": ["breakfast", "lunch", "dinner", "snacks", None]},
            "ingredients": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "e.g. 'Chicken breast'"},
                        "amount": {"type": "string", "description": "Metric where possible, e.g. '500 g', '1 can (400 g)', '2 tbsp'"},
                    },
                    "required": ["name", "amount"],
                },
            },
            "steps": {"type": "array", "items": {"type": "string"}, "description": "Clear numbered-style steps, no numbering prefix."},
            "macros_per_serving": {
                "type": "object",
                "properties": {
                    "calories": {"type": "number"},
                    "protein_g": {"type": "number"},
                    "carbs_g": {"type": "number"},
                    "fat_g": {"type": "number"},
                    "fiber_g": {"type": ["number", "null"]},
                    "sugar_g": {"type": ["number", "null"]},
                },
                "required": ["calories", "protein_g", "carbs_g", "fat_g"],
            },
            "best_frame_index": {
                "type": ["integer", "null"],
                "description": "Index of the frame that best shows the finished dish, or null if none show food clearly.",
            },
            "image_search_query": {"type": "string", "description": "2-4 word stock-photo search, e.g. 'chicken burrito bowl'."},
        },
        "required": ["is_recipe", "name", "description", "servings", "ingredients", "steps", "macros_per_serving", "image_search_query"],
    },
}

SYSTEM = """You turn short-form cooking videos into clean, accurate recipes for a fitness app.

- Use the caption and the audio transcript together. The transcript may have speech-to-text errors; fix obvious ones (e.g. "grandpa mesan" -> "grana padano").
- If amounts aren't stated, estimate sensible ones from context and keep them realistic for the servings.
- Use metric units (g, ml) where it makes sense; keep spoons and cans as-is.
- Work out macros per serving from the ingredient amounts using standard nutrition values (USDA-style, raw weights unless stated as cooked). Include cooking oils and sauces. Calories should roughly equal 4*protein + 4*carbs + 9*fat.
- Steps should be short and clear, in order. Don't invent steps that aren't implied.
- Pick a category based on when the dish is normally eaten.
- Ignore promo codes, hashtags, "follow for more", and sponsor text."""


def structure_recipe(src: dict[str, Any], transcript: str, frames: list[Image.Image]) -> dict[str, Any]:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(500, "ANTHROPIC_API_KEY is missing in server/.env")

    # Keys created without a workspace need the workspace ID sent alongside them.
    headers = {"anthropic-workspace-id": ANTHROPIC_WORKSPACE_ID} if ANTHROPIC_WORKSPACE_ID else None
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY, default_headers=headers)
    text = (
        f"Video title: {src['title'] or '(none)'}\n"
        f"Creator: {src['uploader'] or '(unknown)'}\n\n"
        f"CAPTION:\n{src['caption'] or '(no caption)'}\n\n"
        f"AUDIO TRANSCRIPT:\n{transcript or '(not transcribed: caption had the recipe)'}\n"
    )
    content: list[dict[str, Any]] = []
    for i, f in enumerate(frames):
        content.append({"type": "text", "text": f"Frame {i}:"})
        data = to_data_uri(f, max_width=512, quality=65).split(",", 1)[1]
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}})
    content.append({"type": "text", "text": text + "\nExtract the recipe and call save_recipe."})

    def call(force_tool: bool):
        kwargs: dict[str, Any] = {}
        if force_tool:
            kwargs["tool_choice"] = {"type": "tool", "name": "save_recipe"}
        return client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4000,
            system=SYSTEM + "\n\nAlways answer by calling the save_recipe tool. "
            "If you can't call it, reply with only the JSON object for its input.",
            tools=[RECIPE_TOOL],
            messages=[{"role": "user", "content": content}],
            **kwargs,
        )

    try:
        try:
            msg = call(force_tool=True)
        except anthropic.BadRequestError as e:
            # Some models don't allow forcing a specific tool; ask nicely instead.
            if "tool_choice" not in str(e).lower():
                raise
            log.info("Model doesn't support forced tool use, retrying without it…")
            msg = call(force_tool=False)
    except anthropic.AuthenticationError:
        raise HTTPException(500, "Your Anthropic API key isn't valid. Check ANTHROPIC_API_KEY in server/.env, then restart the server.")
    except anthropic.PermissionDeniedError:
        raise HTTPException(500, "Your Anthropic API key doesn't have access. Check your account at console.anthropic.com.")
    except anthropic.NotFoundError:
        raise HTTPException(500, f"The model '{CLAUDE_MODEL}' wasn't found. Change CLAUDE_MODEL in server/.env, then restart the server.")
    except anthropic.RateLimitError:
        raise HTTPException(429, "Too many requests to Claude right now. Wait a minute and try again.")
    except anthropic.APIStatusError as e:
        text = str(getattr(e, "message", e))
        if "workspace" in text.lower():
            raise HTTPException(
                500,
                "Your API key isn't linked to a workspace. Create a new key in the Anthropic Console with a "
                "workspace selected (e.g. Default), or add ANTHROPIC_WORKSPACE_ID to server/.env.",
            )
        if "credit" in text.lower() or "billing" in text.lower():
            raise HTTPException(500, "Your Anthropic account is out of credit. Add some at console.anthropic.com → Billing.")
        raise HTTPException(502, f"Claude returned an error: {text}")
    except anthropic.APIConnectionError:
        raise HTTPException(502, "Couldn't reach Claude. Check your Mac's internet connection.")
    for block in msg.content:
        if block.type == "tool_use":
            return dict(block.input)
    # Fallback: the recipe came back as JSON text instead of a tool call.
    reply = "".join(getattr(b, "text", "") for b in msg.content)
    start, end = reply.find("{"), reply.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(reply[start : end + 1])
        except json.JSONDecodeError:
            pass
    log.warning("Unexpected reply from Claude: %s", reply[:500])
    raise HTTPException(502, "The AI didn't return a recipe. Try again.")


# ---------------------------------------------------------------- Routes ----

@app.get("/health")
def health():
    return {"ok": True, "model": CLAUDE_MODEL, "whisper": WHISPER_MODEL, "pexels": bool(PEXELS_API_KEY)}


@app.post("/extract")
def extract(req: ExtractRequest):
    url = req.url.strip()
    log.info("Extracting %s", url)
    with tempfile.TemporaryDirectory() as workdir:
        src = download(url, workdir)
        video = src["video_path"]

        transcript = ""
        used_audio = False
        if video and not caption_has_recipe(src["caption"]):
            log.info("Caption looks incomplete, transcribing audio…")
            try:
                transcript = transcribe(video)
                used_audio = bool(transcript)
            except Exception as e:  # keep going with the caption alone
                log.warning("Transcription failed: %s", e)

        if not src["caption"] and not transcript:
            raise HTTPException(422, "Couldn't find a caption or any speech in that video.")

        frames = extract_frames(video, src["duration"], workdir) if video else []
        log.info("Asking Claude (%d frames)…", len(frames))
        data = structure_recipe(src, transcript, frames)

        if not data.get("is_recipe", True) or not data.get("ingredients"):
            raise HTTPException(422, "That video doesn't seem to contain a recipe.")

        # Thumbnail: best video frame -> cover image -> stock photo -> none.
        image, image_source = None, "none"
        idx = data.get("best_frame_index")
        if isinstance(idx, int) and 0 <= idx < len(frames):
            image, image_source = to_data_uri(frames[idx]), "video"
        elif (cover := fetch_image(src["thumbnail"])) is not None:
            image, image_source = to_data_uri(cover), "video"
        elif (stock := pexels_photo(data.get("image_search_query") or data.get("name", ""))) is not None:
            image, image_source = to_data_uri(stock), "stock"

    caption_used = bool(src["caption"])
    extracted_from = "caption+audio" if (caption_used and used_audio) else ("audio" if used_audio else "caption")
    log.info("Done: %s (%s, image from %s)", data.get("name"), extracted_from, image_source)

    return {
        "name": data.get("name", "Untitled recipe"),
        "description": data.get("description", ""),
        "servings": data.get("servings") or 1,
        "prep_minutes": data.get("prep_minutes"),
        "cook_minutes": data.get("cook_minutes"),
        "difficulty": data.get("difficulty"),
        "category": data.get("category"),
        "ingredients": data.get("ingredients", []),
        "steps": data.get("steps", []),
        "macros_per_serving": data["macros_per_serving"],
        "image": image,
        "image_source": image_source,
        "extracted_from": extracted_from,
    }
