
# # app.py
# import asyncio
# import threading
# import os
# import base64
# import json
# import traceback
# from queue import Queue
# from dotenv import load_dotenv
# from geventwebsocket import WebSocketServer, WebSocketApplication, Resource
# from gevent import spawn
# from google import genai
# from google.genai import types


# # -------------------------
# # Load environment
# # -------------------------
# load_dotenv()
# GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
# MODEL = os.getenv("MODEL", "models/gemini-2.0-flash-exp")

# if not GOOGLE_API_KEY:
#     raise RuntimeError("💥 GOOGLE_API_KEY not set in .env")

# # -------------------------
# # Base64 helpers
# # -------------------------
# def b64_encode(b: bytes) -> str:
#     return base64.b64encode(b).decode("ascii")

# def b64_decode(s: str) -> bytes:
#     return base64.b64decode(s)

# # -------------------------
# # Gemini session runner
# # -------------------------
# async def gemini_session_runner(input_queue: Queue, output_queue: Queue):
#     print("🤖 Gemini session runner started.")
#     client = genai.Client(api_key=GOOGLE_API_KEY)

#     config = {
#         "response_modalities": ["AUDIO"],
#         "system_instruction": "You are a friendly voice bot. Keep replies concise.",
#         "temperature": 0.3,
#         "max_output_tokens": 800,
#     }

#     try:
#         async with client.aio.live.connect(model=MODEL, config=config) as session:
#             print("✅ Connected to Gemini API.")

#             # ---------------- Receiver ----------------
#             async def receiver():
#                 try:
#                     async for resp in session.receive():
#                         # 🔍 Debug log
#                         print("🔄 RAW Gemini Response:", resp) 

#                         # Raw audio chunks
#                         audio_bytes = getattr(resp, "data", None)
#                         if audio_bytes:
#                             output_queue.put({"type": "audio", "data": b64_encode(audio_bytes)})
#                             continue

#                         # Server-side structured response
#                         sc = getattr(resp, "server_content", None)
#                         if sc and getattr(sc, "model_turn", None):
#                             for part in (sc.model_turn.parts or []):
#                                 if getattr(part, "text", None):
#                                     output_queue.put({"type": "text", "data": part.text})
#                                 if getattr(part, "inline_data", None) and getattr(part.inline_data, "data", None):
#                                     output_queue.put({"type": "audio", "data": b64_encode(part.inline_data.data)})

#                         # Transcriptions
#                         if sc and getattr(sc, "output_transcription", None):
#                             if sc.output_transcription.text:
#                                 output_queue.put({"type": "text", "data": sc.output_transcription.text})

#                 except Exception as e:
#                     print(f"💥 ERROR in receiver: {e}")
#                     traceback.print_exc()
#                 finally:
#                     output_queue.put(None)

#             recv_task = asyncio.create_task(receiver())

#             # ---------------- Sender ----------------
#             while True:
#                 item = await asyncio.to_thread(input_queue.get)
#                 if item is None:
#                     break

#                 kind = item.get("kind")
#                 if kind == "audio":
#                     audio_bytes = item.get("bytes")
#                     if isinstance(audio_bytes, (bytes, bytearray)):
#                         # await session.send_realtime_input(
#                         #     # "type": "input_audio_buffer.append",
#                         #     # "audio": b64_encode(audio_bytes)
#                         #     # types.InputAudioBufferAppendEvent(
#                         #     #     audio=b64_encode(audio_bytes)
#                         #     # )
#                         #     audio=types.Blob(
#                         #         data=audio_bytes,  # already raw bytes, not base64
#                         #         # mime_type="audio/pcm;rate=16000"  # or correct rate
#                         #         mime_type="audio/pcm;rate=16000;encoding=s16"

#                         #     )
#                         # )
#                         await session.send(
#                             types.InputAudioBufferAppendEvent(
#                                 audio=genai.types.Blob(
#                                     data=audio_bytes,
#                                     mime_type="audio/pcm;rate=16000;encoding=s16"
#                                 )
#                             )
#                         )
#                         # await session.send_realtime_input( 
#                         #     audio=types.Blob(
#                         #         data=audio_bytes,
#                         #         mime_type="audio/pcm;rate=16000;encoding=s16"
#                         #     ) 
#                         # )               

#                     else:
#                         print("⚠️ Skipping invalid audio")

#                 elif kind == "commit":
#                     # await session.send({"type": "input_audio_buffer.commit"})
#                     # await session.send({"type": "input_audio.close"})
#                     await session.send(types.InputAudioBufferCommitEvent())
#                     await session.send(types.InputAudioCloseEvent()) 

