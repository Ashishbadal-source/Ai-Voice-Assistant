// // public/mic-processor.js

// class MicProcessor extends AudioWorkletProcessor {
//   constructor() {
//     super();
//     this.sampleRate = 48000; // Default sample rate
//     this.targetSampleRate = 16000;
//     this.samples = [];

//     // Listen for the sample rate from the main thread
//     this.port.onmessage = (event) => {
//       if (event.data.sampleRate) {
//         this.sampleRate = event.data.sampleRate;
//       }
//     };
//   }

//   // Downsamples Float32 audio to 16kHz PCM16
//   downsampleAndEncode(float32Audio) {
//     const ratio = this.sampleRate / this.targetSampleRate;
//     const outputLength = Math.floor(float32Audio.length / ratio);
//     const pcm16 = new Int16Array(outputLength);
//     let outIdx = 0;
//     for (let i = 0; i < float32Audio.length; i += ratio) {
//       const idx = Math.floor(i);
//       let s = float32Audio[idx];
//       s = Math.max(-1, Math.min(1, s)); // Clamp to -1 to 1
//       pcm16[outIdx] = s < 0 ? s * 0x8000 : s * 0x7fff;
//       outIdx++;
//     }
//     return pcm16;
//   }

//   process(inputs, outputs, parameters) {
//     // Get the audio data from the first input channel
//     const input = inputs[0];
//     const channelData = input[0];

//     if (channelData) {
//       // Downsample and encode the audio data
//       const pcm16Data = this.downsampleAndEncode(channelData);
      
//       // Post the processed data back to the main thread
//       this.port.postMessage(pcm16Data.buffer, [pcm16Data.buffer]);
//     }

//     // Return true to keep the processor alive
//     return true;
//   }
// }

// registerProcessor("mic-processor", MicProcessor);





// public/mic-processor.js




// // public/mic-processor.js

// class MicProcessor extends AudioWorkletProcessor {
//   constructor() {
//     super();
//     this.sampleRate = 48000; // Default browser sample rate
//     this.targetSampleRate = 16000; // Target for Gemini
//     this.samples = [];

//     // Listen for configuration from main thread
//     this.port.onmessage = (event) => {
//       if (event.data.sampleRate) {
//         this.sampleRate = event.data.sampleRate;
//         console.log("Mic worklet: received sampleRate", this.sampleRate);
//       }
//       if (event.data.targetSampleRate) {
//         this.targetSampleRate = event.data.targetSampleRate;
//         console.log("Mic worklet: received targetSampleRate", this.targetSampleRate);
//       }
//     };
//   }

//   // Downsample Float32 audio to target sample rate and convert to PCM16
//   downsampleAndEncode(float32Audio) {
//     const ratio = this.sampleRate / this.targetSampleRate;
//     const outputLength = Math.floor(float32Audio.length / ratio);
//     const pcm16 = new Int16Array(outputLength);
    
//     let outIdx = 0;
//     for (let i = 0; i < float32Audio.length && outIdx < outputLength; i += ratio) {
//       const idx = Math.floor(i);
//       let sample = float32Audio[idx] || 0;
      
//       // Clamp to valid range
//       sample = Math.max(-1, Math.min(1, sample));
      
//       // Convert to 16-bit PCM
//       pcm16[outIdx] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
//       outIdx++;
//     }
    
//     return pcm16;
//   }

//   process(inputs, outputs, parameters) {
//     const input = inputs[0];
//     const channelData = input[0];

//     if (channelData && channelData.length > 0) {
//       try {
//         // Process the audio data
//         const pcm16Data = this.downsampleAndEncode(channelData);
        
//         // Send processed data to main thread
//         if (pcm16Data.length > 0) {
//           this.port.postMessage(pcm16Data.buffer, [pcm16Data.buffer]);
//         }
//       } catch (error) {
//         console.error("Mic worklet processing error:", error);
//       }
//     }

//     // Keep processor alive
//     return true;
//   }
// }

// registerProcessor("mic-processor", MicProcessor);





class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRate = 48000;
    this.targetSampleRate = 16000;
    this.samples = [];
    this.bufferSize = 1024; // Buffer size for sending

    this.port.onmessage = (event) => {
      if (event.data.sampleRate) {
        this.sampleRate = event.data.sampleRate;
      }
      if (event.data.targetSampleRate) {
        this.targetSampleRate = event.data.targetSampleRate;
      }
    };
  }

  // Downsample Float32 audio to target sample rate and convert to PCM16
  downsampleAndEncode(float32Audio) {
    const ratio = this.sampleRate / this.targetSampleRate;
    const outputLength = Math.floor(float32Audio.length / ratio);
    const pcm16 = new Int16Array(outputLength);
    
    let outIdx = 0;
    for (let i = 0; i < float32Audio.length && outIdx < outputLength; i += ratio) {
      const idx = Math.floor(i);
      let sample = float32Audio[idx] || 0;
      
      // Clamp to valid range
      sample = Math.max(-1, Math.min(1, sample));
      
      // Convert to 16-bit PCM
      pcm16[outIdx] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      outIdx++;
    }
    
    return pcm16;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const channelData = input[0];

    if (channelData && channelData.length > 0) {
      try {
        // Process the audio data
        const pcm16Data = this.downsampleAndEncode(channelData);
        
        // Send processed data to main thread when buffer is full
        if (pcm16Data.length > 0) {
          this.port.postMessage(pcm16Data.buffer, [pcm16Data.buffer]);
        }
      } catch (error) {
        console.error("Mic worklet processing error:", error);
      }
    }

    // Keep processor alive
    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);