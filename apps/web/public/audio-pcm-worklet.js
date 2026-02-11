/**
 * AudioWorkletProcessor that extracts raw Float32 PCM samples
 * from the microphone and posts them to the main thread.
 *
 * Registered as "pcm-processor" for use with AudioWorkletNode.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._active = true;
    this.port.onmessage = (event) => {
      if (event.data.command === "stop") {
        this._active = false;
      }
    };
  }

  process(inputs) {
    if (!this._active) return false;

    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      // Copy the Float32 samples and send to main thread
      const samples = new Float32Array(input[0]);
      this.port.postMessage({ samples }, [samples.buffer]);
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
