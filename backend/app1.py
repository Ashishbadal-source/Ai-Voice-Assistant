import asyncio
import os
import base64
import threading
from queue import Queue
from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from flask_sock import Sock
import traceback

from google import genai
from google.genai.live import SendEvent, InputAudioBuffer, InputAudioBufferCommit, ResponseCreate

load_dotenv()

app = Flask(__name__)
CORS(app)
sock = Sock(app)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
MODEL = os.getenv("MODEL", "gemini-1.5-flash-latest") 

def create_send_event(message):
    message_type = message.get("type")
    if message_type == "input_audio_buffer.append":
        audio_buffer = InputAudioBuffer()
        audio_buffer.audio = message.get("audio")
        return SendEvent(input_audio_buffer=audio_buffer)
    elif message_type == "input_audio_buffer.commit":
        return SendEvent(input_audio_buffer_commit=InputAudioBufferCommit())
    elif message_type == "response.create":
        return SendEvent(response_create=ResponseCreate())
    return None

async def gemini_session_runner(input_queue: Queue, output_queue: Queue):
    """Handles the asynchronous communication with the Gemini API."""
    print("🤖 Gemini session runner started.")
    try:
        config = {
            "response_modalities": ["AUDIO"],
            "system_instruction": "You are a friendly voice bot. Keep replies concise.",
        }
        
        client = genai.Client(api_key=GOOGLE_API_KEY)
        
        async with client.aio.live.connect(model=MODEL, config=config) as session:
            print("✅ Connected to Gemini API.")
            
            is_listening_for_response = False
            
            while True:
                if is_listening_for_response:
                    print("   👂 Listening for response from Gemini...")
                    try:
                        event = await asyncio.wait_for(session.receive(), timeout=1.0)
                        if event is None:
                            print("   ➡️  Gemini stream ended.")
                            break
                        print(f"   ⬅️  Received from Gemini: {event.get('type')}")
                        output_queue.put(event)
                    except asyncio.TimeoutError:
                        continue
                
                try:
                    input_message = await asyncio.to_thread(input_queue.get, timeout=0.1) 
                    
                    if input_message is None:
                        print("   🛑 Session ending signal received.")
                        break
                    
                    send_event = create_send_event(input_message)
                    if send_event:
                        print(f"   ➡️  Forwarding to Gemini: {send_event.send_event.WhichOneof('message')}")
                        await session.send(send_event)
                    
                    if input_message.get("type") == "response.create":
                        is_listening_for_response = True
                        
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    print(f"💥 ERROR processing input queue message: {e}")
                    traceback.print_exc()
                    break

    except Exception as e:
        print(f"💥 ERROR in Gemini session runner: {e}")
        traceback.print_exc()
    finally:
        output_queue.put(None)
        print("🛑 Gemini session runner finished.")


@sock.route("/ws")
def ws_proxy(ws):
    print("\n🚀 WebSocket client connected.")
    input_audio_queue = Queue()
    output_event_queue = Queue()

    def run_asyncio_loop():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(gemini_session_runner(input_audio_queue, output_event_queue))
        finally:
            loop.close()

    gemini_thread = threading.Thread(target=run_asyncio_loop)
    gemini_thread.start()

    def send_to_browser():
        while True:
            event = output_event_queue.get()
            if event is None:
                break
            
            print(f"   📤 Sending to browser: {event.get('type')}")
            if event.get("type") == "response.output_audio":
                audio_data = event["audio"]
                if isinstance(audio_data, str):
                    audio_data = base64.b64decode(audio_data)
                ws.send(audio_data)
            elif event.get("type") == "response.message":
                text_msg = event.get("text", "")
                if text_msg:
                    ws.send(text_msg)

    send_thread = threading.Thread(target=send_to_browser)
    send_thread.start()

    try:
        while True:
            message = ws.receive()
            if message is None:
                break

            if isinstance(message, str):
                print(f"📲 Received from browser: '{message}'")
                if message == "commit":
                    input_audio_queue.put({"type": "input_audio_buffer.commit"})
                    input_audio_queue.put({"type": "response.create"})
                elif message == "close":
                    break
            else:
                print(f"📲 Received from browser: Binary audio chunk ({len(message)} bytes)")
                input_audio_queue.put({
                    "type": "input_audio_buffer.append",
                    "audio": message
                })
    finally:
        print("🛑 WebSocket client disconnected. Waiting for threads to clean up...")
        input_audio_queue.put(None)
        gemini_thread.join()
        send_thread.join()
        print("✅ Threads cleaned up successfully.")

if __name__ == "__main__":
    print(f"Starting server with model: {MODEL}")
    app.run(host="0.0.0.0", port=5000, debug=False)