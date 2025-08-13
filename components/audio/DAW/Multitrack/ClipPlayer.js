'use client';

import { decodeAudioFromURL } from './AudioEngine';

/**
 * ClipPlayer - Handles playback of audio clips using Web Audio API
 * Supports offset, duration, volume, pan, and synchronized playback
 */
export default class ClipPlayer {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.clips = new Map(); // clipId -> { buffer, source, gainNode, panNode, startTime, offset, duration }
    this.isPlaying = false;
    this.playbackStartTime = 0; // When playback started (context time)
    this.playbackStartOffset = 0; // Where in the timeline we started (seconds)
  }

  /**
   * Load and prepare a clip for playback
   * @param {Object} clip - Clip object with id, src, offset, duration
   * @param {number} volume - Track volume (0-1)
   * @param {number} pan - Track pan (-1 to 1)
   */
  async prepareClip(clip, volume = 1, pan = 0) {
    if (!clip.src) {
      console.warn(`Clip ${clip.id} has no source URL`);
      return;
    }

    // Check if already loaded
    const existing = this.clips.get(clip.id);
    if (existing && existing.src === clip.src) {
      // Update volume and pan
      try {
        existing.gainNode.gain.value = volume;
      } catch {}
      try {
        existing.panNode.pan.value = pan;
      } catch {}
      // IMPORTANT: also update timing so canvas edits take effect
      existing.startTime = Math.max(0, Number(clip.start) || 0);
      existing.offset = Math.max(0, Number(clip.offset) || 0);

      const nextDur =
        clip.duration != null ? Number(clip.duration) : existing.duration;
      if (existing.buffer) {
        const maxDur = Math.max(0, existing.buffer.duration - existing.offset);
        existing.duration = Math.max(0, Math.min(Number(nextDur) || 0, maxDur));
      } else {
        existing.duration = Math.max(0, Number(nextDur) || 0);
      }
      return existing;
    }

    try {
      // Decode audio
      const audioBuffer = await decodeAudioFromURL(clip.src);
      if (!audioBuffer) {
        throw new Error('Failed to decode audio');
      }

      // Create nodes
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = volume;

      const panNode = this.audioContext.createStereoPanner();
      panNode.pan.value = pan;

      // Connect nodes: source -> gain -> pan -> destination
      gainNode.connect(panNode);
      panNode.connect(this.audioContext.destination);

      const clipData = {
        id: clip.id,
        src: clip.src,
        buffer: audioBuffer,
        source: null,
        gainNode,
        panNode,
        startTime: clip.start || 0,
        offset: clip.offset || 0,
        duration: clip.duration || audioBuffer.duration,
      };

      this.clips.set(clip.id, clipData);
      return clipData;
    } catch (error) {
      console.error(`Failed to prepare clip ${clip.id}:`, error);
      return null;
    }
  }

  /**
   * Update clips for a track
   * @param {Array} clips - Array of clip objects
   * @param {number} volume - Track volume
   * @param {number} pan - Track pan
   */
  async updateClips(clips, volume = 1, pan = 0) {
    clips = Array.isArray(clips)
      ? clips.map((c) => ({
          id: c.id,
          src: c.src,
          start: Math.max(0, Number(c.start) || 0),
          offset: Math.max(0, Number(c.offset) || 0),
          duration: Math.max(0, Number(c.duration) || 0),
        }))
      : [];

    // Remove clips that no longer exist
    const clipIds = new Set(clips.map((c) => c.id));
    for (const [id, clipData] of this.clips.entries()) {
      if (!clipIds.has(id)) {
        this.removeClip(id);
      }
    }

    // Prepare all clips
    const promises = clips.map((clip) => this.prepareClip(clip, volume, pan));
    await Promise.all(promises);
  }

  /**
   * Start playback from a specific position
   * @param {number} startTime - Start position in seconds
   */
  play(startTime = 0) {
    this.stop(); // Stop any existing playback

    this.isPlaying = true;
    this.playbackStartTime = this.audioContext.currentTime;
    this.playbackStartOffset = startTime;

    // Schedule all clips
    for (const [clipId, clipData] of this.clips.entries()) {
      this.scheduleClip(clipData, startTime);
    }
  }

  /**
   * Schedule a single clip for playback
   * @param {Object} clipData - Clip data from the clips map
   * @param {number} timelinePosition - Current position in the timeline
   */
  scheduleClip(clipData, timelinePosition) {
    const { buffer, gainNode, startTime, offset, duration } = clipData;

    // Calculate when this clip should start playing
    const clipEndTime = startTime + duration;

    // Skip if we're already past this clip
    if (timelinePosition >= clipEndTime) {
      return;
    }

    // Create a new buffer source
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);

    // Calculate timing
    let when = 0;
    let sourceOffset = Math.max(0, Number(offset) || 0);
    let sourceDuration = Math.max(0, Number(duration) || 0);

    if (timelinePosition < startTime) {
      // Clip hasn't started yet, schedule it for the future
      when = this.playbackStartTime + (startTime - timelinePosition);
    } else {
      // We're in the middle of this clip
      when = this.playbackStartTime;
      const clipProgress = timelinePosition - startTime;
      sourceOffset = offset + clipProgress;
      sourceDuration = duration - clipProgress;
    }

    // Ensure we don't exceed buffer duration
    const maxDuration = Math.max(0, buffer.duration - sourceOffset);
    sourceDuration = Math.max(0, Math.min(sourceDuration, maxDuration));

    if (sourceDuration > 1e-4) {
      source.start(when, sourceOffset, sourceDuration);
      clipData.source = source;

      // Clean up when finished
      source.onended = () => {
        if (clipData.source === source) {
          clipData.source = null;
        }
      };
    }
  }

  /**
   * Stop all playback
   */
  stop() {
    this.isPlaying = false;

    for (const [clipId, clipData] of this.clips.entries()) {
      if (clipData.source) {
        try {
          clipData.source.stop();
          clipData.source.disconnect();
        } catch (e) {
          // Ignore errors if already stopped
        }
        clipData.source = null;
      }
    }
  }

  /**
   * Pause playback (stop and remember position)
   * @returns {number} Current playback position
   */
  pause() {
    if (!this.isPlaying) {
      return this.playbackStartOffset;
    }

    const elapsed = this.audioContext.currentTime - this.playbackStartTime;
    const currentPosition = this.playbackStartOffset + elapsed;

    this.stop();

    return currentPosition;
  }

  /**
   * Seek to a specific position
   * @param {number} position - Position in seconds
   */
  seek(position) {
    const wasPlaying = this.isPlaying;
    this.stop();

    if (wasPlaying) {
      this.play(position);
    } else {
      this.playbackStartOffset = position;
    }
  }

  /**
   * Update volume for all clips
   * @param {number} volume - Volume (0-1)
   */
  setVolume(volume) {
    for (const [clipId, clipData] of this.clips.entries()) {
      clipData.gainNode.gain.value = volume;
    }
  }

  /**
   * Update pan for all clips
   * @param {number} pan - Pan (-1 to 1)
   */
  setPan(pan) {
    for (const [clipId, clipData] of this.clips.entries()) {
      clipData.panNode.pan.value = pan;
    }
  }

  /**
   * Remove a specific clip
   * @param {string} clipId - Clip ID to remove
   */
  removeClip(clipId) {
    const clipData = this.clips.get(clipId);
    if (!clipData) return;

    if (clipData.source) {
      try {
        clipData.source.stop();
        clipData.source.disconnect();
      } catch (e) {
        // Ignore
      }
    }

    clipData.gainNode.disconnect();
    clipData.panNode.disconnect();

    this.clips.delete(clipId);
  }

  /**
   * Clean up all resources
   */
  dispose() {
    this.stop();

    for (const [clipId, clipData] of this.clips.entries()) {
      clipData.gainNode.disconnect();
      clipData.panNode.disconnect();
    }

    this.clips.clear();
  }

  /**
   * Get current playback position
   * @returns {number} Current position in seconds
   */
  getCurrentTime() {
    if (!this.isPlaying) {
      return this.playbackStartOffset;
    }

    const elapsed = this.audioContext.currentTime - this.playbackStartTime;
    return this.playbackStartOffset + elapsed;
  }

  /**
   * Check if a specific clip is currently playing
   * @param {string} clipId - Clip ID
   * @returns {boolean}
   */
  isClipPlaying(clipId) {
    const clipData = this.clips.get(clipId);
    return clipData && clipData.source !== null;
  }
}
