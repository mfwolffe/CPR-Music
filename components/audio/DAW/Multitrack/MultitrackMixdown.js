// components/audio/DAW/Multitrack/MultitrackMixdown.js
'use client';

import { useState, useCallback } from 'react';
import { Button, Modal, Form, ProgressBar, Alert } from 'react-bootstrap';
import { FaDownload, FaMixcloud } from 'react-icons/fa';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

/**
 * Mixdown multiple tracks into a single stereo track
 * @param {Array} tracks - Array of track objects with wavesurfer instances
 * @param {number} outputDuration - Duration in seconds
 * @returns {Promise<AudioBuffer>} - Mixed stereo audio buffer
 */
async function mixdownTracks(tracks, outputDuration) {
  // Find the highest sample rate among all tracks
  const sampleRates = tracks
    .filter((t) => t.wavesurferInstance)
    .map((t) => t.wavesurferInstance.getDecodedData()?.sampleRate || 44100);
  const sampleRate = Math.max(...sampleRates, 44100);

  // Create offline context for mixing
  const outputLength = Math.ceil(outputDuration * sampleRate);
  const offlineContext = new OfflineAudioContext(2, outputLength, sampleRate);

  // Process each track
  for (const track of tracks) {
    if (!track.wavesurferInstance || track.muted) continue;

    try {
      const audioBuffer = await track.wavesurferInstance.getDecodedData();
      if (!audioBuffer) continue;

      // Create source
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;

      // Create gain node for volume
      const gainNode = offlineContext.createGain();
      gainNode.gain.value = track.volume || 1;

      // Create stereo panner for pan control
      const pannerNode = offlineContext.createStereoPanner();
      pannerNode.pan.value = track.pan || 0;

      // Connect nodes: source -> gain -> panner -> destination
      source.connect(gainNode);
      gainNode.connect(pannerNode);
      pannerNode.connect(offlineContext.destination);

      // Start playback
      source.start(0);
    } catch (error) {
      console.error(`Error processing track ${track.id}:`, error);
    }
  }

  // Render the mixed audio
  const renderedBuffer = await offlineContext.startRendering();
  return renderedBuffer;
}

/**
 * Convert AudioBuffer to WAV blob
 */
function audioBufferToWav(buffer) {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  const channels = [];
  let offset = 0;
  let pos = 0;

  // write WAVE header
  const setUint16 = (data) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };
  const setUint32 = (data) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  // RIFF identifier
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  // fmt sub-chunk
  setUint32(0x20746d66); // "fmt "
  setUint32(16); // subchunk size
  setUint16(1); // PCM
  setUint16(buffer.numberOfChannels);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels); // byte rate
  setUint16(buffer.numberOfChannels * 2); // block align
  setUint16(16); // bits per sample

  // data sub-chunk
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4); // subchunk size

  // write interleaved data
  const interleaved = new Float32Array(buffer.length * buffer.numberOfChannels);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    channels[channel] = buffer.getChannelData(channel);
  }

  offset = 0;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      interleaved[offset++] = channels[channel][i];
    }
  }

  // Convert float samples to 16-bit PCM
  const volume = 0.95; // slightly reduce to prevent clipping
  offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const sample = Math.max(-1, Math.min(1, interleaved[i])) * volume;
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export default function MultitrackMixdown() {
  const { tracks, addTrack } = useMultitrack();
  const [showModal, setShowModal] = useState(false);
  const [mixdownName, setMixdownName] = useState('Mixdown');
  const [exportFormat, setExportFormat] = useState('wav');
  const [addToProject, setAddToProject] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const handleMixdown = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      // Get tracks with audio
      const audioTracks = tracks.filter(
        (t) => t.wavesurferInstance && t.audioURL,
      );

      if (audioTracks.length === 0) {
        throw new Error('No audio tracks to mixdown');
      }

      setProgress(10);

      // Find the longest duration
      const durations = await Promise.all(
        audioTracks.map(async (track) => {
          const ws = track.wavesurferInstance;
          return ws ? ws.getDuration() : 0;
        }),
      );
      const maxDuration = Math.max(...durations);

      setProgress(30);

      // Perform mixdown
      const mixedBuffer = await mixdownTracks(audioTracks, maxDuration);

      setProgress(70);

      // Convert to blob
      const blob = audioBufferToWav(mixedBuffer);
      const audioURL = URL.createObjectURL(blob);

      setProgress(90);

      if (addToProject) {
        // Add as new track
        addTrack({
          name: mixdownName || 'Mixdown',
          audioURL: audioURL,
          isMixdown: true,
          color: '#ff6b6b', // Red color for mixdown tracks
        });
      } else {
        // Download the file
        const a = document.createElement('a');
        a.href = audioURL;
        a.download = `${mixdownName || 'mixdown'}.${exportFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Clean up
        setTimeout(() => URL.revokeObjectURL(audioURL), 100);
      }

      setProgress(100);
      setTimeout(() => {
        setShowModal(false);
        setIsProcessing(false);
        setProgress(0);
      }, 500);
    } catch (err) {
      console.error('Mixdown error:', err);
      setError(err.message);
      setIsProcessing(false);
    }
  }, [tracks, addTrack, mixdownName, exportFormat, addToProject]);

  const activeTracks = tracks.filter((t) => t.audioURL && !t.muted);
  const canMixdown = activeTracks.length > 0;

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setShowModal(true)}
        disabled={!canMixdown}
        title={
          !canMixdown
            ? 'Add audio tracks to enable mixdown'
            : 'Mix all tracks to stereo'
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
              <Form.Label>Output Options</Form.Label>
              <Form.Check
                type="checkbox"
                label="Add mixdown as new track"
                checked={addToProject}
                onChange={(e) => setAddToProject(e.target.checked)}
                disabled={isProcessing}
              />
            </Form.Group>

            {!addToProject && (
              <Form.Group className="mb-3">
                <Form.Label>Export Format</Form.Label>
                <Form.Select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  disabled={isProcessing}
                >
                  <option value="wav">WAV (Uncompressed)</option>
                  <option value="mp3" disabled>
                    MP3 (Coming Soon)
                  </option>
                  <option value="ogg" disabled>
                    OGG (Coming Soon)
                  </option>
                </Form.Select>
              </Form.Group>
            )}

            <div className="mb-3">
              <strong>Tracks to Mix:</strong>
              <ul className="mt-2">
                {activeTracks.map((track) => (
                  <li key={track.id}>
                    {track.name}
                    {track.volume !== 1 &&
                      ` (vol: ${Math.round(track.volume * 100)}%)`}
                    {track.pan !== 0 &&
                      ` (pan: ${track.pan > 0 ? 'R' : 'L'}${Math.abs(Math.round(track.pan * 100))}%)`}
                  </li>
                ))}
              </ul>
              {tracks.some((t) => t.muted && t.audioURL) && (
                <small className="text-muted">
                  Muted tracks will be excluded from mixdown
                </small>
              )}
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
              ? 'Processing...'
              : addToProject
                ? 'Create Mixdown'
                : 'Export'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
