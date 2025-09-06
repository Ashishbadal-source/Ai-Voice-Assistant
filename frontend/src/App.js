// // // import React, { useEffect, useRef, useState } from "react";

// // // function App() {
// // //   const [logMessages, setLogMessages] = useState([]);
// // //   const wsRef = useRef(null);
// // //   const audioCtxRef = useRef(null);
// // //   const micStreamRef = useRef(null);
// // //   const processorNodeRef = useRef(null);
// // //   const sourceNodeRef = useRef(null);
// // //   const outCtxRef = useRef(null);
// // //   const outProcessorRef = useRef(null);
// // //   const outQueueRef = useRef([]);

// // //   const log = (...a) => {
// // //     setLogMessages((prev) => [...prev, a.join(" ")]);
// // //   };

// // //   // --- downsample Float32 to PCM16 @16kHz
// // //   function downsampleTo16k(float32, inSampleRate) {
// // //     const outRate = 16000;
// // //     const ratio = inSampleRate / outRate;
// // //     const outLen = Math.floor(float32.length / ratio);
// // //     const out = new Int16Array(outLen);
// // //     for (let i = 0; i < outLen; i++) {
// // //       const idx = Math.floor(i * ratio);
// // //       let s = float32[idx];
// // //       s = Math.max(-1, Math.min(1, s));
// // //       out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
// // //     }
// // //     return out.buffer; // ArrayBuffer
// // //   }

// // //   // --- convert PCM16 Int16Array -> Float32 [-1,1]
// // //   function pcm16ToFloat32(int16) {
// // //     const out = new Float32Array(int16.length);
// // //     for (let i = 0; i < int16.length; i++) {
// // //       out[i] = int16[i] / 0x8000;
// // //     }
// // //     return out;
// // //   }

// // //   // --- output player @24kHz
// // //   function initOutputPlayer() {
// // //     const outCtx = new (window.AudioContext || window.webkitAudioContext)({
// // //       sampleRate: 24000,
// // //     });
// // //     const outProcessor = outCtx.createScriptProcessor(2048, 0, 1);
// // //     outProcessor.onaudioprocess = (e) => {
// // //       const out = e.outputBuffer.getChannelData(0);
// // //       out.fill(0);
// // //       let offset = 0;
// // //       while (offset < out.length && outQueueRef.current.length) {
// // //         const chunk = outQueueRef.current.shift();
// // //         const toCopy = Math.min(chunk.length, out.length - offset);
// // //         out.set(chunk.subarray(0, toCopy), offset);
// // //         offset += toCopy;
// // //         if (toCopy < chunk.length) {
// // //           outQueueRef.current.unshift(chunk.subarray(toCopy));
// // //         }
// // //       }
// // //     };
// // //     outProcessor.connect(outCtx.destination);
// // //     outCtxRef.current = outCtx;
// // //     outProcessorRef.current = outProcessor;
// // //     log("Audio output player initialized (24kHz)");
// // //   }

// // //   async function start() {
// // //     try {
// // //       const ws = new WebSocket(`ws://${window.location.hostname}:5000/ws`);
// // //       ws.binaryType = "arraybuffer";

// // //       ws.onopen = () => log("✅ WS connected");
// // //       ws.onerror = (e) => log("❌ WS error:", e.message || e);
// // //       ws.onclose = () => log("WS: closed");

// // //       ws.onmessage = (evt) => {
// // //         if (evt.data instanceof ArrayBuffer) {
// // //           const i16 = new Int16Array(evt.data);
// // //           const f32 = pcm16ToFloat32(i16);
// // //           outQueueRef.current.push(f32);
// // //           log("🔊 Received Gemini audio chunk");
// // //         } else {
// // //           log("server:", evt.data);
// // //         }
// // //       };

// // //       wsRef.current = ws;

// // //       const audioCtx = new (window.AudioContext ||
// // //         window.webkitAudioContext)();
// // //       audioCtxRef.current = audioCtx;

// // //       const micStream = await navigator.mediaDevices.getUserMedia({
// // //         audio: { channelCount: 1, noiseSuppression: true, echoCancellation: true },
// // //       });
// // //       micStreamRef.current = micStream;

// // //       const sourceNode = audioCtx.createMediaStreamSource(micStream);
// // //       sourceNodeRef.current = sourceNode;

// // //       const processorNode = audioCtx.createScriptProcessor(4096, 1, 1);
// // //       processorNode.onaudioprocess = (e) => {
// // //         if (!ws || ws.readyState !== 1) return;
// // //         const input = e.inputBuffer.getChannelData(0);
// // //         const buf = downsampleTo16k(input, audioCtx.sampleRate);
// // //         ws.send(buf);
// // //       };
// // //       processorNodeRef.current = processorNode;

// // //       sourceNode.connect(processorNode);
// // //       processorNode.connect(audioCtx.createGain());

// // //       initOutputPlayer();

// // //       log("🎤 Mic streaming started");
// // //     } catch (err) {
// // //       log("Error starting audio:", err);
// // //     }
// // //   }

// // //   function commitTurn() {
// // //     if (wsRef.current && wsRef.current.readyState === 1) {
// // //       wsRef.current.send("commit");
// // //       log("📩 Committed current turn → awaiting Gemini reply…");
// // //     }
// // //   }

// // //   function stop() {
// // //     try {
// // //       if (wsRef.current && wsRef.current.readyState === 1) wsRef.current.send("close");
// // //     } catch {}
// // //     try { wsRef.current && wsRef.current.close(); } catch {}
// // //     try { processorNodeRef.current && processorNodeRef.current.disconnect(); } catch {}
// // //     try { sourceNodeRef.current && sourceNodeRef.current.disconnect(); } catch {}
// // //     try { micStreamRef.current && micStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
// // //     try { audioCtxRef.current && audioCtxRef.current.close(); } catch {}
// // //     try { outProcessorRef.current && outProcessorRef.current.disconnect(); } catch {}
// // //     try { outCtxRef.current && outCtxRef.current.close(); } catch {}
// // //     outQueueRef.current = [];
// // //     log("⏹️ Stopped");
// // //   }

// // //   return (
// // //     <div style={{ fontFamily: "system-ui", padding: 20 }}>
// // //       <h2>Gemini Live: Realtime Voice</h2>
// // //       <button onClick={start}>Start</button>
// // //       <button onClick={commitTurn}>Commit turn</button>
// // //       <button onClick={stop}>Stop</button>
// // //       <div
// // //         style={{
// // //           whiteSpace: "pre-wrap",
// // //           background: "#111",
// // //           color: "#eee",
// // //           padding: 10,
// // //           height: 160,
// // //           overflow: "auto",
// // //           marginTop: 10,
// // //         }}
// // //       >
// // //         {logMessages.join("\n")}
// // //       </div>
// // //     </div>
// // //   );
// // // }

// // // export default App;







// // // import React, { useState, useEffect, useRef } from "react";

// // // function App() {
// // //   const [response, setResponse] = useState("");
// // //   const [logMessages, setLogMessages] = useState([]);
// // //   const [isConnected, setIsConnected] = useState(false);

// // //   const wsRef = useRef(null);
// // //   const audioCtxRef = useRef(null);
// // //   const micStreamRef = useRef(null);
// // //   const micSourceRef = useRef(null);
// // //   const workletNodeRef = useRef(null);
// // //   const playbackWorkletRef = useRef(null); 

// // //   function log(...args) {
// // //     setLogMessages(prev => [...prev, args.join(" ")]);
// // //     console.log(...args);
// // //   }

// // //   function pcm16ToFloat32(int16) {
// // //     const out = new Float32Array(int16.length);
// // //     for (let i = 0; i < int16.length; i++) out[i] = int16[i] / 0x8000;
// // //     return out;
// // //   }
  
// // //   const start = async () => {
// // //     if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
// // //       log("Connection already in progress...");
// // //       return;
// // //     }
    
// // //     if (audioCtxRef.current && audioCtxRef.current.state === "running") {
// // //       log("Closing previous audio context before starting a new one...");
// // //       await stop();
// // //     }

