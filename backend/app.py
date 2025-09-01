
# # # # import asyncio
# # # # import os
# # # # import base64
# # # # import json
# # # # import traceback
# # # # from queue import Queue
# # # # from dotenv import load_dotenv
# # # # from flask import Flask
# # # # from flask_cors import CORS
# # # # from flask_sock import Sock
# # # # import gevent
# # # # from gevent import pywsgi
# # # # from geventwebsocket.handler import WebSocketHandler

# # # # from google import genai

# # # # load_dotenv()

# # # # app = Flask(__name__)
# # # # CORS(app)
# # # # sock = Sock(app)

# # # # GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
# # # # MODEL = os.getenv("MODEL", "gemini-2.0-flash-live-001")

# # # # def b64_encode(b: bytes) -> str:
# # # #     return base64.b64encode(b).decode("ascii")

# # # # def b64_decode(s: str) -> bytes:
# # # #     return base64.b64decode(s)

# # # # async def gemini_session_runner(input_queue: Queue, output_queue: Queue):
# # # #     print("🤖 Gemini session runner started.")

# # # #     if not GOOGLE_API_KEY:
# # # #         print("💥 ERROR: GOOGLE_API_KEY missing in environment")
# # # #         output_queue.put({"type": "text", "data": "Server error: missing GOOGLE_API_KEY."})
# # # #         output_queue.put(None)
# # # #         return

# # # #     client = genai.Client(api_key=GOOGLE_API_KEY)

# # # #     config = {
# # # #         "response_modalities": ["AUDIO"],
# # # #         "system_instruction": "You are a friendly voice bot. Keep replies concise.",
# # # #         "temperature": 0.3,
# # # #         "max_output_tokens": 800,
# # # #     }

# # # #     try:
# # # #         async with client.aio.live.connect(model=MODEL, config=config) as session:
# # # #             print("✅ Connected to Gemini API.")

# # # #             async def receiver():
# # # #                 try:
# # # #                     async for resp in session.receive():
# # # #                         if resp is None:
# # # #                             break

# # # #                         audio_bytes = getattr(resp, "data", None)
# # # #                         if audio_bytes:
# # # #                             output_queue.put({"type": "audio", "data": b64_encode(audio_bytes)})
# # # #                             continue

# # # #                         sc = getattr(resp, "server_content", None)
# # # #                         if sc and getattr(sc, "model_turn", None):
# # # #                             parts = getattr(sc.model_turn, "parts", []) or []
# # # #                             for part in parts:
# # # #                                 txt = getattr(part, "text", None)
# # # #                                 if txt:
# # # #                                     output_queue.put({"type": "text", "data": txt})
# # # #                                 inline = getattr(part, "inline_data", None)
# # # #                                 if inline:
# # # #                                     inline_bytes = getattr(inline, "data", None)
# # # #                                     if inline_bytes:
# # # #                                         output_queue.put({"type": "audio", "data": b64_encode(inline_bytes)})

# # # #                         if sc and getattr(sc, "output_transcription", None):
# # # #                             ttxt = getattr(sc.output_transcription, "text", None)
# # # #                             if ttxt:
# # # #                                 output_queue.put({"type": "text", "data": ttxt})

# # # #                 except Exception as e:
# # # #                     print(f"💥 ERROR in receiver: {e}")
# # # #                     traceback.print_exc()
# # # #                 finally:
# # # #                     output_queue.put(None)

# # # #             recv_task = asyncio.create_task(receiver())

# # # #             while True:
# # # #                 item = await asyncio.to_thread(input_queue.get)
# # # #                 if item is None:
# # # #                     break

# # # #                 kind = item.get("kind") or item.get("type") or ""

# # # #                 if kind == "audio":
# # # #                     audio_bytes = item.get("bytes")
# # # #                     if not isinstance(audio_bytes, (bytes, bytearray)):
# # # #                         print("⚠️ Received non-bytes audio; skipping")
# # # #                         continue
# # # #                     blob = genai.types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
# # # #                     try:
# # # #                         await session.send_realtime_input(audio=blob)
# # # #                     except Exception as e:
# # # #                         print("💥 send_realtime_input failed:", e)

# # # #                 elif kind == "commit":
# # # #                     try:
# # # #                         await session.send_realtime_input(audio_stream_end=True)
# # # #                     except Exception as e:
# # # #                         print("💥 send_realtime_input(audio_stream_end=True) failed:", e)

# # # #                 elif kind == "text":
# # # #                     text_value = item.get("text", "")
# # # #                     if text_value:
# # # #                         try:
# # # #                             await session.send_client_content(
# # # #                                 turns=genai.types.Content(role="user", parts=[genai.types.Part(text=text_value)])
# # # #                             )
# # # #                         except Exception as e:
# # # #                             print("💥 send_client_content failed:", e)

