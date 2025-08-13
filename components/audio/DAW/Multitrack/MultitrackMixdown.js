// components/audio/DAW/Multitrack/MultitrackMixdown.js
'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button, Modal, Form, ProgressBar, Alert } from 'react-bootstrap';
import { FaDownload, FaMixcloud } from 'react-icons/fa';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import { decodeAudioFromURL } from './AudioEngine';

/**
 * Clip‑aware mixdown (independent of WaveSurfer):
 * - Respects per‑clip {start, duration, offset}
 * - Respects per‑track volume/pan, mute and solo
 * - Produces silence for gaps between clips
 */
async function mixdownClips(
  tracks,
  sampleRateHint = 44100,
  onProgress = () => {},
) {
  // 1) Filter to included tracks (mute/solo + must have clips)
  onProgress(5);
  const soloIds = new Set(tracks.filter((t) => t.soloed).map((t) => t.id));
  const included = tracks.filter((t) => {
    if (!Array.isArray(t.clips) || t.clips.length === 0) return false;
    if (soloIds.size > 0) return soloIds.has(t.id) && !t.muted;
    return !t.muted;
  });
  if (included.length === 0)
    throw new Error('No (unmuted) tracks with clips to mix down.');

  // 2) Decode unique sources once
  onProgress(10);
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
          10 + Math.round((done / Math.max(1, uniqueSrc.length)) * 40),
        );
      }
    }),
  );

  // 3) Compute project duration from clips actually renderable with buffers
  const projectDuration = included.reduce((maxT, track) => {
    const end = (track.clips || []).reduce((m, c) => {
      const buf = bufferMap.get(c?.src);
      if (!buf) return m;
      const off = Math.max(0, Number(c?.offset) || 0);
      const dur = Math.max(
        0,
        Math.min(Number(c?.duration) || 0, Math.max(0, buf.duration - off)),
      );
      return Math.max(m, (Number(c?.start) || 0) + dur);
    }, 0);
    return Math.max(maxT, end);
  }, 0);
  if (!(projectDuration > 0))
    throw new Error('Project duration is 0 – nothing to render.');

  // 4) Choose sample rate (prefer the highest among decoded buffers, fallback to hint)
  const highestRate = Math.max(
    sampleRateHint,
    ...Array.from(bufferMap.values()).map((b) => b.sampleRate || 0),
  );

  // 5) Create OfflineAudioContext and schedule all clips at their start times
  const length = Math.ceil(projectDuration * highestRate);
  const offline = new OfflineAudioContext(2, length, highestRate);

  // Track scheduling
  included.forEach((track) => {
    const gain = offline.createGain();
    gain.gain.value = track.muted
      ? 0
      : typeof track.volume === 'number'
        ? track.volume
        : 1;

    const panner = offline.createStereoPanner
      ? offline.createStereoPanner()
      : null;
    if (panner) {
      panner.pan.value = typeof track.pan === 'number' ? track.pan : 0;
      gain.connect(panner);
      panner.connect(offline.destination);
    } else {
      gain.connect(offline.destination);
    }

    (track.clips || []).forEach((c) => {
      const buf = bufferMap.get(c?.src);
      if (!buf) return; // skip missing/failed buffer
      const start = Math.max(0, Number(c?.start) || 0);
      const offset = Math.max(0, Number(c?.offset) || 0);
      const maxDur = Math.max(0, buf.duration - offset);
      const clipDur = Math.max(0, Math.min(Number(c?.duration) || 0, maxDur));
      if (!(clipDur > 0)) return;

      const src = offline.createBufferSource();
      src.buffer = buf;
      src.connect(gain);

      try {
        src.start(start, offset, clipDur);
      } catch (e) {
        // Some browsers throw when duration hits exact end; retry w/o explicit duration
        try {
          src.start(start, offset);
        } catch {}
      }
    });
  });

  onProgress(60);
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
  const { tracks, addTrack, soloTrackId } = useMultitrack();
  const [showModal, setShowModal] = useState(false);
  const [mixdownName, setMixdownName] = useState('Mixdown');
  const [addToProject, setAddToProject] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  // Derive which tracks would be included right now (mute/solo, has clips)
  const includedTracks = useMemo(() => {
    const soloSet = soloTrackId ? new Set([soloTrackId]) : null;
    return tracks
      .filter((t) => {
        const hasClips = Array.isArray(t.clips) && t.clips.length > 0;
        if (!hasClips) return false;
        if (soloSet) return soloSet.has(t.id) && !t.muted;
        return !t.muted;
      })
      .map((t) => ({ ...t, soloed: soloSet ? soloSet.has(t.id) : false }));
  }, [tracks, soloTrackId]);

  const canMixdown = includedTracks.length > 0;

  const handleMixdown = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      const onProgress = (p) => setProgress(Math.min(100, Math.max(0, p)));
      const rendered = await mixdownClips(includedTracks, 44100, onProgress);

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
  }, [includedTracks, addToProject, mixdownName, addTrack]);

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setShowModal(true)}
        disabled={!canMixdown}
        title={
          canMixdown
            ? 'Mix all audible clips to stereo'
            : 'Add unmuted tracks with clips to enable mixdown'
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