// // //     log("🚀 Starting session...");
// // //     const ws = new WebSocket(`ws://${window.location.hostname}:5000/ws`);
// // //     ws.binaryType = "arraybuffer";
// // //     wsRef.current = ws;

// // //     ws.onopen = () => {
// // //       log("✅ WS connected");
// // //       setIsConnected(true);
// // //     };
// // //     ws.onerror = (e) => {
// // //       log("❌ WS error:", e.message || "Connection failed");
// // //       setIsConnected(false);
// // //     };
// // //     ws.onclose = () => {
// // //       log("WS closed");
// // //       setIsConnected(false);
// // //     };

// // //     const audioCtx = new AudioContext({ sampleRate: 24000 });
// // //     audioCtxRef.current = audioCtx;

// // //     log("Loading playback worklet...");
// // //     await audioCtx.audioWorklet.addModule("playback-processor.js");
// // //     const playbackWorklet = new AudioWorkletNode(audioCtx, "playback-processor");
// // //     playbackWorklet.connect(audioCtx.destination);
// // //     playbackWorkletRef.current = playbackWorklet;
// // //     log("Playback worklet loaded.");

// // //     ws.onmessage = (event) => {
// // //       if (event.data instanceof ArrayBuffer) {
// // //         const int16 = new Int16Array(event.data);
// // //         const float32 = pcm16ToFloat32(int16);
// // //         if (playbackWorkletRef.current) {
// // //             playbackWorkletRef.current.port.postMessage(float32);
// // //         }
// // //       } else {
// // //         log("Server:", event.data);
// // //         setResponse(event.data);
// // //       }
// // //     };
    
// // //     try {
// // //       log("Requesting microphone access...");
// // //       const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
// // //       micStreamRef.current = micStream;
// // //       log("Microphone access granted.");

// // //       const micSource = audioCtx.createMediaStreamSource(micStream);
// // //       micSourceRef.current = micSource;
      
// // //       log("Loading microphone worklet...");
// // //       await audioCtx.audioWorklet.addModule("mic-processor.js");
// // //       const micWorklet = new AudioWorkletNode(audioCtx, "mic-processor");
      
// // //       log("Sending sample rate to mic worklet:", audioCtx.sampleRate);
// // //       micWorklet.port.postMessage({ sampleRate: audioCtx.sampleRate });
      
// // //       micWorklet.port.onmessage = (event) => {
// // //         const pcm16Data = event.data;
// // //         if (ws.readyState === WebSocket.OPEN) {
// // //           ws.send(pcm16Data);
// // //         }
// // //       };
      
// // //       micSource.connect(micWorklet);
// // //       workletNodeRef.current = micWorklet;
// // //       log("🎤 Mic and AudioWorklets initialized");
// // //     } catch (error) {
// // //       log("❌ Error initializing microphone:", error);
// // //     }
// // //   };

// // //   const stop = async () => {
// // //     if (!wsRef.current) return;
    
// // //     log("🛑 Stopping session...");
// // //     setIsConnected(false); 
    
// // //     if (wsRef.current.readyState === WebSocket.OPEN) {
// // //         log("Sending 'close' message to server...");
// // //         wsRef.current.send("close");
// // //     }
// // //     wsRef.current.close();
// // //     wsRef.current = null;
    
// // //     if (workletNodeRef.current) {
// // //       workletNodeRef.current.port.onmessage = null;
// // //       workletNodeRef.current.disconnect();
// // //       workletNodeRef.current = null;
// // //     }
// // //     if (playbackWorkletRef.current) {
// // //       playbackWorkletRef.current.disconnect();
// // //       playbackWorkletRef.current = null;
// // //     }
// // //     if (micSourceRef.current) {
// // //         micSourceRef.current.disconnect();
// // //         micSourceRef.current = null;
// // //     }
// // //     if (micStreamRef.current) {
// // //       micStreamRef.current.getTracks().forEach(t => t.stop());
// // //       micStreamRef.current = null;
// // //       log("Microphone stream stopped.");
// // //     }
    
// // //     if (audioCtxRef.current) {
// // //       log("Closing AudioContext...");
// // //       await audioCtxRef.current.close();
// // //       audioCtxRef.current = null;
// // //       log("AudioContext closed.");
// // //     }
// // //     log("🛑 Session stopped.");
// // //   };

// // //   const commitTurn = () => {
// // //     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
// // //       wsRef.current.send("commit");
// // //       log("📤 Commit sent");
// // //     } else {
// // //       log("Cannot commit turn: WebSocket is not open.");
// // //     }
// // //   };

// // //   useEffect(() => {
// // //     return () => { if (wsRef.current) stop(); };
// // //   }, []);

// // //   return (
// // //     <div className="App">
// // //       <h1>Realtime Gemini Voice Chat</h1>
// // //       <button onClick={start} disabled={isConnected}>Start</button>
// // //       <button onClick={stop} disabled={!isConnected}>Stop</button>
// // //       <button onClick={commitTurn} disabled={!isConnected}>Commit Turn</button>
// // //       <h2>Response:</h2>
// // //       <div>{response}</div>
// // //       <h2>Logs:</h2>
// // //       <pre>{logMessages.join("\n")}</pre>
// // //     </div>
// // //   );
// // // }

// // // export default App;










// // import React, { useState, useEffect, useRef } from "react";

// // function App() {
// //   const [response, setResponse] = useState("");
// //   const [logMessages, setLogMessages] = useState([]);
// //   const [isConnected, setIsConnected] = useState(false);

// //   const wsRef = useRef(null);
// //   const audioCtxRef = useRef(null);
// //   const micStreamRef = useRef(null);
// //   const micSourceRef = useRef(null);
// //   const workletNodeRef = useRef(null);
// //   const playbackWorkletRef = useRef(null); 

// //   function log(...args) {
// //     setLogMessages(prev => [...prev, args.join(" ")]);
// //     console.log(...args);
// //   }

// //   // Convert ArrayBuffer -> base64
// //   function arrayBufferToBase64(buffer) {
// //     let binary = "";
// //     const bytes = new Uint8Array(buffer);
// //     const chunkSize = 0x8000;
// //     for (let i = 0; i < bytes.length; i += chunkSize) {
// //       let chunk = bytes.subarray(i, i + chunkSize);
// //       binary += String.fromCharCode.apply(null, chunk);
// //     }
// //     return btoa(binary);
// //   }

// //   // Convert base64 -> Float32 for playback
// //   function base64ToFloat32(base64) {
// //     const binary = atob(base64);
// //     const bytes = new Uint8Array(binary.length);
// //     for (let i = 0; i < binary.length; i++) {
// //       bytes[i] = binary.charCodeAt(i);
// //     }
// //     const int16 = new Int16Array(bytes.buffer);
// //     const out = new Float32Array(int16.length);
// //     for (let i = 0; i < int16.length; i++) out[i] = int16[i] / 0x8000;
// //     return out;
// //   }

// //   const start = async () => {
// //     log("🚀 Starting session...");
// //     const ws = new WebSocket(`ws://${window.location.hostname}:5000/ws`);
// //     wsRef.current = ws;

// //     ws.onopen = () => {
// //       log("✅ WS connected");
// //       setIsConnected(true);
// //     };
// //     ws.onerror = (e) => {
// //       log("❌ WS error:", e.message || "Connection failed");
// //       setIsConnected(false);
// //     };
// //     ws.onclose = () => {
// //       log("WS closed");
// //       setIsConnected(false);
// //     };

// //     const audioCtx = new AudioContext({ sampleRate: 24000 });
// //     audioCtxRef.current = audioCtx;

// //     log("Loading playback worklet...");
// //     await audioCtx.audioWorklet.addModule("playback-processor.js");
// //     const playbackWorklet = new AudioWorkletNode(audioCtx, "playback-processor");
// //     playbackWorklet.connect(audioCtx.destination);
// //     playbackWorkletRef.current = playbackWorklet;
// //     log("Playback worklet loaded.");