# # # #                 else:
# # # #                     print("⚠️ Ignoring unknown input item:", kind, item)

# # # #             try:
# # # #                 recv_task.cancel()
# # # #             except Exception:
# # # #                 pass

# # # #     except Exception as e:
# # # #         print(f"💥 ERROR in Gemini session runner: {e}")
# # # #         traceback.print_exc()
# # # #     finally:
# # # #         output_queue.put(None)
# # # #         print("🛑 Gemini session runner finished.")


# # # # @sock.route("/realtime")
# # # # def ws_proxy(ws):
# # # #     print("\n🚀 WebSocket client connected.")
# # # #     input_q = Queue()
# # # #     output_q = Queue()

# # # #     # Run Gemini session runner in the same greenlet
# # # #     loop = asyncio.new_event_loop()
# # # #     asyncio.set_event_loop(loop)
# # # #     runner_task = loop.create_task(gemini_session_runner(input_q, output_q))

# # # #     # Forward Gemini -> Browser
# # # #     def forward_to_browser():
# # # #         while True:
# # # #             ev = output_q.get()
# # # #             if ev is None:
# # # #                 break
# # # #             try:
# # # #                 ws.send(json.dumps(ev))
# # # #             except Exception as e:
# # # #                 print("💥 ERROR sending to browser:", e)
# # # #                 break

# # # #     gevent.spawn(forward_to_browser)

# # # #     # Browser -> Gemini
# # # #     try:
# # # #         while True:
# # # #             message = ws.receive()
# # # #             if message is None:
# # # #                 break
# # # #             try:
# # # #                 data = json.loads(message)
# # # #             except Exception:
# # # #                 print(f"📲 Non-JSON message from browser (ignored): {message}")
# # # #                 continue

# # # #             mtype = data.get("type")
# # # #             if mtype == "audio_chunk":
# # # #                 try:
# # # #                     audio_bytes = b64_decode(data["data"])
# # # #                     input_q.put({"kind": "audio", "bytes": audio_bytes})
# # # #                 except Exception as e:
# # # #                     print("💥 Invalid audio_chunk from client:", e)

# # # #             elif mtype == "commit":
# # # #                 input_q.put({"kind": "commit"})

# # # #             elif mtype == "text":
# # # #                 input_q.put({"kind": "text", "text": data.get("data", "")})

# # # #             elif mtype == "close":
# # # #                 break

# # # #             else:
# # # #                 print("📲 Unrecognized client message:", data)

# # # #     finally:
# # # #         print("🛑 WebSocket client disconnected.")
# # # #         input_q.put(None)
# # # #         loop.run_until_complete(runner_task)
# # # #         loop.close()
# # # #         print("✅ Gemini session cleaned up.")


# # # # if __name__ == "__main__":
# # # #     print(f"Starting server with model: {MODEL}")
# # # #     server = pywsgi.WSGIServer(("0.0.0.0", 5000), app, handler_class=WebSocketHandler)
# # # #     server.serve_forever()













# # # import asyncio
# # # import os
# # # import base64
# # # import json
# # # import traceback
# # # from queue import Queue
# # # from dotenv import load_dotenv
# # # from flask import Flask
# # # from flask_cors import CORS
# # # from flask_sock import Sock
# # # from gevent import pywsgi, spawn
# # # from geventwebsocket.handler import WebSocketHandler

# # # from google import genai

# # # load_dotenv()

# # # app = Flask(__name__)
# # # CORS(app)
# # # sock = Sock(app)

# # # GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
# # # MODEL = os.getenv("MODEL", "gemini-2.0-flash-live-001")

# # # # -------------------------
# # # # Helpers
# # # # -------------------------
# # # def b64_encode(b: bytes) -> str:
# # #     return base64.b64encode(b).decode("ascii")

# # # def b64_decode(s: str) -> bytes:
# # #     return base64.b64decode(s)

# # # # -------------------------
# # # # Gemini session runner
# # # # -------------------------
# # # async def gemini_session_runner(input_queue: Queue, output_queue: Queue):
# # #     print("🤖 Gemini session runner started.")

# # #     if not GOOGLE_API_KEY:
# # #         print("💥 ERROR: GOOGLE_API_KEY missing in environment")
# # #         output_queue.put({"type": "text", "data": "Server error: missing GOOGLE_API_KEY."})
# # #         output_queue.put(None)
# # #         return

# # #     client = genai.Client(api_key=GOOGLE_API_KEY)

# # #     config = {
# # #         "response_modalities": ["AUDIO"],
# # #         "system_instruction": "You are a friendly voice bot. Keep replies concise.",
# # #         "temperature": 0.3,
# # #         "max_output_tokens": 800,
# # #     }

