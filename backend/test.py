import os
import asyncio
import base64
import traceback
from queue import Queue
from google import genai
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in environment")

# -------------------------
# Helpers
# -------------------------
def b64_encode(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")

def b64_decode(s: str) -> bytes:
    return base64.b64decode(s)

# -------------------------
# List models
# -------------------------
def list_models():
    client = genai.Client(api_key=GOOGLE_API_KEY)
    print("🔹 Fetching accessible models...")
    try:
        models = client.list_models()
        for m in models:
            name = m.get("name")
            caps = m.get("capabilities", [])
            print(f"Model: {name}")
            print(f"Capabilities: {caps}\n")
        return models
    except Exception as e:
        print("❌ Failed to list models:", e)
        return []

# -------------------------
# Gemini live session
# -------------------------
async def gemini_live_test(model_name: str):
    input_q = Queue()
    output_q = Queue()

    client = genai.Client(api_key=GOOGLE_API_KEY)

    config = {
        "response_modalities": ["AUDIO"],
        "system_instruction": "You are a friendly voice bot. Keep replies concise.",
        "temperature": 0.3,
        "max_output_tokens": 300,
    }

    print(f"🔹 Connecting to Gemini Live model: {model_name} ...")

    try:
        async with client.aio.live.connect(model=model_name, config=config) as session:
            print("✅ Connected to Gemini Live!")

            # Receiver: pushes Gemini responses to output queue
            async def receiver():
                try:
                    async for resp in session.receive():
                        if resp is None:
                            break

                        audio_bytes = getattr(resp, "data", None)
                        if audio_bytes:
                            print(f"🎧 Received audio chunk ({len(audio_bytes)} bytes)")
                            continue

                        sc = getattr(resp, "server_content", None)
                        if sc and getattr(sc, "model_turn", None):
                            for part in getattr(sc.model_turn, "parts", []):
                                text = getattr(part, "text", None)
                                if text:
                                    print(f"💬 Gemini says: {text}")

                except Exception as e:
                    print("💥 ERROR in receiver:", e)
                    traceback.print_exc()

            recv_task = asyncio.create_task(receiver())

            # Optional: send a text message to the bot
            await session.send_client_content(
                turns=genai.types.Content(
                    role="user",
                    parts=[genai.types.Part(text="Hello Gemini! This is a test.")]
                )
            )

            # Wait a few seconds to receive response
            await asyncio.sleep(5)
            recv_task.cancel()

    except Exception as e:
        print("❌ Failed during Gemini Live session:", e)
        traceback.print_exc()
    finally:
        print("🛑 Gemini Live test finished.")


# -------------------------
# Main entry
# -------------------------
if __name__ == "__main__":
    models = list_models()

    # Find a model that supports live streaming
    live_models = [m for m in models if "bidiGenerateContent" in m.get("capabilities", [])]
    if not live_models:
        print("❌ No models with live streaming support found in your account.")
        exit(1)

    # Pick the first live-enabled model
    selected_model = live_models[0]["name"]
    print(f"\n⚡ Using live-enabled model: {selected_model}")  
    asyncio.run(gemini_live_test(selected_model))