// //     ws.onmessage = (event) => {
// //       try {
// //         const data = JSON.parse(event.data);
// //         if (data.type === "audio") {
// //           const float32 = base64ToFloat32(data.data);
// //           playbackWorkletRef.current.port.postMessage(float32);
// //         } else if (data.type === "text") {
// //           log("Server:", data.data);
// //           setResponse(data.data);
// //         }
// //       } catch (e) {
// //         log("Invalid message from server:", event.data);
// //       }
// //     };
    
// //     try {
// //       log("Requesting microphone access...");
// //       const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
// //       micStreamRef.current = micStream;
// //       log("Microphone access granted.");

// //       const micSource = audioCtx.createMediaStreamSource(micStream);
// //       micSourceRef.current = micSource;
      
// //       log("Loading microphone worklet...");
// //       await audioCtx.audioWorklet.addModule("mic-processor.js");
// //       const micWorklet = new AudioWorkletNode(audioCtx, "mic-processor");
      
// //       log("Sending sample rate to mic worklet:", audioCtx.sampleRate);
// //       micWorklet.port.postMessage({ sampleRate: audioCtx.sampleRate });
      
// //       micWorklet.port.onmessage = (event) => {
// //         if (ws.readyState === WebSocket.OPEN) {
// //           const base64data = arrayBufferToBase64(event.data);
// //           ws.send(JSON.stringify({ type: "audio_chunk", data: base64data }));
// //         }
// //       };
      
// //       micSource.connect(micWorklet);
// //       workletNodeRef.current = micWorklet;
// //       log("🎤 Mic and AudioWorklets initialized");
// //     } catch (error) {
// //       log("❌ Error initializing microphone:", error);
// //     }
// //   };

// //   const stop = async () => {
// //     if (!wsRef.current) return;
// //     log("🛑 Stopping session...");
// //     wsRef.current.send(JSON.stringify({ type: "close" }));
// //     wsRef.current.close();
// //     setIsConnected(false);
// //   };

// //   const commitTurn = () => {
// //     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
// //       wsRef.current.send(JSON.stringify({ type: "commit" }));
// //       log("📤 Commit sent");
// //     }
// //   };

// //   useEffect(() => {
// //     return () => { if (wsRef.current) stop(); };
// //   }, []);

// //   return (
// //     <div className="App">
// //       <h1>Realtime Gemini Voice Chat</h1>
// //       <button onClick={start} disabled={isConnected}>Start</button>
// //       <button onClick={stop} disabled={!isConnected}>Stop</button>
// //       <button onClick={commitTurn} disabled={!isConnected}>Commit Turn</button>
// //       <h2>Response:</h2>
// //       <div>{response}</div>
// //       <h2>Logs:</h2>
// //       <pre>{logMessages.join("\n")}</pre>
// //     </div>
// //   );
// // }

// // export default App;


















// import React, { useState, useEffect, useRef } from "react";

// function App() {
//   const [response, setResponse] = useState("");
//   const [logMessages, setLogMessages] = useState([]);
//   const [isConnected, setIsConnected] = useState(false);

//   const wsRef = useRef(null);
//   const audioCtxRef = useRef(null);
//   const micStreamRef = useRef(null);
//   const micSourceRef = useRef(null);
//   const workletNodeRef = useRef(null);
//   const playbackWorkletRef = useRef(null);

//   function log(...args) {
//     setLogMessages((prev) => [...prev, args.join(" ")]);
//     console.log(...args);
//   }

//   // ArrayBuffer -> base64
//   function arrayBufferToBase64(buffer) {
//     let binary = "";
//     const bytes = new Uint8Array(buffer);
//     const chunkSize = 0x8000;
//     for (let i = 0; i < bytes.length; i += chunkSize) {
//       const chunk = bytes.subarray(i, i + chunkSize);
//       binary += String.fromCharCode.apply(null, chunk);
//     }
//     return btoa(binary);
//   }

//   // base64 (Int16) -> Float32 for playback
//   function base64ToFloat32(base64) {
//     const binary = atob(base64);
//     const bytes = new Uint8Array(binary.length);
//     for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
//     const int16 = new Int16Array(bytes.buffer);
//     const out = new Float32Array(int16.length);
//     for (let i = 0; i < int16.length; i++) out[i] = int16[i] / 0x8000;
//     return out;
//   }

//   const start = async () => {
//     if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
//       log("Connection already in progress...");
//       return;
//     }
//     if (audioCtxRef.current && audioCtxRef.current.state === "running") {
//       await stop();
//     }

//     log("🚀 Starting session...");
//     // const ws = new WebSocket(`ws://${window.location.hostname}:5000/ws`);
//     const scheme = window.location.protocol === "https:" ? "wss" : "ws";
//     const ws = new WebSocket(`${scheme}://${window.location.hostname}:5000/realtime`);
//     wsRef.current = ws;

//     ws.onopen = () => {
//       log("✅ WS connected");
//       setIsConnected(true);
//     };
//     ws.onerror = (e) => {
//       log("❌ WS error:", e?.message || "Connection failed");
//       setIsConnected(false);
//     };
//     ws.onclose = () => {
//       log("WS closed");
//       setIsConnected(false);
//     };

//     // Use 24 kHz AudioContext for playback (API returns 24 kHz audio)
//     const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
//       sampleRate: 24000,
//     });
//     audioCtxRef.current = audioCtx;

//     // Playback worklet
//     log("Loading playback worklet...");
//     await audioCtx.audioWorklet.addModule("playback-processor.js");
//     const playbackWorklet = new AudioWorkletNode(audioCtx, "playback-processor");
//     playbackWorklet.connect(audioCtx.destination);
//     playbackWorkletRef.current = playbackWorklet;
//     log("Playback worklet loaded.");

//     // Messages from server
//     ws.onmessage = (event) => {
//       try {
//         const data = JSON.parse(event.data);
//         if (data.type === "audio") {
//           const float32 = base64ToFloat32(data.data);
//           if (playbackWorkletRef.current) {
//             playbackWorkletRef.current.port.postMessage(float32);
//           }
//         } else if (data.type === "text") {
//           setResponse(data.data);
//           log("Server:", data.data);
//         }
//       } catch {
//         log("Invalid message from server:", event.data);
//       }
//     };

//     // Mic capture
//     try {
//       log("Requesting microphone access...");
//       const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       micStreamRef.current = micStream;
//       log("Microphone access granted.");

//       const micSource = audioCtx.createMediaStreamSource(micStream);
//       micSourceRef.current = micSource;

//       log("Loading microphone worklet...");
//       await audioCtx.audioWorklet.addModule("mic-processor.js");
//       const micWorklet = new AudioWorkletNode(audioCtx, "mic-processor");

//       // Tell the worklet to produce **16 kHz mono Int16 PCM** for Gemini input.
//       micWorklet.port.postMessage({ targetSampleRate: 16000 });

//       micWorklet.port.onmessage = (event) => {
//         if (ws.readyState === WebSocket.OPEN && event.data) {
//           // event.data is an ArrayBuffer containing Int16 PCM (16 kHz)
//           const base64data = arrayBufferToBase64(event.data);
//           ws.send(JSON.stringify({ type: "audio_chunk", data: base64data }));
//         }
//       };

//       micSource.connect(micWorklet);
//       workletNodeRef.current = micWorklet;
//       log("🎤 Mic and AudioWorklets initialized");
//     } catch (err) {
//       log("❌ Error initializing microphone:", err);
//     }
//   };

//   const stop = async () => {
//     log("🛑 Stopping session...");
//     setIsConnected(false);
//     try {
//       if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//         wsRef.current.send(JSON.stringify({ type: "close" }));
//         wsRef.current.close();
//       }
//       wsRef.current = null;