# # #     try:
# # #         async with client.aio.live.connect(model=MODEL, config=config) as session:
# # #             print("✅ Connected to Gemini API.")

# # #             # -------------------------
# # #             # Receiver: Gemini -> backend
# # #             # -------------------------
# # #             async def receiver():
# # #                 try:
# # #                     async for resp in session.receive():
# # #                         if resp is None:
# # #                             break

# # #                         # raw audio
# # #                         audio_bytes = getattr(resp, "data", None)
# # #                         if audio_bytes:
# # #                             output_queue.put({"type": "audio", "data": b64_encode(audio_bytes)})
# # #                             continue

# # #                         # model_turn parts
# # #                         sc = getattr(resp, "server_content", None)
# # #                         if sc and getattr(sc, "model_turn", None):
# # #                             parts = getattr(sc.model_turn, "parts", []) or []
# # #                             for part in parts:
# # #                                 # text
# # #                                 txt = getattr(part, "text", None)
# # #                                 if txt:
# # #                                     output_queue.put({"type": "text", "data": txt})
# # #                                 # inline audio
# # #                                 inline = getattr(part, "inline_data", None)
# # #                                 if inline:
# # #                                     inline_bytes = getattr(inline, "data", None)
# # #                                     if inline_bytes:
# # #                                         output_queue.put({"type": "audio", "data": b64_encode(inline_bytes)})

# # #                         # transcription fallback
# # #                         if sc and getattr(sc, "output_transcription", None):
# # #                             ttxt = getattr(sc.output_transcription, "text", None)
# # #                             if ttxt:
# # #                                 output_queue.put({"type": "text", "data": ttxt})

# # #                 except Exception as e:
# # #                     print(f"💥 ERROR in receiver: {e}")
# # #                     traceback.print_exc()
# # #                 finally:
# # #                     output_queue.put(None)

# # #             recv_task = asyncio.create_task(receiver())

# # #             # -------------------------
# # #             # Sender: frontend -> Gemini
# # #             # -------------------------
# # #             while True:
# # #                 item = await asyncio.to_thread(input_queue.get)
# # #                 if item is None:
# # #                     break

# # #                 kind = item.get("kind") or item.get("type") or ""

# # #                 if kind == "audio":
# # #                     audio_bytes = item.get("bytes")
# # #                     if not isinstance(audio_bytes, (bytes, bytearray)):
# # #                         print("⚠️ Received non-bytes audio; skipping")
# # #                         continue

# # #                     print(f"🎧 Received audio from frontend ({len(audio_bytes)} bytes)")
# # #                     blob = genai.types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
# # #                     try:
# # #                         await session.send_realtime_input(audio=blob)
# # #                     except Exception as e:
# # #                         print("💥 send_realtime_input failed:", e)

# # #                 elif kind == "commit":
# # #                     try:
# # #                         await session.send_realtime_input(audio_stream_end=True)
# # #                     except Exception as e:
# # #                         print("💥 send_realtime_input(audio_stream_end=True) failed:", e)

# # #                 elif kind == "text":
# # #                     text_value = item.get("text", "")
# # #                     if text_value:
# # #                         try:
# # #                             await session.send_client_content(
# # #                                 turns=genai.types.Content(role="user", parts=[genai.types.Part(text=text_value)])
# # #                             )
# # #                         except Exception as e:
# # #                             print("💥 send_client_content failed:", e)

# # #                 else:
# # #                     print("⚠️ Ignoring unknown input item:", kind, item)

# # #             try:
# # #                 recv_task.cancel()
# # #             except Exception:
# # #                 pass

# # #     except Exception as e:
# # #         print(f"💥 ERROR in Gemini session runner: {e}")
# # #         traceback.print_exc()
# # #     finally:
# # #         output_queue.put(None)
# # #         print("🛑 Gemini session runner finished.")

# # # # -------------------------
# # # # WebSocket route
# # # # -------------------------
# # # @sock.route("/realtime")
# # # def ws_proxy(ws):
# # #     print("\n🚀 WebSocket client connected.")
# # #     input_q = Queue()
# # #     output_q = Queue()

# # #     # -------------------------
# # #     # Forward Gemini -> Browser
# # #     # -------------------------
# # #     def forward_to_browser():
# # #         while True:
# # #             ev = output_q.get()
# # #             if ev is None:
# # #                 break
# # #             try:
# # #                 ws.send(json.dumps(ev))
# # #             except Exception as e:
# # #                 print("💥 ERROR sending to browser:", e)
# # #                 break

# # #     spawn(forward_to_browser)

# # #     # -------------------------
# # #     # Run Gemini session in same greenlet
# # #     # -------------------------
# # #     loop = asyncio.new_event_loop()
# # #     asyncio.set_event_loop(loop)
# # #     runner_task = loop.create_task(gemini_session_runner(input_q, output_q))

