// components/audio/DAW/Multitrack/AudioProcessor.js
'use client';

import { decodeAudioFromURL } from './AudioEngine';

/**
 * Hybrid Audio Processor - Uses Web Workers when available, falls back to main thread
 * Provides consistent API regardless of implementation method
 */
class AudioProcessor {
  constructor() {
    this.worker = null;
    this.workerSupported = this.checkWorkerSupport();
    this.processingQueue = new Map(); // clipId -> { resolve, reject, onProgress }
    this.stats = { workerJobs: 0, mainThreadJobs: 0, errors: 0, fallbacks: 0 };
    
    console.log('🎛️ AudioProcessor: Initializing hybrid audio processing system');
    console.log(`🔍 Worker Support: ${this.workerSupported ? '✅ Available' : '❌ Not available'}`);
    
    if (this.workerSupported) {
      this.initializeWorker();
    } else {
      console.log('🔄 Will use main thread fallback for all audio processing');
    }
  }

  /**
   * Check if Web Workers are supported and available
   */
  checkWorkerSupport() {
    try {
      return typeof Worker !== 'undefined' && 
             typeof OfflineAudioContext !== 'undefined' &&
             typeof window !== 'undefined';
    } catch (e) {
      console.warn('🔄 Web Workers not supported, using fallback method');
      return false;
    }
  }

