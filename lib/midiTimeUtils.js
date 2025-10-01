// lib/midiTimeUtils.js
/**
 * Unified MIDI time conversion utilities
 * Single source of truth for beat ↔ second ↔ pixel conversions
 * Ensures consistent timing across scheduler, renderer, and playhead
 */

/**
 * Convert beats to seconds
 * @param {number} beats - Time in beats
 * @param {number} tempo - Tempo in BPM
 * @returns {number} Time in seconds
 */
export function beatsToSeconds(beats, tempo = 120) {
  const secondsPerBeat = 60 / tempo;
  return beats * secondsPerBeat;
}

/**
 * Convert seconds to beats
 * @param {number} seconds - Time in seconds
 * @param {number} tempo - Tempo in BPM
 * @returns {number} Time in beats
 */
export function secondsToBeats(seconds, tempo = 120) {
  const beatsPerSecond = tempo / 60;
  return seconds * beatsPerSecond;
}

/**
 * Convert beats to pixels
 * @param {number} beats - Time in beats
 * @param {number} pixelsPerBeat - Zoom level (pixels per beat)
 * @returns {number} Position in pixels
 */
export function beatsToPixels(beats, pixelsPerBeat) {
  return beats * pixelsPerBeat;
}

/**
 * Convert pixels to beats
 * @param {number} pixels - Position in pixels
 * @param {number} pixelsPerBeat - Zoom level (pixels per beat)
 * @returns {number} Time in beats
 */
export function pixelsToBeats(pixels, pixelsPerBeat) {
  return pixels / pixelsPerBeat;
}

/**
 * Convert seconds to pixels (composite conversion)
 * @param {number} seconds - Time in seconds
 * @param {number} tempo - Tempo in BPM
 * @param {number} pixelsPerBeat - Zoom level (pixels per beat)
 * @returns {number} Position in pixels
 */
export function secondsToPixels(seconds, tempo, pixelsPerBeat) {
  const beats = secondsToBeats(seconds, tempo);
  return beatsToPixels(beats, pixelsPerBeat);
}

/**
 * Convert pixels to seconds (composite conversion)
 * @param {number} pixels - Position in pixels
 * @param {number} tempo - Tempo in BPM
 * @param {number} pixelsPerBeat - Zoom level (pixels per beat)
 * @returns {number} Time in seconds
 */
export function pixelsToSeconds(pixels, tempo, pixelsPerBeat) {
  const beats = pixelsToBeats(pixels, pixelsPerBeat);
  return beatsToSeconds(beats, tempo);
}

/**
 * Snap time to grid
 * @param {number} time - Time in beats
 * @param {number} snapValue - Grid value in beats (e.g., 0.25 for 1/16 note)
 * @returns {number} Snapped time in beats
 */
export function snapToGrid(time, snapValue) {
  if (snapValue === 0) return time;
  return Math.round(time / snapValue) * snapValue;
}

/**
 * Calculate playhead position in pixels
 * @param {number} currentTimeSeconds - Current time in seconds
 * @param {number} tempo - Tempo in BPM
 * @param {number} pixelsPerBeat - Zoom level (pixels per beat)
 * @returns {number} Playhead position in pixels
 */
export function calculatePlayheadPosition(currentTimeSeconds, tempo, pixelsPerBeat) {
  return secondsToPixels(currentTimeSeconds, tempo, pixelsPerBeat);
}

/**
 * Calculate note visual properties for rendering
 * @param {Object} note - Note object with startTime (beats) and duration (beats)
 * @param {number} tempo - Tempo in BPM
 * @param {number} pixelsPerBeat - Zoom level (pixels per beat)
 * @param {number} viewportFirstBeat - First visible beat in viewport
 * @returns {Object} Object with x, width in pixels
 */
export function calculateNoteVisuals(note, pixelsPerBeat, viewportFirstBeat = 0) {
  const x = beatsToPixels(note.startTime - viewportFirstBeat, pixelsPerBeat);
  const width = Math.max(1, beatsToPixels(note.duration, pixelsPerBeat));

  return { x, width };
}

/**
 * Get audio context time for a beat position
 * Used for sample-accurate scheduling
 * @param {number} beat - Beat position
 * @param {number} tempo - Tempo in BPM
 * @param {number} startTime - Audio context start time reference
 * @returns {number} Audio context time
 */
export function beatToAudioTime(beat, tempo, startTime) {
  return startTime + beatsToSeconds(beat, tempo);
}