# # #     try:
# # #         while True:
# # #             message = ws.receive()
# # #             if message is None:
# # #                 break
# # #             try:
# # #                 data = json.loads(message)
# # #             except Exception:
# # #                 print(f"📲 Non-JSON message from browser (ignored): {message}")
# # #                 continue

# # #             mtype = data.get("type")
# # #             if mtype == "audio_chunk":
# # #                 try:
# # #                     audio_bytes = b64_decode(data["data"])
# # #                     input_q.put({"kind": "audio", "bytes": audio_bytes})
# # #                 except Exception as e:
# # #                     print("💥 Invalid audio_chunk from client:", e)

# # #             elif mtype == "commit":
# # #                 input_q.put({"kind": "commit"})

# # #             elif mtype == "text":
# # #                 input_q.put({"kind": "text", "text": data.get("data", "")})

# # #             elif mtype == "close":
# # #                 break

# # #             else:
# # #                 print("📲 Unrecognized client message:", data)

# # #     finally:
# # #         print("🛑 WebSocket client disconnected.")
# # #         input_q.put(None)
# # #         loop.run_until_complete(runner_task)
# # #         loop.close()
# # #         print("✅ Gemini session cleaned up.")

# # # # -------------------------
# # # # Run server
# # # # -------------------------
# # # if __name__ == "__main__":
# # #     print(f"Starting server with model: {MODEL}")
# # #     server = pywsgi.WSGIServer(("0.0.0.0", 5000), app, handler_class=WebSocketHandler)
# # #     server.serve_forever()








# # from gevent import monkey; monkey.patch_all()  # must be first

# # import asyncio
# # import os
# # import base64
# # import json
# # import traceback
# # from queue import Queue
# # from dotenv import load_dotenv
# # from geventwebsocket import WebSocketServer, WebSocketApplication, Resource
# # from gevent import spawn

# # from google import genai

# # load_dotenv()

# # GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
# # MODEL = os.getenv("MODEL", "gemini-2.0-flash-live-001")
# # # print("API_KEY:", os.getenv("GOOGLE_API_KEY"))
# # # -------------------------
# # # Helpers
# # # -------------------------
# # def b64_encode(b: bytes) -> str:
# #     return base64.b64encode(b).decode("ascii")

# # def b64_decode(s: str) -> bytes:
# #     return base64.b64decode(s)

# # # -------------------------
# # # Gemini session runner
# # # -------------------------
# # async def gemini_session_runner(input_queue: Queue, output_queue: Queue):
# #     print("🤖 Gemini session runner started.")

# #     if not GOOGLE_API_KEY:
# #         print("💥 ERROR: GOOGLE_API_KEY missing in environment")
# #         output_queue.put({"type": "text", "data": "Server error: missing GOOGLE_API_KEY."})
# #         output_queue.put(None)
# #         return

# #     client = genai.Client(api_key=GOOGLE_API_KEY)

# #     config = {
# #         "response_modalities": ["AUDIO"],
# #         "system_instruction": "You are a friendly voice bot. Keep replies concise.",
# #         "temperature": 0.3,
# #         "max_output_tokens": 800,
# #     }

# #     try:
# #         async with client.aio.live.connect(model=MODEL, config=config , timeout =50) as session:
# #             print("✅ Connected to Gemini API.")

# #             async def receiver():
# #                 try:
# #                     async for resp in session.receive():
# #                         if resp is None:
# #                             break

# #                         audio_bytes = getattr(resp, "data", None)
# #                         if audio_bytes:
# #                             output_queue.put({"type": "audio", "data": b64_encode(audio_bytes)})
# #                             continue

# #                         sc = getattr(resp, "server_content", None)
# #                         if sc and getattr(sc, "model_turn", None):
# #                             parts = getattr(sc.model_turn, "parts", []) or []
# #                             for part in parts:
# #                                 txt = getattr(part, "text", None)
# #                                 if txt:
# #                                     output_queue.put({"type": "text", "data": txt})
# #                                 inline = getattr(part, "inline_data", None)
# #                                 if inline:
# #                                     inline_bytes = getattr(inline, "data", None)
# #                                     if inline_bytes:
# #                                         output_queue.put({"type": "audio", "data": b64_encode(inline_bytes)})

# #                         if sc and getattr(sc, "output_transcription", None):
# #                             ttxt = getattr(sc.output_transcription, "text", None)
# #                             if ttxt:
# #                                 output_queue.put({"type": "text", "data": ttxt})

# #                 except Exception as e:
# #                     print(f"💥 ERROR in receiver: {e}")
# #                     traceback.print_exc()
# #                 finally:
# #                     output_queue.put(None)