#                 elif kind == "text":
#                     text_value = item.get("text", "")
#                     if text_value:
#                         # await session.send({"type": "input_text", "text": text_value})
#                         await session.send(types.InputTextEvent(text=text_value))

#             # ---------------- Cleanup ----------------
#             recv_task.cancel()

#     except Exception as e:
#         print(f"💥 ERROR in Gemini session runner: {e}")
#         traceback.print_exc()
#     finally:
#         output_queue.put(None)
#         print("🛑 Gemini session runner finished.")

# # -------------------------
# # WebSocket app
# # -------------------------
# class RealtimeApp(WebSocketApplication):
#     def on_open(self):
#         print("🚀 WebSocket client connected")
#         self.input_q = Queue()
#         self.output_q = Queue()

#         # forward Gemini -> browser
#         def forward_to_browser():
#             while True:
#                 ev = self.output_q.get()
#                 if ev is None:
#                     break
#                 try:
#                     self.ws.send(json.dumps(ev))
#                 except Exception as e:
#                     print("💥 ERROR sending to browser:", e)
#                     break

#         spawn(forward_to_browser)

#         # Start async loop in background thread
#         self.loop = asyncio.new_event_loop()
#         self.loop_thread = threading.Thread(target=self._loop_runner, daemon=True)
#         self.loop_thread.start()

#         # Run Gemini runner
#         self.runner_future = asyncio.run_coroutine_threadsafe(
#             gemini_session_runner(self.input_q, self.output_q), self.loop
#         )

#     def _loop_runner(self):
#         asyncio.set_event_loop(self.loop)
#         self.loop.run_forever()

#     def on_message(self, message):
#         if not message:
#             return
#         try:
#             data = json.loads(message)
#         except Exception:
#             print(f"📲 Invalid JSON: {message}")
#             return

#         mtype = data.get("type")
#         if mtype == "audio_chunk":
#             try:
#                 self.input_q.put({"kind": "audio", "bytes": b64_decode(data["data"])})
#             except Exception as e:
#                 print("💥 Bad audio_chunk:", e)

#         elif mtype == "commit":
#             self.input_q.put({"kind": "commit"})

#         elif mtype == "text":
#             self.input_q.put({"kind": "text", "text": data.get("data", "")})

#         elif mtype == "close":
#             self.input_q.put(None)
#             self.ws.close()

#     def on_close(self, reason):
#         print("🛑 WebSocket client disconnected:", reason)
#         try:
#             self.input_q.put(None)
#             if self.runner_future:
#                 self.runner_future.result(timeout=10)
#             if self.loop:
#                 self.loop.call_soon_threadsafe(self.loop.stop)
#             if self.loop_thread:
#                 self.loop_thread.join(timeout=5)
#         except Exception as e:
#             print("💥 Cleanup error:", e)
#         finally:
#             print("✅ Gemini session cleaned up")

# # -------------------------
# # Run server
# # -------------------------
# if __name__ == "__main__":
#     print(f"Starting server with model: {MODEL}")
#     # server = WebSocketServer(("0.0.0.0", 5000), Resource({"/realtime": RealtimeApp}))
#     server = WebSocketServer(
#     ("0.0.0.0", 5000),
#     Resource({
#         "/": lambda environ, start_response: start_response("200 OK", [("Content-Type", "text/plain")]) or [b"OK"],
#         "/realtime": RealtimeApp
#     })
# )

#     server.serve_forever()




# # app.py
# import asyncio
# import threading
# import os
# import base64
# import json
# import traceback
# from queue import Queue
# from dotenv import load_dotenv
# from geventwebsocket import WebSocketServer, WebSocketApplication, Resource
# from gevent import spawn
# from google import genai


# # -------------------------
# # Load environment
# # -------------------------
# load_dotenv()
# GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
# MODEL = os.getenv("MODEL", "models/gemini-2.0-flash-exp")

# if not GOOGLE_API_KEY:
#     raise RuntimeError("💥 GOOGLE_API_KEY not set in .env")

# # -------------------------
# # Base64 helpers
# # -------------------------
# def b64_encode(b: bytes) -> str:
#     return base64.b64encode(b).decode("ascii")

# def b64_decode(s: str) -> bytes:
#     return base64.b64decode(s)

