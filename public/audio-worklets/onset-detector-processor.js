/**
 * AudioWorklet processor for dual-criterion onset detection (energy envelope + spectral flux).
 * Must be plain JS for addModule().
 */
class OnsetDetectorProcessor extends AudioWorkletProcessor {
  constructor() {
    super()

    // Default config (can be updated via message)
    this.config = {
      bandPassLow: 120,
      bandPassHigh: 2000,
      envelopeAttackMs: 3,
      envelopeReleaseMs: 50,
      adaptiveMedianFrames: 15,
      adaptiveThresholdMultiplier: 1.8,
      adaptiveThresholdOffset: 0.005,
      refractoryPeriodMs: 60,
      minOnsetEnergy: 0.01,
      fftSize: 512,
      frameSize: 1024,
      hopSize: 512,
    }

    // State
    this.inputBuffer = new Float32Array(this.config.frameSize)
    this.bufferIndex = 0
    this.envelope = 0
    this.energyHistory = []
    this.prevMagnitudes = null
    this.lastOnsetTime = -Infinity
    this.sampleRate = 44100 // Updated on first process call

    // Simple IIR band-pass state
    this.bpState = { x1: 0, x2: 0, y1: 0, y2: 0 }

    this.port.onmessage = (e) => {
      if (e.data.type === 'config') {
        Object.assign(this.config, e.data.config)
        this.inputBuffer = new Float32Array(this.config.frameSize)
        this.bufferIndex = 0
        this.energyHistory = []
        this.prevMagnitudes = null
      }
    }
  }

  /**
   * Simple 2nd-order band-pass filter (Butterworth approximation).
   */
  bandPassSample(sample) {
    const sr = this.sampleRate
    const f0 = Math.sqrt(this.config.bandPassLow * this.config.bandPassHigh)
    const bw = this.config.bandPassHigh - this.config.bandPassLow
    const omega = (2 * Math.PI * f0) / sr
    const sinW = Math.sin(omega)
    const cosW = Math.cos(omega)
    const alpha = sinW * Math.sinh((Math.LN2 / 2) * (bw / f0) * (omega / sinW))

    const b0 = alpha
    const b1 = 0
    const b2 = -alpha
    const a0 = 1 + alpha
    const a1 = -2 * cosW
    const a2 = 1 - alpha

    const st = this.bpState
    const y =
      (b0 / a0) * sample +
      (b1 / a0) * st.x1 +
      (b2 / a0) * st.x2 -
      (a1 / a0) * st.y1 -
      (a2 / a0) * st.y2

    st.x2 = st.x1
    st.x1 = sample
    st.y2 = st.y1
    st.y1 = y

    return y
  }

  /**
   * Compute RMS energy of a frame.
   */
  computeRMS(frame) {
    let sum = 0
    for (let i = 0; i < frame.length; i++) {
      sum += frame[i] * frame[i]
    }
    return Math.sqrt(sum / frame.length)
  }

  /**
   * Compute half-wave rectified spectral flux.
   */
  computeSpectralFlux(frame) {
    // Simple DFT magnitudes (use frame as-is, no windowing for speed in worklet)
    const N = this.config.fftSize
    const magnitudes = new Float32Array(N / 2)

    for (let k = 0; k < N / 2; k++) {
      let real = 0
      let imag = 0
      for (let n = 0; n < N && n < frame.length; n++) {
        const angle = (2 * Math.PI * k * n) / N
        real += frame[n] * Math.cos(angle)
        imag -= frame[n] * Math.sin(angle)
      }
      magnitudes[k] = Math.sqrt(real * real + imag * imag)
    }

    if (!this.prevMagnitudes) {
      this.prevMagnitudes = magnitudes
      return 0
    }

    // Half-wave rectified spectral flux
    let flux = 0
    for (let k = 0; k < magnitudes.length; k++) {
      const diff = magnitudes[k] - this.prevMagnitudes[k]
      if (diff > 0) flux += diff
    }

    this.prevMagnitudes = magnitudes
    return flux
  }

  /**
   * Compute adaptive threshold using median of recent energy values.
   */
  getAdaptiveThreshold() {
    if (this.energyHistory.length === 0) return this.config.minOnsetEnergy

    const sorted = [...this.energyHistory].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid]

    return median * this.config.adaptiveThresholdMultiplier + this.config.adaptiveThresholdOffset
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    if (!input || !input[0]) return true

    const channelData = input[0]
    this.sampleRate = sampleRate // Global in AudioWorklet scope

    // Feed samples through band-pass and into buffer
    for (let i = 0; i < channelData.length; i++) {
      const filtered = this.bandPassSample(channelData[i])
      this.inputBuffer[this.bufferIndex] = filtered
      this.bufferIndex++

      // When we have a full frame, analyze
      if (this.bufferIndex >= this.config.frameSize) {
        this.analyzeFrame()
        // Hop: shift buffer by hopSize
        const remaining = this.config.frameSize - this.config.hopSize
        this.inputBuffer.copyWithin(0, this.config.hopSize)
        this.bufferIndex = remaining
      }
    }

    // Also compute input level for the UI meter (unfiltered)
    let rms = 0
    for (let i = 0; i < channelData.length; i++) {
      rms += channelData[i] * channelData[i]
    }
    rms = Math.sqrt(rms / channelData.length)
    this.port.postMessage({ type: 'level', level: rms })

    return true
  }

  analyzeFrame() {
    const frame = this.inputBuffer.slice(0, this.config.frameSize)

    // Criterion 1: Energy envelope
    const rms = this.computeRMS(frame)

    // Update envelope follower
    const attackCoeff = 1 - Math.exp(-1 / ((this.config.envelopeAttackMs / 1000) * this.sampleRate))
    const releaseCoeff = 1 - Math.exp(-1 / ((this.config.envelopeReleaseMs / 1000) * this.sampleRate))

    if (rms > this.envelope) {
      this.envelope += attackCoeff * (rms - this.envelope)
    } else {
      this.envelope += releaseCoeff * (rms - this.envelope)
    }

    // Track energy history for adaptive threshold
    this.energyHistory.push(this.envelope)
    if (this.energyHistory.length > this.config.adaptiveMedianFrames) {
      this.energyHistory.shift()
    }

    const energyThreshold = this.getAdaptiveThreshold()
    const energyExceeds = this.envelope > energyThreshold && this.envelope > this.config.minOnsetEnergy

    // Criterion 2: Spectral flux
    const flux = this.computeSpectralFlux(frame)
    // Use a simple fixed threshold for spectral flux confirmation
    const fluxThreshold = 0.5
    const fluxExceeds = flux > fluxThreshold

    // Dual-criterion onset: BOTH must exceed thresholds
    if (energyExceeds && fluxExceeds) {
      const now = currentTime // Global in AudioWorklet scope
      const refractorySec = this.config.refractoryPeriodMs / 1000

      if (now - this.lastOnsetTime > refractorySec) {
        this.lastOnsetTime = now
        this.port.postMessage({
          type: 'onset',
          timestamp: now,
          energy: this.envelope,
        })
      }
    }
  }
}

registerProcessor('onset-detector-processor', OnsetDetectorProcessor)