# #             recv_task = asyncio.create_task(receiver())

# #             # -------------------------
# #             # Send frontend audio/text to Gemini
# #             # -------------------------
# #             while True:
# #                 item = await asyncio.to_thread(input_queue.get)
# #                 if item is None:
# #                     break

# #                 kind = item.get("kind") or item.get("type") or ""

# #                 if kind == "audio":
# #                     audio_bytes = item.get("bytes")
# #                     if not isinstance(audio_bytes, (bytes, bytearray)):
# #                         print("⚠️ Received non-bytes audio; skipping")
# #                         continue

# #                     print(f"🎧 Received audio from frontend ({len(audio_bytes)} bytes)")
# #                     blob = genai.types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
# #                     try:
# #                         await session.send_realtime_input(audio=blob)
# #                     except Exception as e:
# #                         print("💥 send_realtime_input failed:", e)

# #                 elif kind == "commit":
# #                     try:
# #                         await session.send_realtime_input(audio_stream_end=True)
# #                     except Exception as e:
# #                         print("💥 send_realtime_input(audio_stream_end=True) failed:", e)

# #                 elif kind == "text":
# #                     text_value = item.get("text", "")
# #                     if text_value:
# #                         try:
# #                             await session.send_client_content(
# #                                 turns=genai.types.Content(role="user", parts=[genai.types.Part(text=text_value)])
# #                             )
# #                         except Exception as e:
# #                             print("💥 send_client_content failed:", e)

# #                 else:
# #                     print("⚠️ Ignoring unknown input item:", kind, item)

# #             try:
# #                 recv_task.cancel()
# #             except Exception:
# #                 pass

# #     except Exception as e:
# #         print(f"💥 ERROR in Gemini session runner: {e}")
# #         traceback.print_exc()
# #     finally:
# #         output_queue.put(None)
# #         print("🛑 Gemini session runner finished.")

# # # -------------------------
# # # WebSocket app
# # # -------------------------
# # class RealtimeApp(WebSocketApplication):
# #     def on_open(self):
# #         print("🚀 WebSocket client connected")
# #         self.input_q = Queue()
# #         self.output_q = Queue()

# #         # Forward Gemini -> client
# #         def forward_to_browser():
# #             while True:
# #                 ev = self.output_q.get()
# #                 if ev is None:
# #                     break
# #                 try:
# #                     self.ws.send(json.dumps(ev))
# #                 except Exception as e:
# #                     print("💥 ERROR sending to browser:", e)
# #                     break

# #         spawn(forward_to_browser)

# #         # Run Gemini session in this greenlet
# #         self.loop = asyncio.new_event_loop()
# #         asyncio.set_event_loop(self.loop)
# #         self.runner_task = self.loop.create_task(gemini_session_runner(self.input_q, self.output_q))

# #     def on_message(self, message):
# #         if message is None:
# #             return

# #         try:
# #             data = json.loads(message)
# #         except Exception:
# #             print(f"📲 Non-JSON message from client (ignored): {message}")
# #             return

# #         mtype = data.get("type")
# #         if mtype == "audio_chunk":
# #             try:
# #                 audio_bytes = b64_decode(data["data"])
# #                 self.input_q.put({"kind": "audio", "bytes": audio_bytes})
# #             except Exception as e:
# #                 print("💥 Invalid audio_chunk from client:", e)

# #         elif mtype == "commit":
# #             self.input_q.put({"kind": "commit"})

# #         elif mtype == "text":
# #             self.input_q.put({"kind": "text", "text": data.get("data", "")})

# #         elif mtype == "close":
# #             self.ws.close()

# #         else:
# #             print("📲 Unrecognized client message:", data)

# #     def on_close(self, reason):
# #         print("🛑 WebSocket client disconnected:", reason)
# #         self.input_q.put(None)
# #         self.loop.run_until_complete(self.runner_task)
# #         self.loop.close()
# #         print("✅ Gemini session cleaned up")

# # # -------------------------
# # # Run server
# # # -------------------------
# # if __name__ == "__main__":
# #     print(f"Starting server with model: {MODEL}")
# #     server = WebSocketServer(
# #         ("0.0.0.0", 5000),
# #         Resource({"/realtime": RealtimeApp})
# #     )
# #     server.serve_forever()







# # app.py (updated) ---------------------------------------------------------
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

# load_dotenv()
# GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
# MODEL = os.getenv("MODEL", "models/gemini-2.0-flash-exp")

# if not GOOGLE_API_KEY:
#     raise RuntimeError("💥 GOOGLE_API_KEY not set in .env")

# def b64_encode(b: bytes) -> str:
#     return base64.b64encode(b).decode("ascii")

# def b64_decode(s: str) -> bytes:
#     return base64.b64decode(s)

