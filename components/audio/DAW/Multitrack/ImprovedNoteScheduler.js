// components/audio/DAW/Multitrack/ImprovedNoteScheduler.js
'use client';

import audioContextManager from './AudioContextManager';
import { beatsToSeconds, secondsToBeats, beatToAudioTime } from '../../../../lib/midiTimeUtils';

/**
 * Improved Note Scheduler using Web Audio API timing
 * Provides sample-accurate scheduling for MIDI playback
 */
export default class ImprovedNoteScheduler {
  constructor(instrument, options = {}) {
    this.instrument = instrument;
    this.tempo = options.tempo || 120;
    this.lookaheadTime = options.lookaheadTime || 0.2; // 200ms for better timing accuracy
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
  start(startBeat = 0) {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.currentBeat = startBeat;

    // Calculate when beat 0 occurred in audio context time
    // If we're at beat X now, beat 0 was X beats ago
    const secondsElapsed = beatsToSeconds(startBeat, this.tempo);
    this.startTime = this.audioContext.currentTime - secondsElapsed;

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

    // Calculate elapsed time using audio context
    const elapsed = this.audioContext.currentTime - this.startTime;
    // Convert elapsed seconds to beats
    return secondsToBeats(elapsed, this.tempo);
  }

  // Schedule notes that fall within the lookahead window
  scheduleNotes() {
    if (!this.isPlaying || !this.instrument) return;

    const currentBeat = this.getCurrentBeat();
    const currentSeconds = beatsToSeconds(currentBeat, this.tempo);
    const scheduleEndSeconds = currentSeconds + this.lookaheadTime;

    // Find notes that need to be scheduled
    for (const note of this.notes) {
      const noteKey = `${note.note}-${note.startTime}`;

      // NOTE: note.startTime and note.duration are in SECONDS
      // Check if note should be scheduled and hasn't been already
      if (
        note.startTime >= currentSeconds &&
        note.startTime < scheduleEndSeconds &&
        !this.scheduledNotes.has(noteKey)
      ) {
        // Calculate when to play the note in audio context time
        // Notes are already in seconds, just add to startTime reference
        const noteOnTime = this.startTime + note.startTime;
        const noteOffTime = this.startTime + note.startTime + note.duration;

        console.log(`🎵 Scheduling note: pitch=${note.note}, startTime=${note.startTime.toFixed(3)}s, duration=${note.duration.toFixed(3)}s, noteOnTime=${noteOnTime.toFixed(3)}s, audioContextTime=${this.audioContext.currentTime.toFixed(3)}s`);

        // Schedule note on
        audioContextManager.scheduleAtTime(() => {
          if (this.isPlaying) {
            // Don't pass the scheduled time - let the instrument use current time
            // This prevents audio glitches from trying to schedule in the past
            this.instrument.playNote(
              note.note,
              note.velocity || 0.8
              // Removed noteOnTime parameter - instrument will use currentTime
            );
          }
        }, noteOnTime);

        // Schedule note off
        audioContextManager.scheduleAtTime(() => {
          if (this.isPlaying) {
            // Don't pass the scheduled time - let the instrument use current time
            this.instrument.stopNote(note.note);
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
