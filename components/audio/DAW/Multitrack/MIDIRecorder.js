// components/audio/DAW/Multitrack/MIDIRecorder.js
'use client';

/**
 * MIDIRecorder - Records MIDI input with precise timing
 */
export default class MIDIRecorder {
  constructor() {
    this.isRecording = false;
    this.isCountingIn = false;
    this.recordedNotes = [];
    this.activeNotes = new Map(); // Track currently pressed notes
    this.startTime = 0;
    this.countInBeats = 4;
    this.tempo = 120;
    this.quantize = null; // null = no quantization, or grid size (1/16, 1/8, etc)
    this.overdub = false;
    this.listeners = new Map();
  }

  // Start recording
  startRecording(options = {}) {
    const {
      countIn = true,
      countInBeats = 4,
      tempo = 120,
      quantize = null,
      overdub = false,
      existingNotes = []
    } = options;

    this.tempo = tempo;
    this.quantize = quantize;
    this.overdub = overdub;
    this.countInBeats = countInBeats;

    if (overdub && existingNotes) {
      this.recordedNotes = [...existingNotes];
    } else {
      this.recordedNotes = [];
    }

    if (countIn) {
      this.startCountIn();
    } else {
      this.startActualRecording();
    }
  }

  // Count-in before recording
  startCountIn() {
    this.isCountingIn = true;
    const beatDuration = 60000 / this.tempo; // ms per beat
    let currentBeat = 0;

    this.notify('countIn', { beat: currentBeat + 1, total: this.countInBeats });

    const countInInterval = setInterval(() => {
      currentBeat++;
      
      if (currentBeat >= this.countInBeats) {
        clearInterval(countInInterval);
        this.isCountingIn = false;
        this.startActualRecording();
      } else {
        this.notify('countIn', { beat: currentBeat + 1, total: this.countInBeats });
      }
    }, beatDuration);
  }

  // Start actual recording
  startActualRecording() {
    this.isRecording = true;
    this.startTime = performance.now();
    this.activeNotes.clear();
    this.notify('recordingStarted', { time: this.startTime });
  }

  // Stop recording
  stopRecording() {
    if (!this.isRecording) return [];

    this.isRecording = false;
    
    // Stop any notes that are still held
    const endTime = this.getCurrentTime();
    this.activeNotes.forEach((note, noteNumber) => {
      note.duration = endTime - note.startTime;
      note.wasHeldAtStop = true;
    });

    this.notify('recordingStopped', { 
      notes: this.recordedNotes,
      duration: endTime 
    });

    return this.recordedNotes;
  }

  // Handle incoming MIDI messages
  handleMIDIMessage(message) {
    if (!this.isRecording || this.isCountingIn) return;

    const currentTime = this.getCurrentTime();

    switch (message.type) {
      case 'noteon':
        if (message.velocity > 0) {
          this.handleNoteOn(message.note, message.velocity, currentTime);
        } else {
          // Some devices send note-on with velocity 0 as note-off
          this.handleNoteOff(message.note, currentTime);
        }
        break;
        
      case 'noteoff':
        this.handleNoteOff(message.note, currentTime);
        break;
        
      case 'cc':
        this.handleControlChange(message.controller, message.value, currentTime);
        break;
        
      case 'pitchbend':
        this.handlePitchBend(message.value, currentTime);
        break;
    }
  }

  // Handle note on
  handleNoteOn(noteNumber, velocity, time) {
    // Check if this note is already playing (shouldn't happen but just in case)
    if (this.activeNotes.has(noteNumber)) {
      this.handleNoteOff(noteNumber, time);
    }

    // Apply quantization to start time if enabled
    const quantizedTime = this.quantize ? 
      this.quantizeTime(time) : time;

    const note = {
      id: `recorded-${Date.now()}-${noteNumber}`,
      note: noteNumber,
      velocity,
      startTime: quantizedTime,
      duration: null, // Will be set on note off
      recorded: true
    };

    this.recordedNotes.push(note);
    this.activeNotes.set(noteNumber, note);

    this.notify('noteRecorded', { note, action: 'start' });
  }

  // Handle note off
  handleNoteOff(noteNumber, time) {
    const activeNote = this.activeNotes.get(noteNumber);
    if (!activeNote) return; // Note wasn't being tracked

    // Calculate duration
    const duration = time - activeNote.startTime;
    
    // Apply minimum note length
    activeNote.duration = Math.max(duration, 0.05); // Minimum 50ms

    // Apply quantization to duration if enabled
    if (this.quantize) {
      activeNote.duration = this.quantizeDuration(activeNote.duration);
    }

    this.activeNotes.delete(noteNumber);
    this.notify('noteRecorded', { note: activeNote, action: 'complete' });
  }

  // Handle control changes (for future use)
  handleControlChange(controller, value, time) {
    // Could record automation data here
    this.notify('ccRecorded', { controller, value, time });
  }

  // Handle pitch bend (for future use)
  handlePitchBend(value, time) {
    // Could record pitch bend automation
    this.notify('pitchBendRecorded', { value, time });
  }

  // Get current recording time in seconds
  getCurrentTime() {
    return (performance.now() - this.startTime) / 1000;
  }

  // Quantize time to grid
  quantizeTime(time) {
    if (!this.quantize) return time;
    
    const gridSize = this.quantize; // e.g., 1/16 = 0.0625
    return Math.round(time / gridSize) * gridSize;
  }

  // Quantize duration
  quantizeDuration(duration) {
    if (!this.quantize) return duration;
    
    const gridSize = this.quantize;
    const quantized = Math.round(duration / gridSize) * gridSize;
    return Math.max(quantized, gridSize); // At least one grid unit
  }

  // Event notification system
  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  removeListener(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  notify(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        callback(data);
      });
    }
  }

  // Utility methods
  isActive() {
    return this.isRecording || this.isCountingIn;
  }

  getRecordedNotes() {
    return [...this.recordedNotes];
  }

  clearRecording() {
    this.recordedNotes = [];
    this.activeNotes.clear();
  }
}