# # -------------------------
# # Gemini session runner (same as your logic, slightly hardened)
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
#         # increased timeout
#         async with client.aio.live.connect(model=MODEL, config=config ) as session:
#             print("✅ Connected to Gemini API.")

#             async def receiver():
#                 try:
#                     async for resp in session.receive():
#                         # print("🔄 Gemini event1:", event)
#                         if resp is None:
#                             break

#                         audio_bytes = getattr(resp, "data", None)
#                         if audio_bytes:
#                             # print("🔄 Gemini event2:", event)
#                             output_queue.put({"type": "audio", "data": b64_encode(audio_bytes)})
#                             continue

#                         sc = getattr(resp, "server_content", None)
#                         if sc and getattr(sc, "model_turn", None):
#                             # print("🔄 Gemini event3:", event)
#                             parts = getattr(sc.model_turn, "parts", []) or []
#                             for part in parts:
#                                 txt = getattr(part, "text", None)
#                                 if txt:
#                                     # print("🔄 Gemini event4:", event)
#                                     output_queue.put({"type": "text", "data": txt})
#                                 inline = getattr(part, "inline_data", None)
#                                 if inline:
#                                     # print("🔄 Gemini event5:", event)
#                                     inline_bytes = getattr(inline, "data", None)
#                                     if inline_bytes:
#                                         # print("🔄 Gemini event6:", event)
#                                         output_queue.put({"type": "audio", "data": b64_encode(inline_bytes)})

#                         if sc and getattr(sc, "output_transcription", None):
#                             # print("🔄 Gemini event7:", event)
#                             ttxt = getattr(sc.output_transcription, "text", None)
#                             if ttxt:
#                                 # print("🔄 Gemini event8:", event)
#                                 output_queue.put({"type": "text", "data": ttxt})

#                 except Exception as e:
#                     print(f"💥 ERROR in receiver: {e}")
#                     traceback.print_exc()
#                 finally:
#                     output_queue.put(None)

#             recv_task = asyncio.create_task(receiver())

#             while True:
#                 item = await asyncio.to_thread(input_queue.get)
#                 if item is None:
#                     break

#                 kind = item.get("kind") or item.get("type") or ""
#                 if kind == "audio":
#                     audio_bytes = item.get("bytes")
#                     if not isinstance(audio_bytes, (bytes, bytearray)):
#                         print("⚠️ Received non-bytes audio; skipping")
#                         continue
#                     print(f"🎧 Received audio from frontend ({len(audio_bytes)} bytes)")
#                     blob = genai.types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
#                     try:
#                         await session.send_realtime_input(audio=blob)
#                         # await session.send({"type": "input_audio.close"})
#                     except Exception as e:
#                         print("💥 send_realtime_input failed:", e)

#                 elif kind == "commit":
#                     try:
#                         await session.send_realtime_input(audio_stream_end=True)
#                     except Exception as e:
#                         print("💥 send_realtime_input(audio_stream_end=True) failed:", e)

#                 elif kind == "text":
#                     text_value = item.get("text", "")
#                     if text_value:
#                         try:
#                             await session.send_client_content(
#                                 turns=genai.types.Content(role="user", parts=[genai.types.Part(text=text_value)])
#                             )
#                         except Exception as e:
#                             print("💥 send_client_content failed:", e)
#                 else:
#                     print("⚠️ Ignoring unknown input item:", kind, item)

#             try:
#                 recv_task.cancel()
#             except Exception:
#                 pass

#     except Exception as e:
#         print(f"💥 ERROR in Gemini session runner: {e}")
#         traceback.print_exc()
#     finally:
#         output_queue.put(None)
#         print("🛑 Gemini session runner finished.")

# # -------------------------
# # WebSocket app (with proper asyncio-thread handling)
# # -------------------------
# class RealtimeApp(WebSocketApplication):
#     def on_open(self):
#         print("🚀 WebSocket client connected")
#         self.input_q = Queue()
#         self.output_q = Queue()

#         # forward Gemini -> browser (gevent greenlet)
#         def forward_to_browser():
#             while True:
#                 ev = self.output_q.get()
#                 if ev is None:
#                     break
#                 try:
#                     # self.ws.send(json.dumps(ev))
#                     if ev.get("type") == "response.output_audio":
#                         audio_data = ev["audio"]
#                         if isinstance(audio_data, str):
#                             # base64 hi hota hai mostly
#                             payload = {"type": "audio", "data": audio_data}
#                             self.ws.send(json.dumps(payload))
#                     elif ev.get("type") == "response.output_text":
#                         text_data = ev["text"]
#                         payload = {"type": "text", "data": text_data}
#                         self.ws.send(json.dumps(payload))
#                     else:
#                         # fallback (debugging ke liye)
#                         self.ws.send(json.dumps({"type": "debug", "data": ev}))

