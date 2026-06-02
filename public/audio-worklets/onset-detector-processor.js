/**
 * AudioWorklet processor for onset detection (energy envelope + optional spectral flux boost).
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

    // Circular buffer of raw (unfiltered) samples for pitch detection at onset time
    this.pitchBufferSize = 4096
    this.pitchBuffer = new Float32Array(this.pitchBufferSize)
    this.pitchBufferWritePos = 0
    this.envelope = 0
    this.energyHistory = []
    this.fluxHistory = []
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
        this.fluxHistory = []
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
   * Radix-2 FFT for spectral flux (O(N log N)).
   * Operates in-place on real/imag arrays.
   */
  fft(real, imag) {
    const N = real.length
    // Bit-reversal permutation
    for (let i = 1, j = 0; i < N; i++) {
      let bit = N >> 1
      for (; j & bit; bit >>= 1) {
        j ^= bit
      }
      j ^= bit
      if (i < j) {
        let tmp = real[i]; real[i] = real[j]; real[j] = tmp
        tmp = imag[i]; imag[i] = imag[j]; imag[j] = tmp
      }
    }
    // Cooley-Tukey
    for (let len = 2; len <= N; len <<= 1) {
      const halfLen = len >> 1
      const angle = -2 * Math.PI / len
      const wR = Math.cos(angle)
      const wI = Math.sin(angle)
      for (let i = 0; i < N; i += len) {
        let curR = 1, curI = 0
        for (let j = 0; j < halfLen; j++) {
          const uR = real[i + j]
          const uI = imag[i + j]
          const vR = real[i + j + halfLen] * curR - imag[i + j + halfLen] * curI
          const vI = real[i + j + halfLen] * curI + imag[i + j + halfLen] * curR
          real[i + j] = uR + vR
          imag[i + j] = uI + vI
          real[i + j + halfLen] = uR - vR
          imag[i + j + halfLen] = uI - vI
          const newCurR = curR * wR - curI * wI
          curI = curR * wI + curI * wR
          curR = newCurR
        }
      }
    }
  }

  /**
   * Compute half-wave rectified spectral flux using radix-2 FFT.
   */
  computeSpectralFlux(frame) {
    const N = this.config.fftSize
    const real = new Float32Array(N)
    const imag = new Float32Array(N)

    // Copy frame into real array (zero-pad if needed)
    const copyLen = Math.min(frame.length, N)
    for (let i = 0; i < copyLen; i++) {
      real[i] = frame[i]
    }

    this.fft(real, imag)

    // Compute magnitudes for first half
    const magnitudes = new Float32Array(N / 2)
    for (let k = 0; k < N / 2; k++) {
      magnitudes[k] = Math.sqrt(real[k] * real[k] + imag[k] * imag[k])
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

  /**
   * Compute adaptive flux threshold from recent flux history.
   */
  getAdaptiveFluxThreshold() {
    if (this.fluxHistory.length === 0) return Infinity
    let sum = 0
    for (let i = 0; i < this.fluxHistory.length; i++) {
      sum += this.fluxHistory[i]
    }
    const mean = sum / this.fluxHistory.length
    return mean * 2.0 + 0.1
  }

  /**
   * Autocorrelation-based pitch detection (same algorithm as use-pitch-detection.ts).
   * Returns detected frequency in Hz, or -1 if no confident pitch found.
   */
  detectPitch(buffer, sampleRate) {
    // RMS silence gate
    let rms = 0
    for (let i = 0; i < buffer.length; i++) {
      rms += buffer[i] * buffer[i]
    }
    rms = Math.sqrt(rms / buffer.length)
    if (rms < 0.01) return -1

    // Autocorrelation
    const minLag = Math.floor(sampleRate / 1500) // ~1500 Hz
    const maxLag = Math.floor(sampleRate / 27)   // ~27 Hz
    const correlations = new Float32Array(maxLag + 1)

    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0
      let sumSq1 = 0
      let sumSq2 = 0
      for (let i = 0; i < buffer.length - lag; i++) {
        sum += buffer[i] * buffer[i + lag]
        sumSq1 += buffer[i] * buffer[i]
        sumSq2 += buffer[i + lag] * buffer[i + lag]
      }
      const denom = Math.sqrt(sumSq1 * sumSq2)
      correlations[lag] = denom > 0 ? sum / denom : 0
    }

    // Find the strongest local peak above a confidence threshold.
    // (Kept in sync with autoCorrelate() in hooks/use-pitch-detection.ts.)
    const CONFIDENCE_THRESHOLD = 0.8
    let bestLag = -1
    let bestCorr = CONFIDENCE_THRESHOLD

    for (let lag = minLag; lag <= maxLag; lag++) {
      const c = correlations[lag]
      if (c > bestCorr) {
        const isPeak =
          (lag === minLag || c > correlations[lag - 1]) &&
          (lag === maxLag || c >= correlations[lag + 1])
        if (isPeak) {
          bestCorr = c
          bestLag = lag
        }
      }
    }

    if (bestLag === -1) return -1

    // Octave-down sanity check: prefer the true fundamental when a comparably
    // strong peak exists near twice the lag (one octave lower).
    const OCTAVE_RATIO = 0.85
    const octaveLag = bestLag * 2
    if (octaveLag <= maxLag) {
      let subLag = -1
      let subCorr = 0
      const lo = Math.max(minLag, octaveLag - 2)
      const hi = Math.min(maxLag, octaveLag + 2)
      for (let lag = lo; lag <= hi; lag++) {
        if (correlations[lag] > subCorr) {
          subCorr = correlations[lag]
          subLag = lag
        }
      }
      if (subLag !== -1 && subCorr >= bestCorr * OCTAVE_RATIO) {
        bestLag = subLag
      }
    }

    // Parabolic interpolation for sub-sample accuracy
    const prev = bestLag > 0 ? correlations[bestLag - 1] : correlations[bestLag]
    const curr = correlations[bestLag]
    const next = bestLag < maxLag ? correlations[bestLag + 1] : correlations[bestLag]
    const shift = (prev - next) / (2 * (prev - 2 * curr + next))
    const truePeak = bestLag + (isFinite(shift) ? shift : 0)

    return sampleRate / truePeak
  }

  /**
   * Get the contents of the pitch circular buffer as a contiguous array.
   */
  getPitchBufferSnapshot() {
    const buf = new Float32Array(this.pitchBufferSize)
    const wp = this.pitchBufferWritePos
    // Copy from write position to end, then from start to write position
    buf.set(this.pitchBuffer.subarray(wp), 0)
    buf.set(this.pitchBuffer.subarray(0, wp), this.pitchBufferSize - wp)
    return buf
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    if (!input || !input[0]) return true

    const channelData = input[0]
    this.sampleRate = sampleRate // Global in AudioWorklet scope

    // Accumulate raw (unfiltered) samples into pitch circular buffer
    for (let i = 0; i < channelData.length; i++) {
      this.pitchBuffer[this.pitchBufferWritePos] = channelData[i]
      this.pitchBufferWritePos = (this.pitchBufferWritePos + 1) % this.pitchBufferSize
    }

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

    // Fix: compute envelope coefficients per-frame (not per-sample)
    const frameSize = this.config.frameSize
    const attackCoeff = 1 - Math.exp(-frameSize / ((this.config.envelopeAttackMs / 1000) * this.sampleRate))
    const releaseCoeff = 1 - Math.exp(-frameSize / ((this.config.envelopeReleaseMs / 1000) * this.sampleRate))

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

    // Criterion 2: Spectral flux (used as confidence boost, not gate)
    const flux = this.computeSpectralFlux(frame)
    this.fluxHistory.push(flux)
    if (this.fluxHistory.length > this.config.adaptiveMedianFrames) {
      this.fluxHistory.shift()
    }
    const fluxThreshold = this.getAdaptiveFluxThreshold()
    const fluxExceeds = flux > fluxThreshold

    // Energy is primary criterion; flux only boosts confidence
    if (energyExceeds) {
      const now = currentTime // Global in AudioWorklet scope
      const refractorySec = this.config.refractoryPeriodMs / 1000

      if (now - this.lastOnsetTime > refractorySec) {
        this.lastOnsetTime = now

        // Run pitch detection on the raw sample buffer
        const pitchSnapshot = this.getPitchBufferSnapshot()
        const detectedFreq = this.detectPitch(pitchSnapshot, this.sampleRate)

        this.port.postMessage({
          type: 'onset',
          timestamp: now,
          energy: this.envelope,
          fluxConfirmed: fluxExceeds,
          frequency: detectedFreq > 0 ? detectedFreq : null,
        })
      }
    }
  }
}

registerProcessor('onset-detector-processor', OnsetDetectorProcessor)
