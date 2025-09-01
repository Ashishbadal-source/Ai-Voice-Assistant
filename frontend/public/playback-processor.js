// public/playback-processor.js

class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.audioQueue = [];
    this.port.onmessage = (event) => {
      // Add incoming audio chunks to the queue
      this.audioQueue.push(event.data);
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const outputChannel = output[0];

    // If there's audio in the queue, play it
    if (this.audioQueue.length > 0) {
      const audioChunk = this.audioQueue.shift();
      // Ensure the chunk fits into the output buffer
      outputChannel.set(audioChunk.subarray(0, outputChannel.length));
    } else {
      // Otherwise, fill with silence
      outputChannel.fill(0);
    }
    
    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor("playback-processor", PlaybackProcessor);