#                 except Exception as e:
#                     print("💥 ERROR sending to browser:", e)
#                     break

#         spawn(forward_to_browser)

#         # Create a dedicated asyncio event loop running in a thread
#         self.loop = asyncio.new_event_loop()
#         self.loop_thread = threading.Thread(target=self._loop_runner, daemon=True)
#         self.loop_thread.start()

#         # Schedule gemini_session_runner on that loop
#         self.runner_future = asyncio.run_coroutine_threadsafe(
#             gemini_session_runner(self.input_q, self.output_q), self.loop
#         )

#     def _loop_runner(self):
#         asyncio.set_event_loop(self.loop)
#         self.loop.run_forever()
#         # cleanup loop after stop
#         pending = asyncio.all_tasks(loop=self.loop)
#         for t in pending:
#             try:
#                 t.cancel()
#             except Exception:
#                 pass
#         try:
#             self.loop.run_until_complete(self.loop.shutdown_asyncgens())
#         except Exception:
#             pass
#         finally:
#             self.loop.close()

#     def on_message(self, message):
#         if message is None:
#             return
#         try:
#             data = json.loads(message)
#         except Exception:
#             print(f"📲 Non-JSON message (ignored): {message}")
#             return

#         mtype = data.get("type")
#         if mtype == "audio_chunk":
#             try:
#                 audio_bytes = b64_decode(data["data"])
#                 self.input_q.put({"kind": "audio", "bytes": audio_bytes})
#             except Exception as e:
#                 print("💥 Invalid audio_chunk from client:", e)

#         elif mtype == "commit":
#             self.input_q.put({"kind": "commit"})

#         elif mtype == "text":
#             self.input_q.put({"kind": "text", "text": data.get("data", "")})

#         elif mtype == "close":
#             try:
#                 self.ws.close()
#             except Exception:
#                 pass

#         else:
#             print("📲 Unrecognized client message:", data)

#     def on_close(self, reason):
#         print("🛑 WebSocket client disconnected:", reason)
#         try:
#             # Signal runner to exit
#             self.input_q.put(None)

#             # wait for runner to finish (with timeout)
#             if hasattr(self, "runner_future") and self.runner_future:
#                 try:
#                     self.runner_future.result(timeout=15)
#                 except Exception as e:
#                     print("⚠️ runner_future result/timeout:", e)

#             # stop the event loop thread
#             if hasattr(self, "loop"):
#                 self.loop.call_soon_threadsafe(self.loop.stop)
#             if hasattr(self, "loop_thread"):
#                 self.loop_thread.join(timeout=5)
#         except Exception as e:
#             print("💥 Error on_close cleanup:", e)
#         finally:
#             print("✅ Gemini session cleaned up")

# # -------------------------
# # Run server
# # -------------------------
# if __name__ == "__main__":
#     print(f"Starting server with model: {MODEL}")
#     server = WebSocketServer(("0.0.0.0", 5000), Resource({"/realtime": RealtimeApp}))
#     server.serve_forever()
# # --------------------------------------------------------------------------










# app.py
import asyncio
import threading
import os
import base64
import json
import traceback
from queue import Queue
from dotenv import load_dotenv
from geventwebsocket import WebSocketServer, WebSocketApplication, Resource
from gevent import spawn
from google import genai
from google.genai import types


# -------------------------
# Load environment
# -------------------------
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
MODEL = os.getenv("MODEL", "models/gemini-2.0-flash-exp")

if not GOOGLE_API_KEY:
    raise RuntimeError("💥 GOOGLE_API_KEY not set in .env")