# # -------------------------
# # Gemini session runner
# # -------------------------
# async def gemini_session_runner(input_queue: Queue, output_queue: Queue):
#     print("🤖 Gemini session runner started.")
#     client = genai.Client(api_key=GOOGLE_API_KEY)

#     # ✅ Step 5: Config is fine
#     config = {
#         "response_modalities": ["AUDIO"],
#         "system_instruction": "You are a friendly voice bot. Keep replies concise.",
#         "temperature": 0.3,
#         "max_output_tokens": 800,
#     }

#     try:
#         async with client.aio.live.connect(model=MODEL, config=config) as session:
#             print("✅ Connected to Gemini API.")

#             # ---------------- Receiver ----------------
#             async def receiver():
#                 try:
#                     async for resp in session.receive():
#                         print("🔄 RAW Gemini Response:", resp)

#                         # Raw audio stream (inline)
#                         audio_bytes = getattr(resp, "data", None)
#                         if audio_bytes:
#                             output_queue.put({"type": "audio", "data": b64_encode(audio_bytes)})
#                             continue

#                         # Structured model content
#                         sc = getattr(resp, "server_content", None)
#                         if sc and getattr(sc, "model_turn", None):
#                             for part in (sc.model_turn.parts or []):
#                                 if getattr(part, "text", None):
#                                     output_queue.put({"type": "text", "data": part.text})
#                                 if getattr(part, "inline_data", None) and getattr(part.inline_data, "data", None):
#                                     output_queue.put({"type": "audio", "data": b64_encode(part.inline_data.data)})

#                         # Transcriptions
#                         if sc and getattr(sc, "output_transcription", None):
#                             if sc.output_transcription.text:
#                                 output_queue.put({"type": "text", "data": sc.output_transcription.text})

#                 except Exception as e:
#                     print(f"💥 ERROR in receiver: {e}")
#                     traceback.print_exc()
#                 finally:
#                     output_queue.put(None)

#             recv_task = asyncio.create_task(receiver())

#             # ---------------- Sender (Option 2: dict events) ----------------
#             while True:
#                 item = await asyncio.to_thread(input_queue.get)
#                 if item is None:
#                     break

#                 kind = item.get("kind")
#                 if kind == "audio":
#                     audio_bytes = item.get("bytes")
#                     if isinstance(audio_bytes, (bytes, bytearray)):
#                         # await session.send({
#                         #     "type": "input_audio_buffer.append",
#                         #     "audio": b64_encode(audio_bytes),
#                         # })
#                         await session.input_audio_buffer.append(audio_bytes)
#                     else:
#                         print("⚠️ Skipping invalid audio")

#                 elif kind == "commit":
#                     # ✅ commit + ask model to respond
#                     # await session.send({"type": "input_audio_buffer.commit"})  
#                     #  await session.send({"type": "response.create"})
                     
#                     # await session.send(types.InputAudioBufferCommitEvent())
#                     # await session.send(types.ResponseCreateEvent())
                   
#                     await session.input_audio_buffer.commit()
#                     await session.response.create()

#                 elif kind == "text":
#                     text_value = item.get("text", "")
#                     if text_value:
#                         # await session.send({"type": "input_text", "text": text_value})
#                         # await session.send({"type": "response.create"})

#                         await session.input_text.send(text_value)
#                         await session.response.create()
#             # ---------------- Cleanup ----------------
#             recv_task.cancel()

#     except Exception as e:
#         print(f"💥 ERROR in Gemini session runner: {e}")
#         traceback.print_exc()
#     finally:
#         output_queue.put(None)
#         print("🛑 Gemini session runner finished.")

# # -------------------------
# # WebSocket app
# # -------------------------
# class RealtimeApp(WebSocketApplication):
#     def on_open(self):
#         print("🚀 WebSocket client connected")
#         self.input_q = Queue()
#         self.output_q = Queue()

#         # forward Gemini -> browser
#         def forward_to_browser():
#             while True:
#                 ev = self.output_q.get()
#                 if ev is None:
#                     break
#                 try:
#                     self.ws.send(json.dumps(ev))
#                 except Exception as e:
#                     print("💥 ERROR sending to browser:", e)
#                     break

#         spawn(forward_to_browser)

#         # Start async loop in background thread
#         self.loop = asyncio.new_event_loop()
#         self.loop_thread = threading.Thread(target=self._loop_runner, daemon=True)
#         self.loop_thread.start()

#         # Run Gemini runner
#         self.runner_future = asyncio.run_coroutine_threadsafe(
#             gemini_session_runner(self.input_q, self.output_q), self.loop
#         )

