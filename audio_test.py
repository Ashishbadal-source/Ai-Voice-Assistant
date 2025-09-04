import sounddevice as sd
import numpy as np
import wave
import base64

# ---------- Base64 helpers ----------
def b64_encode(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")

def b64_decode(s: str) -> bytes:
    return base64.b64decode(s)

# ---------- Step 1: Record audio ----------
duration = 5  # seconds
samplerate = 44100  # Hz
print("🎤 Recording for 5 seconds...")
audio_data = sd.rec(int(duration * samplerate), samplerate=samplerate, channels=1, dtype='int16')
sd.wait()
print("✅ Recording complete!")

# Convert numpy array to bytes (WAV format)
wav_file = "original.wav"
with wave.open(wav_file, 'wb') as wf:
    wf.setnchannels(1)          # mono
    wf.setsampwidth(2)          # 16-bit
    wf.setframerate(samplerate)
    wf.writeframes(audio_data.tobytes())
print(f"🎵 Saved original audio: {wav_file}")

# ---------- Step 2: Encode audio ----------
with open(wav_file, "rb") as f:
    audio_bytes = f.read()

encoded_str = b64_encode(audio_bytes)
print("📤 Encoded Base64 (first 100 chars):")
print(encoded_str[:100])

# ---------- Step 3: Decode back ----------
decoded_bytes = b64_decode(encoded_str)

# ---------- Step 4: Save decoded audio ----------
decoded_file = "decoded.wav"
with open(decoded_file, "wb") as f:
    f.write(decoded_bytes)

print(f"✅ Decoded audio saved as {decoded_file}")