# -------------------------
# Base64 helpers
# -------------------------
def b64_encode(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")

def b64_decode(s: str) -> bytes:
    return base64.b64decode(s)

# -------------------------
# Gemini session runner
# -------------------------
async def gemini_session_runner(input_queue: Queue, output_queue: Queue):
    print("🤖 Gemini session runner started.")
    client = genai.Client(api_key=GOOGLE_API_KEY)

    config = {
        "response_modalities": ["AUDIO"],
        "system_instruction": "You are a friendly voice bot. Keep replies concise.",
        "temperature": 0.3,
        "max_output_tokens": 800,
    }

    try:
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            print("✅ Connected to Gemini API.")

            # ---------------- Receiver ----------------
            async def receiver():
                try:
                    async for resp in session.receive():
                        # 🔍 Debug log
                        print("🔄 RAW Gemini Response:", resp)

                        # Raw audio chunks
                        audio_bytes = getattr(resp, "data", None)
                        if audio_bytes:
                            output_queue.put({"type": "audio", "data": b64_encode(audio_bytes)})
                            continue

                        # Server-side structured response
                        sc = getattr(resp, "server_content", None)
                        if sc and getattr(sc, "model_turn", None):
                            for part in (sc.model_turn.parts or []):
                                if getattr(part, "text", None):
                                    output_queue.put({"type": "text", "data": part.text})
                                if getattr(part, "inline_data", None) and getattr(part.inline_data, "data", None):
                                    output_queue.put({"type": "audio", "data": b64_encode(part.inline_data.data)})

                        # Transcriptions
                        if sc and getattr(sc, "output_transcription", None):
                            if sc.output_transcription.text:
                                output_queue.put({"type": "text", "data": sc.output_transcription.text})

                except Exception as e:
                    print(f"💥 ERROR in receiver: {e}")
                    traceback.print_exc()
                finally:
                    output_queue.put(None)

            recv_task = asyncio.create_task(receiver())

            # ---------------- Sender ----------------
            while True:
                item = await asyncio.to_thread(input_queue.get)
                if item is None:
                    break

                kind = item.get("kind")
                if kind == "audio":
                    audio_bytes = item.get("bytes")
                    if isinstance(audio_bytes, (bytes, bytearray)):
                        await session.send_realtime_input(
                            # "type": "input_audio_buffer.append",
                            # "audio": b64_encode(audio_bytes)
                            # types.InputAudioBufferAppendEvent(
                            #     audio=b64_encode(audio_bytes)
                            # )
                            audio=types.Blob(
                                data=audio_bytes,  # already raw bytes, not base64
                                mime_type="audio/pcm;rate=16000"  # or correct rate
                            )
                        )
                    else:
                        print("⚠️ Skipping invalid audio")

                elif kind == "commit":
                    # await session.send({"type": "input_audio_buffer.commit"})
                    # await session.send({"type": "input_audio.close"})
                    await session.send(types.InputAudioBufferCommitEvent())
                    await session.send(types.InputAudioCloseEvent()) 

                elif kind == "text":
                    text_value = item.get("text", "")
                    if text_value:
                        # await session.send({"type": "input_text", "text": text_value})
                        await session.send(types.InputTextEvent(text=text_value))

            # ---------------- Cleanup ----------------
            recv_task.cancel()

    except Exception as e:
        print(f"💥 ERROR in Gemini session runner: {e}")
        traceback.print_exc()
    finally:
        output_queue.put(None)
        print("🛑 Gemini session runner finished.")

# -------------------------
# WebSocket app
# -------------------------
class RealtimeApp(WebSocketApplication):
    def on_open(self):
        print("🚀 WebSocket client connected")
        self.input_q = Queue()
        self.output_q = Queue()

        # forward Gemini -> browser
        def forward_to_browser():
            while True:
                ev = self.output_q.get()
                if ev is None:
                    break
                try:
                    self.ws.send(json.dumps(ev))
                except Exception as e:
                    print("💥 ERROR sending to browser:", e)
                    break

        spawn(forward_to_browser)

        # Start async loop in background thread
        self.loop = asyncio.new_event_loop()
        self.loop_thread = threading.Thread(target=self._loop_runner, daemon=True)
        self.loop_thread.start()

        # Run Gemini runner
        self.runner_future = asyncio.run_coroutine_threadsafe(
            gemini_session_runner(self.input_q, self.output_q), self.loop
        )

    def _loop_runner(self):
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()

    def on_message(self, message):
        if not message:
            return
        try:
            data = json.loads(message)
        except Exception:
            print(f"📲 Invalid JSON: {message}")
            return

        mtype = data.get("type")
        if mtype == "audio_chunk":
            try:
                self.input_q.put({"kind": "audio", "bytes": b64_decode(data["data"])})
            except Exception as e:
                print("💥 Bad audio_chunk:", e)

        elif mtype == "commit":
            self.input_q.put({"kind": "commit"})

        elif mtype == "text":
            self.input_q.put({"kind": "text", "text": data.get("data", "")})

        elif mtype == "close":
            self.input_q.put(None)
            self.ws.close()

    def on_close(self, reason):
        print("🛑 WebSocket client disconnected:", reason)
        try:
            self.input_q.put(None)
            if self.runner_future:
                self.runner_future.result(timeout=10)
            if self.loop:
                self.loop.call_soon_threadsafe(self.loop.stop)
            if self.loop_thread:
                self.loop_thread.join(timeout=5)
        except Exception as e:
            print("💥 Cleanup error:", e)
        finally:
            print("✅ Gemini session cleaned up")

# -------------------------
# Run server
# -------------------------
if __name__ == "__main__":
    print(f"Starting server with model: {MODEL}")
    server = WebSocketServer(("0.0.0.0", 5000), Resource({"/realtime": RealtimeApp}))
    server.serve_forever()