#     def _loop_runner(self):
#         asyncio.set_event_loop(self.loop)
#         self.loop.run_forever()

#     def on_message(self, message):
#         if not message:
#             return
#         try:
#             data = json.loads(message)
#         except Exception:
#             print(f"📲 Invalid JSON: {message}")
#             return

#         mtype = data.get("type")
#         if mtype == "audio_chunk":
#             try:
#                 self.input_q.put({"kind": "audio", "bytes": b64_decode(data["data"])})
#             except Exception as e:
#                 print("💥 Bad audio_chunk:", e)

#         elif mtype == "commit":
#             self.input_q.put({"kind": "commit"})

#         elif mtype == "text":
#             self.input_q.put({"kind": "text", "text": data.get("data", "")})

#         elif mtype == "close":
#             self.input_q.put(None)
#             self.ws.close()

#     def on_close(self, reason):
#         print("🛑 WebSocket client disconnected:", reason)
#         try:
#             self.input_q.put(None)
#             if self.runner_future:
#                 self.runner_future.result(timeout=10)
#             if self.loop:
#                 self.loop.call_soon_threadsafe(self.loop.stop)
#             if self.loop_thread:
#                 self.loop_thread.join(timeout=5)
#         except Exception as e:
#             print("💥 Cleanup error:", e)
#         finally:
#             print("✅ Gemini session cleaned up")


# def index(environ, start_response):
#     start_response("200 OK", [("Content-Type", "text/plain")])
#     return [b"OK"]


# # -------------------------
# # Run server (Step 3: quiet “No apps defined”)
# # -------------------------
# if __name__ == "__main__":
#     PORT = int(os.environ.get("PORT", 5000))  # Render needs this
#     print(f"Starting server on port {PORT} with model: {MODEL}")

#     server = WebSocketServer(
#         ("0.0.0.0", PORT),
#         Resource({
#             "/": index,
#             "/realtime": RealtimeApp,
#         })
#     )





import asyncio
import os
import base64
import json
import traceback
from typing import Dict, Any
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
from google import genai
from google.genai import types as genai_types

# Load environment
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
MODEL = os.getenv("MODEL", "models/gemini-2.5-flash-preview-native-audio-dialog")

if not GOOGLE_API_KEY:
    raise RuntimeError("💥 GOOGLE_API_KEY not set in .env")

app = FastAPI(title="Gemini Live Voice Chat")

