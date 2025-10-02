// components/audio/DAW/Multitrack/ImprovedNoteScheduler.js
'use client';

import audioContextManager from './AudioContextManager';
import { beatsToSeconds, beatToAudioTime } from '../../../../lib/midiTimeUtils';

/**
 * Improved Note Scheduler using Web Audio API timing
 * Provides sample-accurate scheduling for MIDI playback
 */
export default class ImprovedNoteScheduler {
  constructor(instrument, options = {}) {
    this.instrument = instrument;
    this.tempo = options.tempo || 120;
    this.lookaheadTime = options.lookaheadTime || 0.1; // 100ms
    this.scheduleInterval = options.scheduleInterval || 25; // 25ms
    this.isPlaying = false;
    this.startTime = 0;
    this.pauseTime = 0;
    this.currentBeat = 0;
    this.notes = [];
    this.scheduledNotes = new Map(); // Track scheduled notes
    this.schedulerTimer = null;

    // Get audio context for timing
    this.audioContext = audioContextManager.getContext();
  }

  // Set the notes to play
  setNotes(notes) {
    this.notes = notes || [];
    // Clear any previously scheduled notes when notes change
    this.clearScheduledNotes();
  }

  // Set tempo
  setTempo(tempo) {
    this.tempo = tempo;
  }

  // Start playback
  // startBeat: the current beat position in the timeline (absolute, not relative)
  // globalTimelineStartTime: optional audio context time when timeline started (for sync)
  start(startBeat = 0, globalTimelineStartTime = null) {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.currentBeat = startBeat;

    // Calculate reference time for timeline-absolute positioning
    // If provided, use the global timeline's start reference
    // Otherwise, calculate assuming timeline started at audio context time 0
    if (globalTimelineStartTime !== null) {
      this.startTime = globalTimelineStartTime;
    } else {
      // Fallback: assume we're starting playback now at the given beat position
      this.startTime = this.audioContext.currentTime - (startBeat * 60) / this.tempo;
    }

    // Start the scheduler
    this.scheduleNotes();
    this.schedulerTimer = setInterval(() => {
      this.scheduleNotes();
    }, this.scheduleInterval);
  }

  // Stop playback
  stop() {
    this.isPlaying = false;

    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    // Stop all currently playing notes
    this.clearScheduledNotes();

    // Reset position
    this.currentBeat = 0;
    this.startTime = 0;
  }

  // Pause playback
  pause() {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    this.pauseTime = this.getCurrentBeat();

    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    // Stop all currently playing notes
    this.clearScheduledNotes();
  }

  // Resume from pause
  resume() {
    if (this.isPlaying) return;

    this.start(this.pauseTime);
  }

  // Seek to a specific beat
  seek(beat) {
    const wasPlaying = this.isPlaying;

    if (wasPlaying) {
      this.stop();
    }

    this.currentBeat = beat;

    if (wasPlaying) {
      this.start(beat);
    }
  }

  // Get current playback position in beats
  getCurrentBeat() {
    if (!this.isPlaying) return this.pauseTime;

    const elapsed = this.audioContext.currentTime - this.startTime;
    // Use unified time conversion
    return elapsed * (this.tempo / 60); // seconds to beats
  }

  // Schedule notes that fall within the lookahead window
  scheduleNotes() {
    if (!this.isPlaying || !this.instrument) return;

    const currentBeat = this.getCurrentBeat();
    const lookaheadBeats = (this.lookaheadTime * this.tempo) / 60;
    const scheduleEndBeat = currentBeat + lookaheadBeats;

    // Find notes that need to be scheduled
    for (const note of this.notes) {
      const noteKey = `${note.note}-${note.startTime}`;

      // Check if note should be scheduled and hasn't been already
      if (
        note.startTime >= currentBeat &&
        note.startTime < scheduleEndBeat &&
        !this.scheduledNotes.has(noteKey)
      ) {
        // Calculate when to play the note in audio context time
        // Use unified time conversion utilities for consistency
        const noteOnTime = beatToAudioTime(note.startTime, this.tempo, this.startTime);
        const noteOffTime = beatToAudioTime(note.startTime + note.duration, this.tempo, this.startTime);

        // Schedule note on
        audioContextManager.scheduleAtTime(() => {
          if (this.isPlaying) {
            this.instrument.playNote(
              note.note,
              note.velocity || 0.8,
              noteOnTime,
            );
          }
        }, noteOnTime);

        // Schedule note off
        audioContextManager.scheduleAtTime(() => {
          if (this.isPlaying) {
            this.instrument.stopNote(note.note, noteOffTime);
          }
          // Remove from scheduled notes
          this.scheduledNotes.delete(noteKey);
        }, noteOffTime);

        // Mark as scheduled
        this.scheduledNotes.set(noteKey, {
          noteOnTime,
          noteOffTime,
          note: note.note,
        });
      }
    }

    // Clean up old scheduled notes that have finished
    const now = this.audioContext.currentTime;
    for (const [key, scheduled] of this.scheduledNotes.entries()) {
      if (scheduled.noteOffTime < now) {
        this.scheduledNotes.delete(key);
      }
    }
  }

  // Clear all scheduled notes
  clearScheduledNotes() {
    // Stop all notes immediately
    if (this.instrument && this.instrument.stopAllNotes) {
      this.instrument.stopAllNotes();
    }

    this.scheduledNotes.clear();
  }

  // Get scheduler state
  getState() {
    return {
      isPlaying: this.isPlaying,
      currentBeat: this.getCurrentBeat(),
      tempo: this.tempo,
      scheduledNotes: this.scheduledNotes.size,
    };
  }
}