//       if (workletNodeRef.current) {
//         workletNodeRef.current.port.onmessage = null;
//         workletNodeRef.current.disconnect();
//         workletNodeRef.current = null;
//       }
//       if (playbackWorkletRef.current) {
//         playbackWorkletRef.current.disconnect();
//         playbackWorkletRef.current = null;
//       }
//       if (micSourceRef.current) {
//         micSourceRef.current.disconnect();
//         micSourceRef.current = null;
//       }
//       if (micStreamRef.current) {
//         micStreamRef.current.getTracks().forEach((t) => t.stop());
//         micStreamRef.current = null;
//         log("Microphone stream stopped.");
//       }
//       if (audioCtxRef.current) {
//         await audioCtxRef.current.close();
//         audioCtxRef.current = null;
//         log("AudioContext closed.");
//       }
//     } catch (e) {
//       log("Stop error:", e);
//     }
//     log("🛑 Session stopped.");
//   };

//   // Optional button – Live API responds without a manual "commit"
//   const commitTurn = () => {
//     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//       wsRef.current.send(JSON.stringify({ type: "commit" }));
//       log("📤 Commit sent");
//     }
//   };

//   useEffect(() => {
//     return () => {
//       if (wsRef.current) stop();
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   return (
//     <div className="App"> 
//       <h1>Realtime Gemini Voice Chat</h1>
//       <button onClick={start} disabled={isConnected}>Start</button>
//       <button onClick={stop} disabled={!isConnected}>Stop</button>
//       <button onClick={commitTurn} disabled={!isConnected}>Commit Turn</button>
//       <h2>Response (text, if any):</h2>
//       <div>{response}</div>
//       <h2>Logs:</h2>
//       <pre>{logMessages.join("\n")}</pre>
//     </div>
//   );
// }

// export default App;















// import React, { useState, useEffect, useRef } from "react";

// function App() {
//   const [response, setResponse] = useState("");
//   const [logMessages, setLogMessages] = useState([]);
//   const [isConnected, setIsConnected] = useState(false);

//   const wsRef = useRef(null);
//   const audioCtxRef = useRef(null);
//   const micStreamRef = useRef(null);
//   const micSourceRef = useRef(null);
//   const workletNodeRef = useRef(null);
//   const playbackWorkletRef = useRef(null);

//   function log(...args) {
//     setLogMessages((prev) => [...prev, args.join(" ")]);
//     console.log(...args);
//   }

//   // 🔹 ArrayBuffer → Base64
//   function arrayBufferToBase64(buffer) {
//     let binary = "";
//     const bytes = new Uint8Array(buffer);
//     const chunkSize = 0x8000;
//     for (let i = 0; i < bytes.length; i += chunkSize) {
//       const chunk = bytes.subarray(i, i + chunkSize);
//       binary += String.fromCharCode.apply(null, chunk);
//     }
//     return btoa(binary);
//   }

//   // 🔹 Base64 (Int16 PCM) → Float32 for playback
//   function base64ToFloat32(base64) {
//     const binary = atob(base64);
//     const bytes = new Uint8Array(binary.length);
//     for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
//     const int16 = new Int16Array(bytes.buffer);
//     const out = new Float32Array(int16.length);
//     for (let i = 0; i < int16.length; i++) out[i] = int16[i] / 0x8000;
//     return out;
//   }

//   // ---------------------------
//   // 🚀 Start Session
//   // ---------------------------
//   const start = async () => {
//     if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
//       log("⚠️ Connection already in progress...");
//       return;
//     }
//     if (audioCtxRef.current && audioCtxRef.current.state === "running") {
//       await stop();
//     }

//     log("🚀 Starting session...");
//     const scheme = window.location.protocol === "https:" ? "wss" : "ws";
//     // const ws = new WebSocket(`${scheme}://${window.location.hostname}:5000/realtime`);
//     const ws = new WebSocket("wss://ai-assistant-a8md.onrender.com/realtime");
//     wsRef.current = ws;

//     ws.onopen = () => {
//       log("✅ WebSocket connected to backend");
//       setIsConnected(true);
//     };
//     ws.onerror = (e) => {
//       log("❌ WebSocket error:", e?.message || "Connection failed");
//       setIsConnected(false);
//     };
//     ws.onclose = () => {
//       log("⚠️ WebSocket closed");
//       setIsConnected(false);
//     };

//     // 🔹 Create AudioContext for playback
//     const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
//       sampleRate: 24000,
//     });
//     audioCtxRef.current = audioCtx;
//     log("🎧 AudioContext created (24kHz for playback)");

//     // 🔹 Load Playback Worklet
//     log("⏳ Loading playback worklet...");
//     await audioCtx.audioWorklet.addModule("playback-processor.js");
//     const playbackWorklet = new AudioWorkletNode(audioCtx, "playback-processor");
//     playbackWorklet.connect(audioCtx.destination);
//     playbackWorkletRef.current = playbackWorklet;
//     log("✅ Playback worklet ready");

//     // 🔹 Handle Messages from server
//     ws.onmessage = (event) => {
//       try {
//         const data = JSON.parse(event.data);

//         if (data.type === "audio") {
//           log("🎵 Received audio chunk from server");
//           const float32 = base64ToFloat32(data.data);
//           if (playbackWorkletRef.current) {
//             playbackWorkletRef.current.port.postMessage(float32);
//           }
//         } else if (data.type === "text") {
//           log("💬 Received text response:", data.data);
//           setResponse(data.data);
//         } else {
//           log("⚠️ Unknown server message:", event.data);
//         }
//       } catch {
//         log("❌ Invalid JSON message from server:", event.data);
//       }
//     };

//     // 🔹 Setup Microphone
//     try {
//       log("🎤 Requesting microphone access...");
//       const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       micStreamRef.current = micStream;
//       log("✅ Microphone access granted");

//       const micSource = audioCtx.createMediaStreamSource(micStream);
//       micSourceRef.current = micSource;

//       log("⏳ Loading mic worklet...");
//       await audioCtx.audioWorklet.addModule("mic-processor.js");
//       const micWorklet = new AudioWorkletNode(audioCtx, "mic-processor");

//       // Tell worklet: 16 kHz mono PCM Int16
//       micWorklet.port.postMessage({ targetSampleRate: 16000 });

//       // micWorklet.port.onmessage = (event) => {
//       //   if (ws.readyState === WebSocket.OPEN && event.data) {
//       //     const base64data = arrayBufferToBase64(event.data);
//       //     // ws.send(JSON.stringify({ type: "audio_chunk", data: base64data })); 
//       //     ws.send(JSON.stringify({ type: "commit" }));
//       //     log("📤 Sent mic audio chunk to server");
//       //   }
//       // };
//       micWorklet.port.onmessage = (event) => {
//       if (ws.readyState === WebSocket.OPEN && event.data) {
//       const base64data = arrayBufferToBase64(event.data);
//       // ✅ send audio chunks
//       ws.send(JSON.stringify({ type: "audio_chunk", data: base64data }));
//           log("📤 Sent mic audio chunk to server");
//           }
//       };
//       const commitTurn = () => {
//      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//       wsRef.current.send(JSON.stringify({ type: "commit" }));
//           log("📤 Commit sent to server");
//         }
//       };



//       micSource.connect(micWorklet);
//       workletNodeRef.current = micWorklet;
//       log("✅ Mic + worklet initialized");
//     } catch (err) {
//       log("❌ Error initializing microphone:", err);
//     }
//   };

//   // ---------------------------
//   // 🛑 Stop Session
//   // ---------------------------
//   const stop = async () => {
//     log("🛑 Stopping session...");
//     setIsConnected(false);
//     try {
//       if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//         wsRef.current.send(JSON.stringify({ type: "close" }));
//         wsRef.current.close();
//         log("✅ WebSocket closed by client");
//       }
//       wsRef.current = null;

//       if (workletNodeRef.current) {
//         workletNodeRef.current.port.onmessage = null;
//         workletNodeRef.current.disconnect();
//         workletNodeRef.current = null;
//         log("🗑️ Mic worklet disconnected");
//       }
//       if (playbackWorkletRef.current) {
//         playbackWorkletRef.current.disconnect();
//         playbackWorkletRef.current = null;
//         log("🗑️ Playback worklet disconnected");
//       }
//       if (micSourceRef.current) {
//         micSourceRef.current.disconnect();
//         micSourceRef.current = null;
//         log("🗑️ Mic source disconnected");
//       }
//       if (micStreamRef.current) {
//         micStreamRef.current.getTracks().forEach((t) => t.stop());
//         micStreamRef.current = null;
//         log("🛑 Mic stream stopped");
//       }
//       if (audioCtxRef.current) {
//         await audioCtxRef.current.close();
//         audioCtxRef.current = null;
//         log("🛑 AudioContext closed");
//       }
//     } catch (e) {
//       log("❌ Stop error:", e);
//     }
//     log("🛑 Session fully stopped.");
//   };

//   // ---------------------------
//   // 📤 Commit Turn (optional)
//   // ---------------------------
//   const commitTurn = () => {
//     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//       wsRef.current.send(JSON.stringify({ type: "commit" }));
//       log("📤 Commit sent to server");
//     }
//   };

//   useEffect(() => {
//     return () => {
//       if (wsRef.current) stop();
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   return (
//     <div className="App">
//       <h1>🎙️ Realtime Gemini Voice Chat</h1>
//       <button onClick={start} disabled={isConnected}>Start</button>
//       <button onClick={stop} disabled={!isConnected}>Stop</button>
//       <button onClick={commitTurn} disabled={!isConnected}>Commit Turn</button>
//       <h2>💬 Text Response:</h2>
//       <div>{response}</div>
//       <h2>📜 Debug Logs:</h2>
//       <pre>{logMessages.join("\n")}</pre>
//     </div>
//   );
// }

// export default App;













// import React, { useState, useEffect, useRef } from "react";

// function App() {
//   const [response, setResponse] = useState("");
//   const [logMessages, setLogMessages] = useState([]);
//   const [isConnected, setIsConnected] = useState(false);
//   const [isListening, setIsListening] = useState(false);

//   const wsRef = useRef(null);
//   const audioCtxRef = useRef(null);
//   const micStreamRef = useRef(null);
//   const micSourceRef = useRef(null);
//   const workletNodeRef = useRef(null);
//   const playbackWorkletRef = useRef(null);

//   function log(...args) {
//     const message = args.join(" ");
//     setLogMessages((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
//     console.log(...args);
//   }

//   // 🔹 ArrayBuffer → Base64
//   function arrayBufferToBase64(buffer) {
//     let binary = "";
//     const bytes = new Uint8Array(buffer);
//     const chunkSize = 0x8000;
//     for (let i = 0; i < bytes.length; i += chunkSize) {
//       const chunk = bytes.subarray(i, i + chunkSize);
//       binary += String.fromCharCode.apply(null, chunk);
//     }
//     return btoa(binary);
//   }

//   // 🔹 Base64 (Int16 PCM) → Float32 for playback
//   function base64ToFloat32(base64) {
//     try {
//       const binary = atob(base64);
//       const bytes = new Uint8Array(binary.length);
//       for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
//       const int16 = new Int16Array(bytes.buffer);
//       const out = new Float32Array(int16.length);
//       for (let i = 0; i < int16.length; i++) out[i] = int16[i] / 0x8000;
//       return out;
//     } catch (error) {
//       log("Error decoding audio:", error);
//       return new Float32Array(0);
//     }
//   }

//   // ---------------------------
//   // 🚀 Start Session
//   // ---------------------------
//   const start = async () => {
//     if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
//       log("⚠️ Connection already in progress...");
//       return;
//     }
//     if (audioCtxRef.current && audioCtxRef.current.state === "running") {
//       await stop();
//     }

//     log("🚀 Starting session...");
//     setResponse("");
    
//     try {
//       // Create WebSocket connection
//       const scheme = window.location.protocol === "https:" ? "wss" : "ws";
//       const port = process.env.NODE_ENV === 'development' ? ':5000' : '';
//       const ws = new WebSocket(`${scheme}://${window.location.hostname}${port}/realtime`);
//       wsRef.current = ws;

//       ws.onopen = () => {
//         log("✅ WebSocket connected to backend");
//         setIsConnected(true);
//       };
      
//       ws.onerror = (e) => {
//         log("❌ WebSocket error:", e?.message || "Connection failed");
//         setIsConnected(false);
//       };
      
//       ws.onclose = (event) => {
//         log("⚠️ WebSocket closed:", event.code, event.reason);
//         setIsConnected(false);
//         setIsListening(false);
//       };

//       // 🔹 Create AudioContext for playback (24kHz matches Gemini output)
//       const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
//         sampleRate: 24000,
//       });
//       audioCtxRef.current = audioCtx;
//       log("🎧 AudioContext created (24kHz for playback)");

//       // 🔹 Load Playback Worklet
//       log("⏳ Loading playback worklet...");
//       await audioCtx.audioWorklet.addModule("playback-processor.js");
//       const playbackWorklet = new AudioWorkletNode(audioCtx, "playback-processor");
//       playbackWorklet.connect(audioCtx.destination);
//       playbackWorkletRef.current = playbackWorklet;
//       log("✅ Playback worklet ready");

//       // 🔹 Handle Messages from server
//       ws.onmessage = (event) => {
//         try {
//           const data = JSON.parse(event.data);

//           if (data.type === "audio") {
//             log("🎵 Received audio chunk from server");
//             const float32 = base64ToFloat32(data.data);
//             if (playbackWorkletRef.current && float32.length > 0) {
//               playbackWorkletRef.current.port.postMessage(float32);
//             }
//           } else if (data.type === "text") {
//             log("💬 Received text response:", data.data);
//             setResponse(prev => prev + " " + data.data);
//           } else {
//             log("⚠️ Unknown server message type:", data.type);
//           }
//         } catch (error) {
//           log("❌ Error parsing server message:", error, event.data);
//         }
//       };

//       // 🔹 Setup Microphone
//       log("🎤 Requesting microphone access...");
//       const micStream = await navigator.mediaDevices.getUserMedia({ 
//         audio: {
//           channelCount: 1,
//           sampleRate: 16000, // Request 16kHz if possible
//           echoCancellation: true,
//           noiseSuppression: true,
//           autoGainControl: true
//         } 
//       });
//       micStreamRef.current = micStream;
//       log("✅ Microphone access granted");

//       const micSource = audioCtx.createMediaStreamSource(micStream);
//       micSourceRef.current = micSource;

//       log("⏳ Loading mic worklet...");
//       await audioCtx.audioWorklet.addModule("mic-processor.js");
//       const micWorklet = new AudioWorkletNode(audioCtx, "mic-processor");

//       // Configure worklet with current sample rate and target
//       micWorklet.port.postMessage({ 
//         sampleRate: audioCtx.sampleRate,
//         targetSampleRate: 16000 
//       });

//       micWorklet.port.onmessage = (event) => {
//         if (ws.readyState === WebSocket.OPEN && event.data && event.data.byteLength > 0) {
//           const base64data = arrayBufferToBase64(event.data);
//           ws.send(JSON.stringify({ type: "audio_chunk", data: base64data }));
//           // log("📤 Sent mic audio chunk to server"); // Too verbose, comment out
//         }
//       };

//       micSource.connect(micWorklet);
//       workletNodeRef.current = micWorklet;
//       setIsListening(true);
//       log("✅ Mic + worklet initialized and streaming");

//     } catch (err) {
//       log("❌ Error during startup:", err);
//       setIsConnected(false);
//       setIsListening(false);
//     }
//   };

//   // ---------------------------
//   // 🛑 Stop Session
//   // ---------------------------
//   const stop = async () => {
//     log("🛑 Stopping session...");
//     setIsConnected(false);
//     setIsListening(false);
    
//     try {
//       if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//         wsRef.current.send(JSON.stringify({ type: "close" }));
//         wsRef.current.close();
//         log("✅ WebSocket closed by client");
//       }
//       wsRef.current = null;

//       if (workletNodeRef.current) {
//         workletNodeRef.current.port.onmessage = null;
//         workletNodeRef.current.disconnect();
//         workletNodeRef.current = null;
//         log("🗑️ Mic worklet disconnected");
//       }
      
//       if (playbackWorkletRef.current) {
//         playbackWorkletRef.current.disconnect();
//         playbackWorkletRef.current = null;
//         log("🗑️ Playback worklet disconnected");
//       }
      
//       if (micSourceRef.current) {
//         micSourceRef.current.disconnect();
//         micSourceRef.current = null;
//         log("🗑️ Mic source disconnected");
//       }
      
//       if (micStreamRef.current) {
//         micStreamRef.current.getTracks().forEach((t) => t.stop());
//         micStreamRef.current = null;
//         log("🛑 Mic stream stopped");
//       }
      
//       if (audioCtxRef.current) {
//         await audioCtxRef.current.close();
//         audioCtxRef.current = null;
//         log("🛑 AudioContext closed");
//       }
//     } catch (e) {
//       log("❌ Stop error:", e);
//     }
//     log("🛑 Session fully stopped.");
//   };

//   // ---------------------------
//   // 📤 Commit Turn (manual trigger for response)
//   // ---------------------------
//   const commitTurn = () => {
//     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//       wsRef.current.send(JSON.stringify({ type: "commit" }));
//       log("📤 Commit sent to server - requesting response");
//     } else {
//       log("⚠️ Cannot commit: WebSocket not connected");
//     }
//   };

//   // Clear logs
//   const clearLogs = () => {
//     setLogMessages([]);
//   };

//   useEffect(() => {
//     return () => {
//       if (wsRef.current) stop();
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   return (
//     <div style={{ fontFamily: "Arial, sans-serif", padding: "20px", maxWidth: "800px" }}>
//       <h1>🎙️ Realtime Gemini Voice Chat</h1>
      
//       <div style={{ marginBottom: "20px" }}>
//         <button 
//           onClick={start} 
//           disabled={isConnected}
//           style={{ 
//             marginRight: "10px", 
//             padding: "10px 20px",
//             backgroundColor: isConnected ? "#ccc" : "#4CAF50",
//             color: "white",
//             border: "none",
//             borderRadius: "5px",
//             cursor: isConnected ? "not-allowed" : "pointer"
//           }}
//         >
//           {isConnected ? "🟢 Connected" : "Start"}
//         </button>
        
//         <button 
//           onClick={stop} 
//           disabled={!isConnected}
//           style={{ 
//             marginRight: "10px", 
//             padding: "10px 20px",
//             backgroundColor: !isConnected ? "#ccc" : "#f44336",
//             color: "white",
//             border: "none",
//             borderRadius: "5px",
//             cursor: !isConnected ? "not-allowed" : "pointer"
//           }}
//         >
//           Stop
//         </button>
        
//         <button 
//           onClick={commitTurn} 
//           disabled={!isConnected}
//           style={{ 
//             marginRight: "10px",
//             padding: "10px 20px",
//             backgroundColor: !isConnected ? "#ccc" : "#2196F3",
//             color: "white",
//             border: "none",
//             borderRadius: "5px",
//             cursor: !isConnected ? "not-allowed" : "pointer"
//           }}
//         >
//           Commit Turn
//         </button>

//         {isListening && (
//           <span style={{ color: "green", marginLeft: "10px" }}>
//             🎤 Listening...
//           </span>
//         )}
//       </div>

//       <div style={{ marginBottom: "20px" }}>
//         <h2>💬 Gemini Response:</h2>
//         <div style={{ 
//           border: "1px solid #ddd", 
//           padding: "10px", 
//           minHeight: "60px",
//           backgroundColor: "#f9f9f9",
//           borderRadius: "5px"
//         }}>
//           {response || "No response yet..."}
//         </div>
//       </div>

//       <div>
//         <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
//           <h2 style={{ margin: 0, marginRight: "10px" }}>📜 Debug Logs:</h2>
//           <button 
//             onClick={clearLogs}
//             style={{ 
//               padding: "5px 10px",
//               backgroundColor: "#ff9800",
//               color: "white",
//               border: "none",
//               borderRadius: "3px",
//               cursor: "pointer"
//             }}
//           >
//             Clear Logs
//           </button>
//         </div>
//         <pre style={{ 
//           backgroundColor: "#f5f5f5", 
//           padding: "10px", 
//           borderRadius: "5px",
//           maxHeight: "300px", 
//           overflow: "auto",
//           fontSize: "12px",
//           whiteSpace: "pre-wrap"
//         }}>
//           {logMessages.length > 0 ? logMessages.join("\n") : "No logs yet..."}
//         </pre>
//       </div>
//     </div>
//   );
// }

// export default App;









// import React, { useState, useEffect, useRef } from "react";

// function App() {
//   const [response, setResponse] = useState("");
//   const [logMessages, setLogMessages] = useState([]);
//   const [isConnected, setIsConnected] = useState(false);
//   const [isListening, setIsListening] = useState(false);

//   const wsRef = useRef(null);
//   const audioCtxRef = useRef(null);
//   const micStreamRef = useRef(null);
//   const micSourceRef = useRef(null);
//   const workletNodeRef = useRef(null);
//   const playbackWorkletRef = useRef(null);

//   function log(...args) {
//     const message = args.join(" ");
//     setLogMessages((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
//     console.log(...args);
//   }

//   // 🔹 ArrayBuffer → Base64
//   function arrayBufferToBase64(buffer) {
//     let binary = "";
//     const bytes = new Uint8Array(buffer);
//     const chunkSize = 0x8000;
//     for (let i = 0; i < bytes.length; i += chunkSize) {
//       const chunk = bytes.subarray(i, i + chunkSize);
//       binary += String.fromCharCode.apply(null, chunk);
//     }
//     return btoa(binary);
//   }

//   // 🔹 Base64 (Int16 PCM) → Float32 for playback
//   function base64ToFloat32(base64) {
//     try {
//       const binary = atob(base64);
//       const bytes = new Uint8Array(binary.length);
//       for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
//       const int16 = new Int16Array(bytes.buffer);
//       const out = new Float32Array(int16.length);
//       for (let i = 0; i < int16.length; i++) out[i] = int16[i] / 0x8000;
//       return out;
//     } catch (error) {
//       log("Error decoding audio:", error);
//       return new Float32Array(0);
//     }
//   }

//   // ---------------------------
//   // 🚀 Start Session
//   // ---------------------------
//   const start = async () => {
//     if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
//       log("⚠️ Connection already in progress...");
//       return;
//     }
//     if (audioCtxRef.current && audioCtxRef.current.state === "running") {
//       await stop();
//     }

//     log("🚀 Starting session...");
//     setResponse("");
    
//     try {
//       // Create WebSocket connection
//       const scheme = window.location.protocol === "https:" ? "wss" : "ws";
//       const port = process.env.NODE_ENV === 'development' ? ':5000' : '';
//       // const ws = new WebSocket(`${scheme}://${window.location.hostname}${port}/realtime`);
//       const ws = new WebSocket("wss://ai-assistant-a8md.onrender.com/realtime");
//       wsRef.current = ws;

//       ws.onopen = () => {
//         log("✅ WebSocket connected to backend");
//         setIsConnected(true);
//       };
      
//       ws.onerror = (e) => {
//         log("❌ WebSocket error:", e?.message || "Connection failed");
//         setIsConnected(false);
//       };
      
//       ws.onclose = (event) => {
//         log("⚠️ WebSocket closed:", event.code, event.reason);
//         setIsConnected(false);
//         setIsListening(false);
//       };

//       // 🔹 Create AudioContext for playback (24kHz matches Gemini output)
//       const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
//         sampleRate: 24000,
//       });
//       audioCtxRef.current = audioCtx;
//       log("🎧 AudioContext created (24kHz for playback)");

//       // 🔹 Load Playback Worklet
//       log("⏳ Loading playback worklet...");
//       await audioCtx.audioWorklet.addModule("playback-processor.js");
//       const playbackWorklet = new AudioWorkletNode(audioCtx, "playback-processor");
//       playbackWorklet.connect(audioCtx.destination);
//       playbackWorkletRef.current = playbackWorklet;
//       log("✅ Playback worklet ready");

//       // 🔹 Handle Messages from server
//       ws.onmessage = (event) => {
//         try {
//           const data = JSON.parse(event.data);

//           if (data.type === "audio") {
//             log("🎵 Received audio chunk from server");
//             const float32 = base64ToFloat32(data.data);
//             if (playbackWorkletRef.current && float32.length > 0) {
//               playbackWorkletRef.current.port.postMessage(float32);
//             }
//           } else if (data.type === "text") {
//             log("💬 Received text response:", data.data);
//             setResponse(prev => prev + " " + data.data);
//           } else {
//             log("⚠️ Unknown server message type:", data.type);
//           }
//         } catch (error) {
//           log("❌ Error parsing server message:", error, event.data);
//         }
//       };

//       // 🔹 Setup Microphone
//       log("🎤 Requesting microphone access...");
//       const micStream = await navigator.mediaDevices.getUserMedia({ 
//         audio: {
//           channelCount: 1,
//           sampleRate: 16000, // Request 16kHz if possible
//           echoCancellation: true,
//           noiseSuppression: true,
//           autoGainControl: true
//         } 
//       });
//       micStreamRef.current = micStream;
//       log("✅ Microphone access granted");

//       const micSource = audioCtx.createMediaStreamSource(micStream);
//       micSourceRef.current = micSource;

//       log("⏳ Loading mic worklet...");
//       await audioCtx.audioWorklet.addModule("mic-processor.js");
//       const micWorklet = new AudioWorkletNode(audioCtx, "mic-processor");

//       // Configure worklet with current sample rate and target
//       micWorklet.port.postMessage({ 
//         sampleRate: audioCtx.sampleRate,
//         targetSampleRate: 16000 
//       });

//       micWorklet.port.onmessage = (event) => {
//         if (ws.readyState === WebSocket.OPEN && event.data && event.data.byteLength > 0) {
//           const base64data = arrayBufferToBase64(event.data);
//           ws.send(JSON.stringify({ type: "audio_chunk", data: base64data }));
//         }
//       };

//       micSource.connect(micWorklet);
//       workletNodeRef.current = micWorklet;
//       setIsListening(true);
//       log("✅ Mic + worklet initialized and streaming");

//     } catch (err) {
//       log("❌ Error during startup:", err);
//       setIsConnected(false);
//       setIsListening(false);
//     }
//   };

//   // ---------------------------
//   // 🛑 Stop Session
//   // ---------------------------
//   const stop = async () => {
//     log("🛑 Stopping session...");
//     setIsConnected(false);
//     setIsListening(false);
    
//     try {
//       if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//         wsRef.current.send(JSON.stringify({ type: "close" }));
//         wsRef.current.close();
//         log("✅ WebSocket closed by client");
//       }
//       wsRef.current = null;

//       if (workletNodeRef.current) {
//         workletNodeRef.current.port.onmessage = null;
//         workletNodeRef.current.disconnect();
//         workletNodeRef.current = null;
//         log("🗑️ Mic worklet disconnected");
//       }
      
//       if (playbackWorkletRef.current) {
//         playbackWorkletRef.current.disconnect();
//         playbackWorkletRef.current = null;
//         log("🗑️ Playback worklet disconnected");
//       }
      
//       if (micSourceRef.current) {
//         micSourceRef.current.disconnect();
//         micSourceRef.current = null;
//         log("🗑️ Mic source disconnected");
//       }
      
//       if (micStreamRef.current) {
//         micStreamRef.current.getTracks().forEach((t) => t.stop());
//         micStreamRef.current = null;
//         log("🛑 Mic stream stopped");
//       }
      
//       if (audioCtxRef.current) {
//         await audioCtxRef.current.close();
//         audioCtxRef.current = null;
//         log("🛑 AudioContext closed");
//       }
//     } catch (e) {
//       log("❌ Stop error:", e);
//     }
//     log("🛑 Session fully stopped.");
//   };

//   // ---------------------------
//   // 📤 Commit Turn (manual trigger for response)
//   // ---------------------------
//   const commitTurn = () => {
//     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//       wsRef.current.send(JSON.stringify({ type: "commit" }));
//       log("📤 Commit sent to server - requesting response");
//     } else {
//       log("⚠️ Cannot commit: WebSocket not connected");
//     }
//   };

//   // Clear logs
//   const clearLogs = () => {
//     setLogMessages([]);
//   };

//   useEffect(() => {
//     return () => {
//       if (wsRef.current) stop();
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   return (
//     <div style={{ fontFamily: "Arial, sans-serif", padding: "20px", maxWidth: "800px" }}>
//       <h1>🎙️ Realtime Gemini Voice Chat</h1>
      
//       <div style={{ marginBottom: "20px" }}>
//         <button 
//           onClick={start} 
//           disabled={isConnected}
//           style={{ 
//             marginRight: "10px", 
//             padding: "10px 20px",
//             backgroundColor: isConnected ? "#ccc" : "#4CAF50",
//             color: "white",
//             border: "none",
//             borderRadius: "5px",
//             cursor: isConnected ? "not-allowed" : "pointer"
//           }}
//         >
//           {isConnected ? "🟢 Connected" : "Start"}
//         </button>
        
//         <button 
//           onClick={stop} 
//           disabled={!isConnected}
//           style={{ 
//             marginRight: "10px", 
//             padding: "10px 20px",
//             backgroundColor: !isConnected ? "#ccc" : "#f44336",
//             color: "white",
//             border: "none",
//             borderRadius: "5px",
//             cursor: !isConnected ? "not-allowed" : "pointer"
//           }}
//         >
//           Stop
//         </button>
        
//         <button 
//           onClick={commitTurn} 
//           disabled={!isConnected}
//           style={{ 
//             marginRight: "10px",
//             padding: "10px 20px",
//             backgroundColor: !isConnected ? "#ccc" : "#2196F3",
//             color: "white",
//             border: "none",
//             borderRadius: "5px",
//             cursor: !isConnected ? "not-allowed" : "pointer"
//           }}
//         >
//           Commit Turn
//         </button>

//         {isListening && (
//           <span style={{ color: "green", marginLeft: "10px" }}>
//             🎤 Listening...
//           </span>
//         )}
//       </div>

//       <div style={{ marginBottom: "20px" }}>
//         <h2>💬 Gemini Response:</h2>
//         <div style={{ 
//           border: "1px solid #ddd", 
//           padding: "10px", 
//           minHeight: "60px",
//           backgroundColor: "#f9f9f9",
//           borderRadius: "5px"
//         }}>
//           {response || "No response yet..."}
//         </div>
//       </div>

//       <div>
//         <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
//           <h2 style={{ margin: 0, marginRight: "10px" }}>📜 Debug Logs:</h2>
//           <button 
//             onClick={clearLogs}
//             style={{ 
//               padding: "5px 10px",
//               backgroundColor: "#ff9800",
//               color: "white",
//               border: "none",
//               borderRadius: "3px",
//               cursor: "pointer"
//             }}
//           >
//             Clear Logs
//           </button>
//         </div>
//         <pre style={{ 
//           backgroundColor: "#f5f5f5", 
//           padding: "10px", 
//           borderRadius: "5px",
//           maxHeight: "300px", 
//           overflow: "auto",
//           fontSize: "12px",
//           whiteSpace: "pre-wrap"
//         }}>
//           {logMessages.length > 0 ? logMessages.join("\n") : "No logs yet..."}
//         </pre>
//       </div>
//     </div>
//   );
// }

// export default App;








import React, { useState, useEffect, useRef } from "react";

function App() {
  const [response, setResponse] = useState("");
  const [logMessages, setLogMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const micSourceRef = useRef(null);
  const workletNodeRef = useRef(null);
  const playbackWorkletRef = useRef(null);

  function log(...args) {
    const message = args.map(a => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ");
    setLogMessages((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    console.log(...args);
  }

  // Base64 -> ArrayBuffer
  function base64ToArrayBuffer(base64) {
    try {
      const binary = atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    } catch (err) {
      log("❌ base64ToArrayBuffer error", err);
      return null;
    }
  }

  // ---------------------------
  // 🚀 Start Session
  // ---------------------------
  const start = async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      log("⚠️ Connection already in progress...");
      return;
    }
    if (audioCtxRef.current && audioCtxRef.current.state === "running") {
      await stop();
    }

    log("🚀 Starting session...");
    setResponse("");

    try {
      // WebSocket: prefer same origin (works in prod & dev when configured)
      const scheme = window.location.protocol === "https:" ? "wss" : "ws";
      const host = window.location.host;
      // If you really want to force a host, replace the next line.
      // const wsUrl = `${scheme}://${host}/realtime`;
      // fallback: if you previously hardcoded and want remote:
      const wsUrl = "wss://ai-assistant-a8md.onrender.com/realtime";

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        log("✅ WebSocket connected to backend", wsUrl);
        setIsConnected(true);
      };

      ws.onerror = (event) => {
        // event is usually a simple Event object; log whole thing
        log("❌ WebSocket error", event);
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        log("⚠️ WebSocket closed:", event.code, event.reason || "(no reason)");
        setIsConnected(false);
        setIsListening(false);
      };

      // AudioContext for playback
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000,
      });
      audioCtxRef.current = audioCtx;
      log("🎧 AudioContext created (24kHz for playback)");

      // Load playback worklet (ensure playback-processor.js is accessible in public/)
      try {
        log("⏳ Loading playback worklet...");
        await audioCtx.audioWorklet.addModule("/playback-processor.js");
        const playbackWorklet = new AudioWorkletNode(audioCtx, "playback-processor");
        playbackWorklet.connect(audioCtx.destination);
        playbackWorkletRef.current = playbackWorklet;
        log("✅ Playback worklet ready");
      } catch (err) {
        log("❌ playback worklet load error", err);
        // we proceed without worklet (we'll fallback to decode & play via buffer source)
      }

      // Handle messages from server
      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "audio") {
            log("🎵 Received audio chunk from server (base64 length):", data.data?.length ?? 0);

            const ab = base64ToArrayBuffer(data.data);
            if (!ab) return;

            // Try decode compressed audio to AudioBuffer
            try {
              const decoded = await audioCtx.decodeAudioData(ab);
              log("🔊 Decoded audio buffer:", decoded.duration.toFixed(3) + "s", "channels:", decoded.numberOfChannels);

              // If playback worklet exists, send Float32 channel data
              if (playbackWorkletRef.current) {
                // send first channel (mono). For stereo, you can interleave or send both.
                const chData = decoded.getChannelData(0);
                playbackWorkletRef.current.port.postMessage(chData);
                log(`🔊 Sent ${chData.length} float samples to playback worklet`);
              } else {
                // Fallback: play via AudioBufferSourceNode
                const src = audioCtx.createBufferSource();
                src.buffer = decoded;
                src.connect(audioCtx.destination);
                src.start();
                log("▶️ Played audio via AudioBufferSourceNode");
              }
            } catch (err) {
              // decodeAudioData failed (maybe bytes not a decodable compressed chunk)
              log("❌ decodeAudioData failed for incoming chunk", err);
              // optionally accumulate chunks for later decode
            }
          } else if (data.type === "text") {
            log("💬 Received text response:", data.data);
            setResponse(prev => prev + " " + data.data);
          } else {
            log("⚠️ Unknown server message type:", data.type);
          }
        } catch (error) {
          log("❌ Error parsing server message:", error, event.data);
        }
      };

      // Setup microphone
      log("🎤 Requesting microphone access...");
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000, // request 16k
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      micStreamRef.current = micStream;
      log("✅ Microphone access granted");

      const micSource = audioCtx.createMediaStreamSource(micStream);
      micSourceRef.current = micSource;

      log("⏳ Loading mic worklet...");
      await audioCtx.audioWorklet.addModule("/mic-processor.js");
      const micWorklet = new AudioWorkletNode(audioCtx, "mic-processor");

      micWorklet.port.postMessage({
        sampleRate: audioCtx.sampleRate,
        targetSampleRate: 16000
      });

      micWorklet.port.onmessage = (ev) => {
        if (ws.readyState === WebSocket.OPEN && ev.data && ev.data.byteLength > 0) {
          const base64data = (() => {
            // if the worklet sends ArrayBuffer
            let ab = ev.data;
            if (ab instanceof ArrayBuffer) {
              let binary = "";
              const bytes = new Uint8Array(ab);
              const chunkSize = 0x8000;
              for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.subarray(i, i + chunkSize);
                binary += String.fromCharCode.apply(null, chunk);
              }
              return btoa(binary);
            }
            // otherwise if it sends already a base64 string
            return ev.data;
          })();
          ws.send(JSON.stringify({ type: "audio_chunk", data: base64data }));
        }
      };

      micSource.connect(micWorklet);
      workletNodeRef.current = micWorklet;
      setIsListening(true);
      log("✅ Mic + worklet initialized and streaming");

    } catch (err) {
      log("❌ Error during startup:", err);
      setIsConnected(false);
      setIsListening(false);
    }
  };

  // ---------------------------
  // 🛑 Stop Session
  // ---------------------------
  const stop = async () => {
    log("🛑 Stopping session...");
    setIsConnected(false);
    setIsListening(false);

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "close" }));
        wsRef.current.close();
        log("✅ WebSocket closed by client");
      }
      wsRef.current = null;

      if (workletNodeRef.current) {
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current.disconnect();
        workletNodeRef.current = null;
        log("🗑️ Mic worklet disconnected");
      }

      if (playbackWorkletRef.current) {
        playbackWorkletRef.current.disconnect();
        playbackWorkletRef.current = null;
        log("🗑️ Playback worklet disconnected");
      }

      if (micSourceRef.current) {
        micSourceRef.current.disconnect();
        micSourceRef.current = null;
        log("🗑️ Mic source disconnected");
      }

      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
        log("🛑 Mic stream stopped");
      }

      if (audioCtxRef.current) {
        await audioCtxRef.current.close();
        audioCtxRef.current = null;
        log("🛑 AudioContext closed");
      }
    } catch (e) {
      log("❌ Stop error:", e);
    }
    log("🛑 Session fully stopped.");
  };

  // Commit Turn
  const commitTurn = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "commit" }));
      log("📤 Commit sent to server - requesting response");
    } else {
      log("⚠️ Cannot commit: WebSocket not connected");
    }
  };

  // Clear logs
  const clearLogs = () => setLogMessages([]);

  useEffect(() => {
    log("🔔 App component mounted");
    return () => {
      if (wsRef.current) stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "20px", maxWidth: "900px" }}>
      <h1>🎙️ Realtime Gemini Voice Chat</h1>
      <div style={{ marginBottom: "20px" }}>
        <button onClick={start} disabled={isConnected} style={{ marginRight: 10 }}>
          {isConnected ? "🟢 Connected" : "Start"}
        </button>
        <button onClick={stop} disabled={!isConnected} style={{ marginRight: 10 }}>
          Stop
        </button>
        <button onClick={commitTurn} disabled={!isConnected} style={{ marginRight: 10 }}>
          Commit Turn
        </button>
        {isListening && <span style={{ color: "green", marginLeft: 10 }}>🎤 Listening...</span>}
      </div>

      <div style={{ marginBottom: 20 }}>
        <h2>💬 Gemini Response:</h2>
        <div style={{ border: "1px solid #ddd", padding: 10, minHeight: 60, background: "#fafafa" }}>
          {response || "No response yet..."}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <h2 style={{ margin: 0, marginRight: 10 }}>📜 Debug Logs:</h2>
          <button onClick={clearLogs} style={{ padding: "5px 10px", marginLeft: 10 }}>Clear Logs</button>
        </div>
        <pre style={{ background: "#f5f5f5", padding: 10, borderRadius: 6, maxHeight: 300, overflow: "auto" }}>
          {logMessages.length > 0 ? logMessages.join("\n") : "No logs yet... (open browser console too)"}
        </pre>
      </div>
    </div>
  );
}

export default App;
