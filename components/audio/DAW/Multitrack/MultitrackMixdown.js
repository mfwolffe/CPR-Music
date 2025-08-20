'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button, Modal, Form, ProgressBar, Alert } from 'react-bootstrap';
import { FaMixcloud } from 'react-icons/fa';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import { decodeAudioFromURL } from './AudioEngine';

/** Numeric helper: safe conversion with default */
function toNumber(val, def = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : def;
}

/**
 * Helpers — MIDI
 */
function midiToFreq(midi) {
  return 440 * Math.pow(2, (Number(midi) - 69) / 12);
}

function noteNameToMidi(name) {
  if (typeof name !== 'string') return null;
  const m = name.trim().match(/^([A-Ga-g])([#b♯♭]?)(-?\d{1,2})$/);
  if (!m) return null;
  const letters = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  const base = letters[m[1].toLowerCase()];
  const acc =
    m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  const octave = Number(m[3]);
  return 12 * (octave + 1) + base + acc;
}

// Soft-clip curve for master bus (prevents render-time clipping)
function makeSoftClipCurve(samples = 4096, drive = 0.85) {
  const curve = new Float32Array(samples);
  const k = Math.max(0.001, drive) * 12 + 1; // drive -> slope
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1; // -1..1
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}

// Compute any track-level MIDI time offsets expressed in seconds or beats
function getTrackMidiBaseOffsetSec(track, secPerBeat) {
  let sec = 0;
  const addSec = (v) => {
    const n = Number(v);
    if (Number.isFinite(n)) sec += n;
  };
  const addBeats = (v) => {
    const n = Number(v);
    if (Number.isFinite(n)) sec += n * secPerBeat;
  };

  // Common places folks store MIDI offsets
  addSec(track?.midiOffsetSec);
  addSec(track?.pianoRollOffsetSec);
  addSec(track?.midiData?.offsetSec);
  addSec(track?.piano?.offsetSec);
  if (track?.type === 'midi' || track?.kind === 'midi') {
    addSec(track?.start); // allow MIDI track-level start
    addBeats(track?.startBeat);
  }
  addBeats(track?.midiOffsetBeats);
  addBeats(track?.midiData?.offsetBeats);
  addBeats(track?.pianoRollOffsetBeats);

  return Math.max(0, sec);
}

// Helper to get PPQ (ticks per quarter note) from a track, with guard
function getPPQ(track) {
  const ppq = Number(track?.midiData?.ppq || track?.ppq || 480);
  return Number.isFinite(ppq) && ppq > 0 ? ppq : 480;
}

function collectTrackMidiNotes(track, tempo = { bpm: 120, stepsPerBeat: 4 }) {
  const out = [];

  // Tempo & conversion helpers
  const bpm =
    Number(tempo?.bpm) ||
    Number(track?.midiData?.tempo || track?.midiData?.bpm) ||
    120;
  const secPerBeat = 60 / bpm;
  const stepsPerBeat = Number(tempo?.stepsPerBeat) || 4; // for step sequencers

  const ppq = getPPQ(track);
  const secPerTick = secPerBeat / ppq;

  const baseOffsetSec = getTrackMidiBaseOffsetSec(track, secPerBeat);

  const timeFromNote = (n) => {
    // Check if we have startTime
    if (Number.isFinite(n.startTime)) {
      return Math.max(0, n.startTime * secPerBeat);
    }

    // Then check other beat-based fields
    const tb = toNumber(n.timeBeats ?? n.startBeat ?? n.beat, NaN);
    if (Number.isFinite(tb)) return Math.max(0, tb * secPerBeat);

    const tk = toNumber(n.ticks ?? n.tick ?? n.startTick, NaN);
    if (Number.isFinite(tk)) return Math.max(0, tk * secPerTick);

    // Only use these fields if they're actually in seconds
    const ts = toNumber(
      n.time ??
        n.start ??
        n.t ??
        n.timeSec ??
        n.startSec ??
        n.ts ??
        n.pos ??
        n.position ??
        n.absSec ??
        n.posSec ??
        n.positionSec ??
        n.startTimeSec,
      NaN,
    );
    if (Number.isFinite(ts)) return Math.max(0, ts);
    return 0;
  };

  const durationFromNote = (n, timeHint = 0) => {
    // Check if we have duration
    if (Number.isFinite(n.duration)) {
      return Math.max(0, n.duration * secPerBeat);
    }

    // Then check other beat-based fields
    const baseBeat = toNumber(
      n.timeBeats ?? n.startBeat ?? n.beat ?? n.startTime,
      NaN,
    );
    const db = toNumber(
      n.durationBeats ??
        n.lenBeats ??
        n.beats ??
        n.gateBeats ??
        (Number.isFinite(toNumber(n.endBeats ?? n.endBeat, NaN)) &&
        Number.isFinite(baseBeat)
          ? toNumber(n.endBeats ?? n.endBeat, NaN) - baseBeat
          : NaN),
      NaN,
    );
    if (Number.isFinite(db)) return Math.max(0, db * secPerBeat);

    const dtk = toNumber(
      n.durationTicks ??
        n.lenTicks ??
        n.ticksLen ??
        (Number.isFinite(toNumber(n.endTick ?? n.endTicks, NaN)) &&
        Number.isFinite(toNumber(n.startTick ?? n.tick ?? n.ticks, NaN))
          ? toNumber(n.endTick ?? n.endTicks, NaN) -
            toNumber(n.startTick ?? n.tick ?? n.ticks, NaN)
          : NaN),
      NaN,
    );
    if (Number.isFinite(dtk)) return Math.max(0, dtk * secPerTick);

    // Only use these if they're actually duration in seconds
    const ds = toNumber(n.len ?? n.length ?? n.durationSec, NaN);
    if (Number.isFinite(ds)) return Math.max(0, ds);

    const endB = toNumber(n.endBeats ?? n.endBeat, NaN);
    if (Number.isFinite(endB) && Number.isFinite(baseBeat)) {
      return Math.max(0, (endB - baseBeat) * secPerBeat);
    }

    const endTk = toNumber(n.endTick ?? n.endTicks, NaN);
    const startTk = toNumber(
      n.startTick ?? n.tick ?? n.ticks ?? n.startTime,
      NaN,
    );
    if (Number.isFinite(endTk) && Number.isFinite(startTk)) {
      return Math.max(0, (endTk - startTk) * secPerTick);
    }

    // Fallback for end time in seconds
    const startS = Number.isFinite(timeHint)
      ? timeHint
      : Math.max(
          0,
          toNumber(
            n.time ??
              n.start ??
              n.t ??
              n.startSec ??
              n.timeSec ??
              n.startTimeSec,
            0,
          ),
        );
    const endS = toNumber(n.end ?? n.endTime ?? n.endSec, NaN);
    if (Number.isFinite(endS)) return Math.max(0, endS - startS);

    return 0;
  };

  const pushNote = (n, extraOffsetSec = 0) => {
    if (!n) return;
    const timeLocal = timeFromNote(n);
    const time = Math.max(
      0,
      timeLocal +
        baseOffsetSec +
        (Number.isFinite(extraOffsetSec) ? extraOffsetSec : 0),
    );
    const dur = durationFromNote(n, timeLocal);
    if (!(dur > 0)) return;
    const vel = Math.max(
      0,
      Math.min(1, toNumber(n.velocity ?? n.vel ?? n.v, 1)),
    );

    let midi = n.midi ?? n.note ?? n.noteNumber ?? n.pitch ?? n.key;
    let freq = n.freq ?? n.frequency;
    if (typeof midi === 'string') midi = noteNameToMidi(midi);
    if (typeof midi === 'number' && !freq) freq = midiToFreq(midi);
    if (typeof freq !== 'number' || !(freq > 0)) return;

    out.push({ time, duration: Math.max(0, dur), velocity: vel, freq });
  };

  // 1) Common shapes (including midiData.notes)
  try {
    (track?.midi?.notes || []).forEach((n) => pushNote(n));
  } catch {}
  try {
    (track?.notes || []).forEach((n) => pushNote(n));
  } catch {}
  try {
    (track?.midiNotes || []).forEach((n) => pushNote(n));
  } catch {}
  try {
    (track?.sequence?.notes || []).forEach((n) => pushNote(n));
  } catch {}
  try {
    (track?.pattern?.notes || []).forEach((n) => pushNote(n));
  } catch {}
  try {
    (track?.midiData?.notes || []).forEach((n) => pushNote(n));
  } catch {}

  // 2) Objects that expose getters
  try {
    if (track?.midiTrack?.getNotes) {
      (track.midiTrack.getNotes() || []).forEach((n) => pushNote(n));
    } else if (Array.isArray(track?.midiTrack?.notes)) {
      track.midiTrack.notes.forEach((n) => pushNote(n));
    }
  } catch {}

  // 2b) MIDI clips/regions where notes are clip-relative; add clip.start/beat
  try {
    const clipArrays = [];
    if (Array.isArray(track?.midiClips)) clipArrays.push(...track.midiClips);
    if (Array.isArray(track?.midiRegions))
      clipArrays.push(...track.midiRegions);
    // Some apps store MIDI clips inside generic clips if they have notes
    if (Array.isArray(track?.clips)) {
      track.clips.forEach((c) => {
        if (Array.isArray(c?.notes)) clipArrays.push(c);
      });
    }

    clipArrays.forEach((clip) => {
      const clipOffsetSec =
        Math.max(0, toNumber(clip?.start ?? clip?.startSec, 0)) +
        (Number.isFinite(
          toNumber(clip?.startBeat ?? clip?.timeBeats ?? clip?.beat, NaN),
        )
          ? toNumber(clip?.startBeat ?? clip?.timeBeats ?? clip?.beat)
          : 0) *
          secPerBeat;

      (clip?.notes || []).forEach((n) => pushNote(n, clipOffsetSec));

      // If events are clip-local and self-contained with duration, push them as notes
      const evs = (clip?.events || clip?.midiEvents || []).filter(Boolean);
      evs.forEach((e) => {
        if (e && (e.duration != null || e.durationBeats != null)) {
          pushNote(e, clipOffsetSec);
        }
      });
    });
  } catch {}

  // 3) Pair note-on/off from event streams
  try {
    const evs = (
      track?.events ||
      track?.midiEvents ||
      track?.eventQueue ||
      []
    ).filter(Boolean);
    if (evs.length) {
      const active = new Map(); // key: midi (or freq), value: {time, velocity, freq}
      const normType = (t) => String(t || '').toLowerCase();

      for (const e of evs) {
        const type = normType(e.type || e.kind || e.name);
        let midi = e.midi ?? e.note ?? e.noteNumber ?? e.pitch ?? e.key;
        if (typeof midi === 'string') midi = noteNameToMidi(midi);
        let freq = e.freq ?? e.frequency;
        if (typeof midi === 'number' && !freq) freq = midiToFreq(midi);
        const key =
          typeof midi === 'number'
            ? `m${midi}`
            : typeof freq === 'number'
              ? `f${freq}`
              : null;
        if (!key) continue;

        // Time/velocity — prefer beats → ticks → seconds
        let t;
        const tb = toNumber(e.timeBeats ?? e.startBeat ?? e.beat, NaN);
        if (Number.isFinite(tb)) {
          t = tb * secPerBeat;
        } else {
          const tk = toNumber(e.ticks ?? e.tick ?? e.startTick, NaN);
          if (Number.isFinite(tk)) {
            t = tk * secPerTick;
          } else {
            const ts = toNumber(
              e.time ??
                e.start ??
                e.t ??
                e.timeSec ??
                e.startSec ??
                e.ts ??
                e.pos ??
                e.position ??
                e.posSec ??
                e.positionSec,
              NaN,
            );
            t = Number.isFinite(ts) ? ts : 0;
          }
        }
        t = Math.max(0, t + baseOffsetSec);
        const v = Math.max(
          0,
          Math.min(1, toNumber(e.velocity ?? e.vel ?? e.v, 1)),
        );

        if (type.includes('noteon') || type === 'on' || type === 'down') {
          active.set(key, {
            time: t,
            velocity: v,
            freq:
              freq || (typeof midi === 'number' ? midiToFreq(midi) : undefined),
          });
        } else if (
          type.includes('noteoff') ||
          type === 'off' ||
          type === 'up'
        ) {
          const a = active.get(key);
          if (a) {
            let d = toNumber(e.duration, NaN);
            if (!Number.isFinite(d)) d = toNumber(e.len, NaN);
            if (!Number.isFinite(d)) d = toNumber(e.length, NaN);
            if (!Number.isFinite(d)) {
              const db =
                e.durationBeats != null
                  ? e.durationBeats
                  : e.lenBeats != null
                    ? e.lenBeats
                    : e.beats != null
                      ? e.beats
                      : e.gateBeats != null
                        ? e.gateBeats
                        : null;
              d = db != null ? toNumber(db, 0) * secPerBeat : t - a.time;
            }
            if (!Number.isFinite(d)) {
              const dtk = toNumber(
                e.durationTicks ??
                  e.lenTicks ??
                  (Number.isFinite(toNumber(e.endTick ?? e.endTicks, NaN)) &&
                  Number.isFinite(
                    toNumber(e.startTick ?? e.tick ?? e.ticks, NaN),
                  )
                    ? toNumber(e.endTick ?? e.endTicks, NaN) -
                      toNumber(e.startTick ?? e.tick ?? e.ticks, NaN)
                    : NaN),
                NaN,
              );
              if (Number.isFinite(dtk)) d = dtk * secPerTick;
            }
            const dur = Math.max(0, d);
            if (dur > 0)
              out.push({
                time: a.time,
                duration: dur,
                velocity: a.velocity,
                freq: a.freq,
              });
            active.delete(key);
          }
        } else if (e.duration != null || e.durationBeats != null) {
          const d = durationFromNote(e);
          if (d > 0) pushNote({ time: t, duration: d, velocity: v, freq });
        }
      }
      // Any hanging notes – short default
      for (const [, a] of active) {
        const dur = 0.2;
        out.push({
          time: a.time,
          duration: dur,
          velocity: a.velocity,
          freq: a.freq,
        });
      }
    }
  } catch {}

  // 4) Step sequencer grids → seconds using tempo hints
  try {
    const seq = track?.stepSequencer || track?.sequencer || track?.steps;
    const steps = Array.isArray(seq?.steps)
      ? seq.steps
      : Array.isArray(seq)
        ? seq
        : [];
    if (steps && steps.length) {
      const secPerStep = secPerBeat / stepsPerBeat;

      steps.forEach((row) => {
        const cells = Array.isArray(row?.cells)
          ? row.cells
          : Array.isArray(row)
            ? row
            : [];
        const pitch = row?.pitch ?? row?.midi ?? row?.note ?? row?.key;
        const baseMidi =
          typeof pitch === 'string'
            ? noteNameToMidi(pitch)
            : typeof pitch === 'number'
              ? pitch
              : null;
        const baseFreq = baseMidi != null ? midiToFreq(baseMidi) : undefined;

        cells.forEach((cell, i) => {
          const on = !!(
            cell?.on ??
            cell?.active ??
            (cell === 1 || cell === true)
          );
          if (!on) return;
          const lenSteps = toNumber(cell?.len ?? cell?.length ?? cell?.gate, 1);
          const vel = Math.max(
            0,
            Math.min(1, toNumber(cell?.vel ?? cell?.velocity, 1)),
          );
          let freq = cell?.freq ?? cell?.frequency;
          if (!freq) {
            let m = cell?.midi ?? cell?.note ?? cell?.noteNumber ?? baseMidi;
            if (typeof m === 'string') m = noteNameToMidi(m);
            if (typeof m === 'number') freq = midiToFreq(m);
            else if (baseFreq) freq = baseFreq;
          }
          if (!freq) return;
          const t =
            toNumber(cell?.i ?? cell?.index ?? i, 0) * secPerStep +
            baseOffsetSec;
          const dur = Math.max(
            0,
            toNumber(cell?.duration ?? cell?.lenSec, lenSteps * secPerStep),
          );
          if (dur > 0)
            out.push({ time: t, duration: dur, velocity: vel, freq });
        });
      });
    }
  } catch {}

  // De-duplicate identical notes that may exist in multiple containers (e.g., midiData.notes & notes)
  out.sort(
    (a, b) => a.time - b.time || a.freq - b.freq || a.duration - b.duration,
  );
  const seen = new Set();
  const dedup = [];
  const r = (x, p) => Math.round(x * p) / p; // fixed precision keying
  for (const n of out) {
    const key = `${r(n.time, 1000)}|${r(n.duration, 1000)}|${r(n.freq, 10)}`; // 1ms / 1ms / 0.1Hz
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(n);
  }
  try {
    if (typeof window !== 'undefined' && window.__MIXDOWN_DEBUG__) {
      console.log(
        '[Mixdown MIDI]',
        track?.name || track?.id || 'track',
        'notes:',
        dedup.slice(0, 24),
      );
    }
  } catch {}
  return dedup;
}

/**
 * Mixdown engine — clip & MIDI aware, independent of WaveSurfer
 */
async function mixdownClipsAndMidi(
  tracks,
  sampleRateHint = 44100,
  onProgress = () => {},
  bpm = 120,
) {
  onProgress(5);
  const soloIds = new Set(tracks.filter((t) => t.soloed).map((t) => t.id));
  const included = tracks.filter((t) => {
    const hasAudio = Array.isArray(t.clips) && t.clips.length > 0;
    const hasMidi = collectTrackMidiNotes(t, { bpm }).length > 0;
    if (!hasAudio && !hasMidi) return false;
    if (soloIds.size > 0) return soloIds.has(t.id) && !t.muted;
    return !t.muted;
  });
  if (included.length === 0)
    throw new Error('No audible tracks (audio or MIDI) to mix down.');

  // Decode unique audio sources once
  onProgress(12);
  const allClips = included.flatMap((t) => t.clips || []);
  const uniqueSrc = Array.from(
    new Set(allClips.map((c) => c?.src).filter(Boolean)),
  );
  const bufferMap = new Map(); // src -> AudioBuffer

  let done = 0;
  await Promise.all(
    uniqueSrc.map(async (src) => {
      try {
        const buf = await decodeAudioFromURL(src);
        bufferMap.set(src, buf);
      } finally {
        done += 1;
        onProgress(
          12 + Math.round((done / Math.max(1, uniqueSrc.length)) * 38),
        );
      }
    }),
  );

  // Compute project duration from audio clips and MIDI notes
  const projectDuration = included.reduce((maxT, track) => {
    let endAudio = 0;
    (track.clips || []).forEach((c) => {
      const buf = bufferMap.get(c?.src);
      if (!buf) return;
      const off = Math.max(0, toNumber(c?.offset, 0));
      const dur = Math.max(
        0,
        Math.min(toNumber(c?.duration, 0), Math.max(0, buf.duration - off)),
      );
      endAudio = Math.max(endAudio, toNumber(c?.start, 0) + dur);
    });

    let endMidi = 0;
    collectTrackMidiNotes(track, { bpm }).forEach((n) => {
      endMidi = Math.max(endMidi, n.time + n.duration);
    });

    return Math.max(maxT, Math.max(endAudio, endMidi));
  }, 0);
  if (!(projectDuration > 0))
    throw new Error('Project duration is 0 – nothing to render.');

  // Choose sample rate (prefer highest decoded buffer rate, fallback to hint)
  const highestRate = Math.max(
    sampleRateHint,
    ...Array.from(bufferMap.values()).map((b) => b.sampleRate || 0),
  );

  // Create OfflineAudioContext and schedule
  const length = Math.ceil(projectDuration * highestRate);
  const offline = new OfflineAudioContext(2, length, highestRate);
  // Master bus with gentle soft-clip to avoid summed-voice distortion
  const masterGain = offline.createGain();
  masterGain.gain.value = 0.9; // -1 dBFS headroom
  const masterShaper = offline.createWaveShaper();
  masterShaper.curve = makeSoftClipCurve(4096, 0.4);
  masterGain.connect(masterShaper);
  masterShaper.connect(offline.destination);

  included.forEach((track) => {
    const trackGain = offline.createGain();
    trackGain.gain.value = track.muted
      ? 0
      : typeof track.volume === 'number'
        ? track.volume
        : 1;

    const panner = offline.createStereoPanner
      ? offline.createStereoPanner()
      : null;
    if (panner) {
      panner.pan.value = typeof track.pan === 'number' ? track.pan : 0;
      trackGain.connect(panner);
      panner.connect(masterGain);
    } else {
      trackGain.connect(masterGain);
    }

    // Audio clips
    (track.clips || []).forEach((c) => {
      const buf = bufferMap.get(c?.src);
      if (!buf) return;
      const start = Math.max(0, toNumber(c?.start, 0));
      const offset = Math.max(0, toNumber(c?.offset, 0));
      const maxDur = Math.max(0, buf.duration - offset);
      const clipDur = Math.max(0, Math.min(toNumber(c?.duration, 0), maxDur));
      if (!(clipDur > 0)) return;

      const src = offline.createBufferSource();
      src.buffer = buf;
      src.connect(trackGain);
      try {
        src.start(start, offset, clipDur);
      } catch (e) {
        try {
          src.start(start, offset);
        } catch {}
      }
    });

    // MIDI notes (simple synth fallback)
    const notes = collectTrackMidiNotes(track, { bpm });
    const A = 0.005,
      D = 0.01,
      S = 0.8,
      R = 0.05; // ADSR defaults
    notes.forEach((n) => {
      const start = Math.max(0, n.time);
      const dur = Math.max(0, n.duration);
      if (!(dur > 0)) return;

      const osc = offline.createOscillator();
      try {
        osc.type = track.waveform || 'sine';
      } catch {
        osc.type = 'sine';
      }
      // schedule pitch precisely at note start (offline-safe)
      osc.frequency.setValueAtTime(n.freq, start);

      const env = offline.createGain();
      const peak = Math.max(
        0,
        Math.min(1, (track.midiLevel ?? 0.15) * (n.velocity ?? 1)),
      );
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(peak, start + A);
      env.gain.linearRampToValueAtTime(peak * S, start + A + D);
      env.gain.setValueAtTime(peak * S, start + Math.max(0, dur - R));
      env.gain.linearRampToValueAtTime(0, start + Math.max(0, dur));

      osc.connect(env);
      env.connect(trackGain);

      try {
        osc.start(start);
        osc.stop(start + dur);
      } catch {}
    });
  });

  onProgress(65);
  const rendered = await offline.startRendering();
  onProgress(100);
  return rendered;
}

/** Convert AudioBuffer to WAV blob */
function audioBufferToWav(buffer) {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  const channels = [];
  let offset = 0;
  let pos = 0;

  const setUint16 = (data) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };
  const setUint32 = (data) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  // RIFF header
  setUint32(0x46464952); // RIFF
  setUint32(length - 8);
  setUint32(0x45564157); // WAVE

  // fmt  chunk
  setUint32(0x20746d66); // fmt
  setUint32(16);
  setUint16(1);
  setUint16(buffer.numberOfChannels);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels);
  setUint16(buffer.numberOfChannels * 2);
  setUint16(16);

  // data chunk
  setUint32(0x61746164); // data
  setUint32(length - pos - 4);

  // interleave
  const interleaved = new Float32Array(buffer.length * buffer.numberOfChannels);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++)
    channels[ch] = buffer.getChannelData(ch);
  offset = 0;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < buffer.numberOfChannels; ch++)
      interleaved[offset++] = channels[ch][i];
  }

  // float -> 16-bit PCM
  const volume = 0.95;
  offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const s = Math.max(-1, Math.min(1, interleaved[i])) * volume;
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export default function MultitrackMixdown() {
  const { tracks, addTrack, soloTrackId, bpm: contextBpm } = useMultitrack();
  const bpm = Number(contextBpm) || 120;
  const [showModal, setShowModal] = useState(false);
  const [mixdownName, setMixdownName] = useState('Mixdown');
  const [addToProject, setAddToProject] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  // Derive which tracks would be included right now (mute/solo, has audio or MIDI)
  const includedTracks = useMemo(() => {
    const soloSet = soloTrackId ? new Set([soloTrackId]) : null;
    return tracks
      .filter((t) => {
        const hasAudio = Array.isArray(t.clips) && t.clips.length > 0;
        const hasMidiNotes = collectTrackMidiNotes(t, { bpm }).length > 0;
        const looksLikeMidi = !!(
          t?.midi ||
          t?.midiTrack ||
          t?.notes ||
          t?.midiNotes ||
          t?.sequence ||
          t?.pattern ||
          t?.events ||
          t?.midiEvents ||
          t?.eventQueue ||
          t?.stepSequencer ||
          t?.sequencer ||
          t?.steps ||
          t?.type === 'midi' ||
          t?.kind === 'midi'
        );
        if (!hasAudio && !hasMidiNotes && !looksLikeMidi) return false;
        if (soloSet) return soloSet.has(t.id) && !t.muted;
        return !t.muted;
      })
      .map((t) => ({ ...t, soloed: soloSet ? soloSet.has(t.id) : false }));
  }, [tracks, soloTrackId, bpm]);

  const canMixdown = includedTracks.length > 0;

  const handleMixdown = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      const onProgress = (p) => setProgress(Math.min(100, Math.max(0, p)));
      const rendered = await mixdownClipsAndMidi(
        includedTracks,
        44100,
        onProgress,
        bpm,
      );

      const blob = audioBufferToWav(rendered);
      const audioURL = URL.createObjectURL(blob);

      if (addToProject) {
        const clipId = `clip-mixdown-${Date.now()}`;
        const newClip = {
          id: clipId,
          start: 0,
          duration: rendered.duration,
          color: '#ff6b6b',
          src: audioURL,
          offset: 0,
          name: mixdownName || 'Mixdown',
        };
        addTrack({
          name: mixdownName || 'Mixdown',
          isMixdown: true,
          color: '#ff6b6b',
          volume: 1,
          pan: 0,
          muted: false,
          audioURL,
          clips: [newClip],
        });
      } else {
        const a = document.createElement('a');
        a.href = audioURL;
        a.download = `${mixdownName || 'mixdown'}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(audioURL), 100);
      }

      setProgress(100);
      setTimeout(() => {
        setShowModal(false);
        setIsProcessing(false);
        setProgress(0);
      }, 400);
    } catch (err) {
      console.error('Mixdown error:', err);
      setError(err.message || String(err));
      setIsProcessing(false);
    }
  }, [includedTracks, addToProject, mixdownName, addTrack, bpm]);

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setShowModal(true)}
        disabled={!canMixdown}
        title={
          canMixdown
            ? 'Mix all audible audio & MIDI to stereo'
            : 'Add unmuted tracks with clips or MIDI to enable mixdown'
        }
      >
        <FaMixcloud /> Mixdown
      </Button>

      <Modal
        show={showModal}
        onHide={() => !isProcessing && setShowModal(false)}
      >
        <Modal.Header closeButton={!isProcessing}>
          <Modal.Title>Mixdown Tracks</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Mixdown Name</Form.Label>
              <Form.Control
                type="text"
                value={mixdownName}
                onChange={(e) => setMixdownName(e.target.value)}
                disabled={isProcessing}
                placeholder="Enter mixdown name"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Destination</Form.Label>
              <Form.Check
                type="checkbox"
                label="Add mixdown as new track"
                checked={addToProject}
                onChange={(e) => setAddToProject(e.target.checked)}
                disabled={isProcessing}
              />
            </Form.Group>

            <div className="mb-3">
              <strong>Tracks to Mix:</strong>
              <ul className="mt-2">
                {includedTracks.map((t) => (
                  <li key={t.id}>
                    {t.name}
                    {t.volume !== 1 &&
                      ` (vol: ${Math.round((t.volume || 1) * 100)}%)`}
                    {t.pan !== 0 &&
                      ` (pan: ${t.pan > 0 ? 'R' : 'L'}${Math.abs(Math.round((t.pan || 0) * 100))}%)`}
                    {collectTrackMidiNotes(t, { bpm }).length > 0 ||
                    t?.type === 'midi' ||
                    t?.kind === 'midi' ||
                    t?.midi ||
                    t?.midiTrack ||
                    t?.notes ||
                    t?.midiNotes ||
                    t?.sequence ||
                    t?.pattern ||
                    t?.events ||
                    t?.midiEvents ||
                    t?.eventQueue ||
                    t?.stepSequencer ||
                    t?.sequencer ||
                    t?.steps
                      ? ' [MIDI]'
                      : ''}
                    {Array.isArray(t.clips) && t.clips.length > 0
                      ? ' [AUDIO]'
                      : ''}
                    {t.soloed ? ' [solo]' : ''}
                  </li>
                ))}
              </ul>
            </div>

            {isProcessing && (
              <ProgressBar
                now={progress}
                label={`${progress}%`}
                animated
                striped
              />
            )}
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowModal(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleMixdown}
            disabled={isProcessing || !canMixdown}
          >
            {isProcessing
              ? 'Processing…'
              : addToProject
                ? 'Create Mixdown'
                : 'Export WAV'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
