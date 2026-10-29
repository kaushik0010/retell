/**
 * Client-Side Audio Capture, Web Audio Processing & Resampling
 *
 * Captures microphone audio, converts Float32 frames to 16-bit signed PCM (24kHz mono),
 * computes real-time RMS audio levels for waveforms, and detects pauses (> 4s).
 */

export interface AudioCaptureCallbacks {
  onAudioChunk?: (chunk: Uint8Array) => void;
  onVolumeChange?: (normalizedVolume: number) => void;
  onPauseStateChange?: (isPaused: boolean, pauseDurationSec: number) => void;
  onError?: (err: Error) => void;
}

export interface AudioCaptureConfig {
  sampleRate?: number; // 24000 for Meta Voice Transcribe
  silenceThresholdRms?: number; // Volume threshold below which audio is considered silent
  pauseTriggerMs?: number; // 4000ms pause threshold
}

/**
 * Converts Float32 audio samples [-1.0, 1.0] to signed 16-bit PCM.
 */
export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

/**
 * Computes root-mean-square (RMS) energy level from Float32 audio buffer.
 */
export function calculateRms(buffer: Float32Array): number {
  if (buffer.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const val = buffer[i] ?? 0;
    sum += val * val;
  }
  return Math.sqrt(sum / buffer.length);
}

export class AudioCaptureController {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private callbacks: AudioCaptureCallbacks;
  private config: Required<AudioCaptureConfig>;

  private isCapturing = false;
  private silenceStartMs: number | null = null;
  private isPausedReported = false;
  private pcmChunkBuffer: number[] = [];
  private readonly targetChunkSamples = 1920; // 80ms at 24kHz (1920 samples * 2 bytes = 3840 bytes)

  constructor(callbacks: AudioCaptureCallbacks, config?: AudioCaptureConfig) {
    this.callbacks = callbacks;
    this.config = {
      sampleRate: config?.sampleRate || 24000,
      silenceThresholdRms: config?.silenceThresholdRms || 0.008,
      pauseTriggerMs: config?.pauseTriggerMs || 4000,
    };
  }

  public async start(): Promise<void> {
    if (this.isCapturing) return;

    if (
      typeof window === "undefined" ||
      !navigator?.mediaDevices?.getUserMedia
    ) {
      throw new Error(
        "Microphone capture is not supported in this environment."
      );
    }

    try {
      // 1. Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 2. Initialize AudioContext at target sample rate (browser handles hardware resampling)
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      this.audioContext = new AudioCtx({
        sampleRate: this.config.sampleRate,
      });

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      // 3. Audio Nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.3;

      // ScriptProcessor with buffer size 2048 (approx 85ms at 24kHz)
      this.processorNode = this.audioContext.createScriptProcessor(2048, 1, 1);

      this.processorNode.onaudioprocess = (evt: AudioProcessingEvent) => {
        if (!this.isCapturing) return;

        const inputData = evt.inputBuffer.getChannelData(0);
        const rms = calculateRms(inputData);

        // Normalize volume roughly between 0 and 1 with enhanced sensitivity for quiet/gentle voices
        const normalizedVolume = Math.min(1, Math.max(0, rms * 14));
        this.callbacks.onVolumeChange?.(normalizedVolume);

        // Pause / Silence Monitoring
        const now = Date.now();
        if (rms < this.config.silenceThresholdRms) {
          if (this.silenceStartMs === null) {
            this.silenceStartMs = now;
          } else {
            const silentDuration = now - this.silenceStartMs;
            if (
              silentDuration >= this.config.pauseTriggerMs &&
              !this.isPausedReported
            ) {
              this.isPausedReported = true;
              this.callbacks.onPauseStateChange?.(
                true,
                Math.round(silentDuration / 1000)
              );
            }
          }
        } else {
          // Voice detected again
          if (this.isPausedReported) {
            this.isPausedReported = false;
            this.callbacks.onPauseStateChange?.(false, 0);
          }
          this.silenceStartMs = null;
        }

        // Convert Float32 to 16-bit signed PCM
        const pcm16 = floatTo16BitPCM(inputData);
        for (let i = 0; i < pcm16.length; i++) {
          this.pcmChunkBuffer.push(pcm16[i]!);
        }

        // Emit in chunk sizes expected by Meta ASR (1920 samples = 3840 bytes)
        while (this.pcmChunkBuffer.length >= this.targetChunkSamples) {
          const slice = this.pcmChunkBuffer.splice(0, this.targetChunkSamples);
          const chunkArray = new Int16Array(slice);
          const uint8Chunk = new Uint8Array(
            chunkArray.buffer,
            chunkArray.byteOffset,
            chunkArray.byteLength
          );
          this.callbacks.onAudioChunk?.(uint8Chunk);
        }
      };

      // Connect graph: source -> analyser -> processor -> destination
      this.sourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      this.isCapturing = true;
      this.silenceStartMs = null;
      this.isPausedReported = false;
    } catch (err) {
      this.stop();
      throw err;
    }
  }

  public stop(): void {
    this.isCapturing = false;

    // Flush remaining PCM buffer if any
    if (this.pcmChunkBuffer.length > 0) {
      const chunkArray = new Int16Array(this.pcmChunkBuffer);
      this.pcmChunkBuffer = [];
      const uint8Chunk = new Uint8Array(
        chunkArray.buffer,
        chunkArray.byteOffset,
        chunkArray.byteLength
      );
      this.callbacks.onAudioChunk?.(uint8Chunk);
    }

    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
        this.processorNode.onaudioprocess = null;
      } catch {}
      this.processorNode = null;
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch {}
      this.analyserNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => track.stop());
      } catch {}
      this.stream = null;
    }

    this.silenceStartMs = null;
    this.isPausedReported = false;
    this.callbacks.onVolumeChange?.(0);
  }

  public get active(): boolean {
    return this.isCapturing;
  }
}