def b64_encode(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")

def b64_decode(s: str) -> bytes:
    return base64.b64decode(s)


class GeminiSession:
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.client = genai.Client(api_key=GOOGLE_API_KEY)
        self.session_cm = None  # context manager
        self.session = None
        self.receive_task = None
        self.audio_buffer = bytearray()
        self.is_connected = False

    async def start(self):
        """Start the Gemini session"""
        config = {
            "response_modalities": ["AUDIO"],
            "system_instruction": "You are a friendly voice bot. Keep replies concise and natural.",
            "temperature": 0.3,
            "max_output_tokens": 800,
        }

        try:
            # async context manager
            self.session_cm = self.client.aio.live.connect(model=MODEL, config=config)
            self.session = await self.session_cm.__aenter__()
            self.is_connected = True
            print("✅ Connected to Gemini API")

            # Start receiving responses from Gemini
            self.receive_task = asyncio.create_task(self._receive_loop())

        except Exception as e:
            print(f"💥 Error connecting to Gemini: {e}")
            traceback.print_exc()
            raise

    async def _receive_loop(self):
        """Receive responses from Gemini and send to WebSocket"""
        try:
            async for resp in self.session.receive():
                if not self.is_connected:
                    break

                # Handle raw audio data
                if hasattr(resp, "data") and resp.data:
                    try:
                        await self.websocket.send_json(
                            {"type": "audio", "data": b64_encode(resp.data)}
                        )
                    except Exception as e:
                        print(f"💥 Error sending audio to client: {e}")
                    continue

                # Handle server content
                if hasattr(resp, "server_content") and resp.server_content:
                    sc = resp.server_content

                    # Model turn with parts
                    if (
                        hasattr(sc, "model_turn")
                        and sc.model_turn
                        and sc.model_turn.parts
                    ):
                        for part in sc.model_turn.parts:
                            if hasattr(part, "text") and part.text:
                                try:
                                    await self.websocket.send_json(
                                        {"type": "text", "data": part.text}
                                    )
                                except Exception as e:
                                    print(f"💥 Error sending text to client: {e}")
                            if (
                                hasattr(part, "inline_data")
                                and part.inline_data
                                and part.inline_data.data
                            ):
                                try:
                                    await self.websocket.send_json(
                                        {
                                            "type": "audio",
                                            "data": b64_encode(part.inline_data.data),
                                        }
                                    )
                                except Exception as e:
                                    print(f"💥 Error sending inline audio to client: {e}")

                    # Output transcription
                    if (
                        hasattr(sc, "output_transcription")
                        and sc.output_transcription
                        and sc.output_transcription.text
                    ):
                        try:
                            await self.websocket.send_json(
                                {"type": "text", "data": sc.output_transcription.text}
                            )
                        except Exception as e:
                            print(f"💥 Error sending transcription to client: {e}")

        except Exception as e:
            if self.is_connected:
                print(f"💥 Error in receive loop: {e}")
                traceback.print_exc()

    async def send_audio(self, audio_bytes: bytes):
        """Send audio to Gemini"""
        if not self.is_connected or not self.session:
            return

        try:
            # Add to buffer
            self.audio_buffer.extend(audio_bytes)

        except Exception as e:
            print(f"💥 Error buffering audio: {e}")
            traceback.print_exc()

    async def commit(self):
        """Commit the current turn and request response"""
        if not self.is_connected or not self.session or not self.audio_buffer:
            return

        try:
            # Send buffered audio
            audio_blob = genai_types.Blob(
                data=bytes(self.audio_buffer), mime_type="audio/webm;codecs=opus"
            )

            # ✅ Wrap inside LiveClientRealtimeInput
            await self.session.send(
                genai_types.LiveClientRealtimeInput(
                    content=genai_types.Content(
                        parts=[genai_types.Part(inline_data=audio_blob)],
                        role="user"
                    )
                )
            )

            await self.session.send(genai_types.ResponseCreateEvent())

            # Clear buffer
            self.audio_buffer = bytearray()
            print("📤 Committed audio to Gemini")
        except Exception as e:
            print(f"💥 Error committing to Gemini: {e}")
            traceback.print_exc()

    async def send_text(self, text: str):
        """Send text to Gemini"""
        if not self.is_connected or not self.session:
            return

        try:
            # ✅ Wrap inside LiveClientRealtimeInput
            await self.session.send(
                genai_types.LiveClientRealtimeInput(
                    content=genai_types.Content(
                        parts=[genai_types.Part(text=text)],
                        role="user"
                    )
                )
            )
            await self.session.send(genai_types.ResponseCreateEvent())
        except Exception as e:
            print(f"💥 Error sending text to Gemini: {e}")
            traceback.print_exc()

    async def close(self):
        """Clean up the session"""
        self.is_connected = False

        try:
            if self.receive_task:
                self.receive_task.cancel()
                try:
                    await self.receive_task
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    print(f"💥 Error waiting for receive task: {e}")

            if self.session_cm:
                await self.session_cm.__aexit__(None, None, None)
            print("✅ Gemini session closed")
        except Exception as e:
            print(f"💥 Error closing session: {e}")
            traceback.print_exc()


@app.websocket("/realtime")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("🚀 WebSocket client connected")

    gemini_session = GeminiSession(websocket)

    try:
        # Start Gemini session
        await gemini_session.start()

        # Handle messages from client
        async for data in websocket.iter_text():
            try:
                message = json.loads(data)
                msg_type = message.get("type")

                if msg_type == "audio_chunk":
                    audio_data = b64_decode(message["data"])
                    await gemini_session.send_audio(audio_data)

                elif msg_type == "commit":
                    await gemini_session.commit()

                elif msg_type == "text":
                    text_data = message.get("data", "")
                    await gemini_session.send_text(text_data)

                elif msg_type == "close":
                    break

            except json.JSONDecodeError:
                print(f"📲 Invalid JSON: {data}")
            except Exception as e:
                print(f"💥 Error handling message: {e}")
                traceback.print_exc()

    except WebSocketDisconnect:
        print("🛑 WebSocket client disconnected")
    except Exception as e:
        print(f"💥 WebSocket error: {e}")
        traceback.print_exc()
    finally:
        await gemini_session.close()
        print("✅ Session cleaned up")


@app.get("/")
async def health_check():
    return {"status": "ok", "message": "Gemini Live Voice Chat Backend"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"Starting server on port {port} with model: {MODEL}")
    uvicorn.run("app:app", host="0.0.0.0", port=port, log_level="info")