  /**
   * Initialize Web Worker if supported
   */
  initializeWorker() {
    try {
      // Create worker from inline script to avoid external file dependencies
      const workerCode = this.getWorkerCode();
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      this.worker = new Worker(workerUrl);
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);
      
      console.log('🚀 AudioProcessor: Web Worker initialized successfully');
      
      // Clean up blob URL
      setTimeout(() => URL.revokeObjectURL(workerUrl), 1000);
      
    } catch (e) {
      console.warn('🔄 Failed to initialize Web Worker, using fallback:', e);
      this.workerSupported = false;
      this.worker = null;
    }
  }

  /**
   * Handle messages from Web Worker
   */
  handleWorkerMessage(event) {
    const { type, clipId, ...data } = event.data;
    const processing = this.processingQueue.get(clipId);
    
    if (!processing) return;

    switch (type) {
      case 'progress':
        processing.onProgress?.(data.stage, data.progress);
        break;
        
      case 'success':
        processing.resolve({
          duration: data.duration,
          peaks: data.peaks,
          method: 'worker'
        });
        this.processingQueue.delete(clipId);
        break;
        
      case 'error':
        processing.reject(new Error(data.error));
        this.processingQueue.delete(clipId);
        break;
    }
  }

  /**
   * Handle Web Worker errors
   */
  handleWorkerError(error) {
    console.error('🔥 Web Worker error:', error);
    console.warn('🔄 Worker failed, falling back to main thread for all pending operations');
    
    // Fallback all pending operations to main thread
    const pendingOps = Array.from(this.processingQueue.entries());
    this.processingQueue.clear();
    this.stats.fallbacks += pendingOps.length;
    
    console.log(`🔄 Falling back ${pendingOps.length} pending operations to main thread`);
    
    for (const [clipId, { resolve, reject, onProgress, audioUrl }] of pendingOps) {
      console.log(`🔄 Fallback processing: ${clipId}`);
      this.processOnMainThread(audioUrl, clipId, onProgress)
        .then(resolve)
        .catch(reject);
    }
    
    // Disable worker for future operations
    this.workerSupported = false;
    this.worker = null;
    console.warn('⚠️ Web Worker disabled for remainder of session - using main thread only');
  }

  /**
   * Main API: Process audio file with automatic worker/fallback selection
   */
  async processAudioFile(audioUrl, clipId, onProgress = () => {}) {
    const startTime = performance.now();
    console.log(`🎵 AudioProcessor: Starting processing for ${clipId}`);
    console.log(`📁 File URL: ${audioUrl.substring(0, 50)}...`);
    
    try {
      let result;
      
      if (this.workerSupported && this.worker) {
        console.log(`🚀 Using Web Worker for ${clipId}`);
        this.stats.workerJobs++;
        result = await this.processWithWorker(audioUrl, clipId, onProgress);
      } else {
        console.log(`🔄 Using main thread fallback for ${clipId}`);
        this.stats.mainThreadJobs++;
        result = await this.processOnMainThread(audioUrl, clipId, onProgress);
      }
      
      const processingTime = Math.round(performance.now() - startTime);
      console.log(`✅ AudioProcessor: Completed ${clipId} in ${processingTime}ms using ${result.method}`);
      console.log(`📊 Duration: ${result.duration?.toFixed(2)}s, Peaks: ${result.peaks?.length || 0} samples`);
      console.log(`📈 Stats: Worker=${this.stats.workerJobs}, MainThread=${this.stats.mainThreadJobs}, Errors=${this.stats.errors}, Fallbacks=${this.stats.fallbacks}`);
      
      return result;
      
    } catch (error) {
      this.stats.errors++;
      const processingTime = Math.round(performance.now() - startTime);
      console.error(`❌ AudioProcessor: Failed ${clipId} after ${processingTime}ms:`, error);
      console.log(`📈 Stats: Worker=${this.stats.workerJobs}, MainThread=${this.stats.mainThreadJobs}, Errors=${this.stats.errors}, Fallbacks=${this.stats.fallbacks}`);
      throw error;
    }
  }

  /**
   * Process using Web Worker (true non-blocking)
   */
  processWithWorker(audioUrl, clipId, onProgress) {
    return new Promise((resolve, reject) => {
      // Store processing context
      this.processingQueue.set(clipId, { 
        resolve, 
        reject, 
        onProgress, 
        audioUrl,
        method: 'worker'
      });

      // Send work to worker
      this.worker.postMessage({
        type: 'process',
        clipId,
        audioUrl
      });

      // Timeout safety net (30 seconds)
      setTimeout(() => {
        if (this.processingQueue.has(clipId)) {
          this.processingQueue.delete(clipId);
          reject(new Error('Worker processing timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Fallback: Process on main thread (progressive loading approach)
   */
  async processOnMainThread(audioUrl, clipId, onProgress) {
    const stepStartTime = performance.now();
    console.log(`🔄 Main Thread: Starting ${clipId}`);
    
    try {
      onProgress('reading', 10);
      console.log(`📖 Main Thread: Reading file for ${clipId}`);
      
      // Still show progress updates even though it's blocking
      await this.delay(50); // Allow UI to update
      onProgress('reading', 30);
      
      await this.delay(50);
      onProgress('decoding', 50);
      
      const decodeStart = performance.now();
      console.log(`🔧 Main Thread: Starting audio decode for ${clipId} (THIS MAY BLOCK UI)`);
      
      // This is the blocking operation
      const audioBuffer = await decodeAudioFromURL(audioUrl);
      const duration = audioBuffer ? audioBuffer.duration : 0;
      const decodeTime = Math.round(performance.now() - decodeStart);
      console.log(`🔧 Main Thread: Decode completed for ${clipId} in ${decodeTime}ms (duration: ${duration?.toFixed(2)}s)`);
      
      onProgress('generating-peaks', 80);
      await this.delay(50);
      
      const peaksStart = performance.now();
      console.log(`🌊 Main Thread: Generating peaks for ${clipId}`);
      
      // Generate simple peaks (could be optimized further)
      const peaks = this.generateSimplePeaks(audioBuffer);
      const peaksTime = Math.round(performance.now() - peaksStart);
      console.log(`🌊 Main Thread: Peaks generated for ${clipId} in ${peaksTime}ms (${peaks.length} samples)`);
      
      onProgress('complete', 100);
      
      const totalTime = Math.round(performance.now() - stepStartTime);
      console.log(`✅ Main Thread: Completed ${clipId} in ${totalTime}ms total`);
      
      return {
        duration,
        peaks,
        method: 'main-thread'
      };
      
    } catch (error) {
      const totalTime = Math.round(performance.now() - stepStartTime);
      console.error(`❌ Main Thread: Failed ${clipId} after ${totalTime}ms:`, error);
      onProgress('error', 100);
      throw error;
    }
  }

  /**
   * Generate simple peaks on main thread
   */
  generateSimplePeaks(audioBuffer, samplesPerPixel = 256) {
    if (!audioBuffer) return [];
    
    const ch = 0; // use first channel
    const data = audioBuffer.getChannelData(ch);
    const total = data.length;
    const step = Math.max(1, Math.floor(total / Math.max(1, Math.floor(total / samplesPerPixel))));
    const peaks = [];

    for (let i = 0; i < total; i += step) {
      let min = 1.0;
      let max = -1.0;
      
      for (let j = 0; j < step && i + j < total; j++) {
        const v = data[i + j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      
      peaks.push([min, max]);
    }
    
    return peaks;
  }

  /**
   * Utility: Non-blocking delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Web Worker code as string (to avoid external file dependencies)
   */
  getWorkerCode() {
    return `
      // Audio processing worker
      console.log('🚀 Worker: Audio processing worker initialized');
      
      self.onmessage = async function(event) {
        const { type, clipId, audioUrl } = event.data;
        
        if (type === 'process') {
          const startTime = performance.now();
          console.log('🚀 Worker: Starting processing for', clipId);
          console.log('📁 Worker: File URL:', audioUrl.substring(0, 50) + '...');
          
          try {
            // Report progress
            self.postMessage({ type: 'progress', clipId, stage: 'reading', progress: 20 });
            console.log('📖 Worker: Reading file for', clipId);
            
            const fetchStart = performance.now();
            const response = await fetch(audioUrl);
            if (!response.ok) throw new Error('Failed to fetch audio');
            const fetchTime = Math.round(performance.now() - fetchStart);
            console.log('📖 Worker: File fetched in', fetchTime + 'ms for', clipId);
            
            self.postMessage({ type: 'progress', clipId, stage: 'reading', progress: 40 });
            
            const bufferStart = performance.now();
            const arrayBuffer = await response.arrayBuffer();
            const bufferTime = Math.round(performance.now() - bufferStart);
            console.log('📖 Worker: ArrayBuffer created in', bufferTime + 'ms for', clipId, '(' + Math.round(arrayBuffer.byteLength / 1024) + 'KB)');
            
            self.postMessage({ type: 'progress', clipId, stage: 'decoding', progress: 60 });
            console.log('🔧 Worker: Starting audio decode for', clipId);
            
            // Use OfflineAudioContext in worker
            const decodeStart = performance.now();
            const sampleRate = 44100;
            const offlineCtx = new OfflineAudioContext(2, sampleRate, sampleRate);
            const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
            const decodeTime = Math.round(performance.now() - decodeStart);
            console.log('🔧 Worker: Decode completed in', decodeTime + 'ms for', clipId, '(duration:', audioBuffer.duration.toFixed(2) + 's)');
            
            self.postMessage({ type: 'progress', clipId, stage: 'generating-peaks', progress: 85 });
            console.log('🌊 Worker: Generating peaks for', clipId);
            
            // Generate peaks
            const peaksStart = performance.now();
            const peaks = generatePeaks(audioBuffer, 256);
            const peaksTime = Math.round(performance.now() - peaksStart);
            console.log('🌊 Worker: Peaks generated in', peaksTime + 'ms for', clipId, '(' + peaks.length + ' samples)');
            
            const totalTime = Math.round(performance.now() - startTime);
            console.log('✅ Worker: Completed', clipId, 'in', totalTime + 'ms total');
            
            self.postMessage({ 
              type: 'success', 
              clipId, 
              duration: audioBuffer.duration,
              peaks 
            });
            
          } catch (error) {
            const totalTime = Math.round(performance.now() - startTime);
            console.error('❌ Worker: Failed', clipId, 'after', totalTime + 'ms:', error);
            self.postMessage({ 
              type: 'error', 
              clipId, 
              error: error.message 
            });
          }
        }
      };

      function generatePeaks(audioBuffer, samplesPerPixel = 256) {
        const ch = 0;
        const data = audioBuffer.getChannelData(ch);
        const total = data.length;
        const step = Math.max(1, Math.floor(total / Math.max(1, Math.floor(total / samplesPerPixel))));
        const peaks = [];

        for (let i = 0; i < total; i += step) {
          let min = 1.0;
          let max = -1.0;
          
          for (let j = 0; j < step && i + j < total; j++) {
            const v = data[i + j];
            if (v < min) min = v;
            if (v > max) max = v;
          }
          
          peaks.push([min, max]);
        }
        
        return peaks;
      }
    `;
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      ...this.stats,
      workerSupported: this.workerSupported,
      workerActive: !!(this.workerSupported && this.worker),
      pendingJobs: this.processingQueue.size
    };
  }

  /**
   * Print comprehensive stats to console
   */
  printStats() {
    const stats = this.getStats();
    console.group('📊 AudioProcessor Performance Stats');
    console.log(`🚀 Web Worker Jobs: ${stats.workerJobs}`);
    console.log(`🔄 Main Thread Jobs: ${stats.mainThreadJobs}`);
    console.log(`❌ Failed Jobs: ${stats.errors}`);
    console.log(`🔄 Fallback Operations: ${stats.fallbacks}`);
    console.log(`⚡ Worker Support: ${stats.workerSupported ? '✅' : '❌'}`);
    console.log(`🔧 Worker Active: ${stats.workerActive ? '✅' : '❌'}`);
    console.log(`⏳ Pending Jobs: ${stats.pendingJobs}`);
    console.log(`📈 Total Jobs: ${stats.workerJobs + stats.mainThreadJobs}`);
    console.log(`💪 Worker Usage: ${stats.workerJobs + stats.mainThreadJobs > 0 ? Math.round((stats.workerJobs / (stats.workerJobs + stats.mainThreadJobs)) * 100) : 0}%`);
    console.groupEnd();
  }

  /**
   * Cleanup resources
   */
  dispose() {
    console.log('🧹 AudioProcessor: Cleaning up resources...');
    this.printStats();
    
    if (this.worker) {
      console.log('🚀 Terminating Web Worker...');
      this.worker.terminate();
      this.worker = null;
    }
    
    if (this.processingQueue.size > 0) {
      console.warn(`⚠️ Disposing with ${this.processingQueue.size} pending operations`);
    }
    
    this.processingQueue.clear();
    console.log('✅ AudioProcessor cleanup complete');
  }
}

// Create singleton instance
let audioProcessor = null;

export function getAudioProcessor() {
  if (!audioProcessor) {
    audioProcessor = new AudioProcessor();
  }
  return audioProcessor;
}

export default AudioProcessor;