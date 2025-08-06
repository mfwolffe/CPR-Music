// components/audio/DAW/Multitrack/EffectsPanel.js
'use client';

import { useState } from 'react';
import { Button, Form, Card, Alert } from 'react-bootstrap';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import TrackEffectsProcessor from './TrackEffectsProcessor';

const AVAILABLE_EFFECTS = [
  { id: 'reverb', name: 'Reverb', category: 'Space' },
  { id: 'echo', name: 'Echo', category: 'Space' },
  { id: 'delay', name: 'Delay', category: 'Time' },
  { id: 'chorus', name: 'Chorus', category: 'Modulation' },
  { id: 'flanger', name: 'Flanger', category: 'Modulation' },
  { id: 'phaser', name: 'Phaser', category: 'Modulation' },
  { id: 'distortion', name: 'Distortion', category: 'Dynamics' },
  { id: 'compressor', name: 'Compressor', category: 'Dynamics' },
  { id: 'gate', name: 'Gate', category: 'Dynamics' },
  { id: 'eq', name: 'EQ', category: 'Frequency' },
  { id: 'pitch', name: 'Pitch Shift', category: 'Pitch' },
  { id: 'tremolo', name: 'Tremolo', category: 'Modulation' },
  { id: 'autopan', name: 'Auto Pan', category: 'Space' },
];

export default function EffectsPanel() {
  const { activeRegion, tracks, updateTrack } = useMultitrack();
  const [selectedEffect, setSelectedEffect] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Group effects by category
  const effectsByCategory = AVAILABLE_EFFECTS.reduce((acc, effect) => {
    if (!acc[effect.category]) acc[effect.category] = [];
    acc[effect.category].push(effect);
    return acc;
  }, {});

  const handleApplyEffect = async () => {
    if (!activeRegion || !selectedEffect) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Get the track with the active region
      const track = tracks.find((t) => t.id === activeRegion.trackId);
      if (!track || !track.wavesurferInstance) {
        throw new Error('Track not found or not ready');
      }

      // Get the audio buffer from wavesurfer
      const wavesurfer = track.wavesurferInstance;
      const audioBuffer = await wavesurfer.getDecodedData();

      if (!audioBuffer) {
        throw new Error('No audio loaded in track');
      }

      // Create audio context
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      // Process the region with the selected effect
      const processedBuffer = await TrackEffectsProcessor.processRegion(
        audioBuffer,
        activeRegion.start,
        activeRegion.end,
        selectedEffect,
        {}, // Default parameters for now
        audioContext,
      );

      // Convert to blob and create URL
      const wavBlob =
        await TrackEffectsProcessor.audioBufferToWav(processedBuffer);
      const newAudioURL = URL.createObjectURL(wavBlob);

      // Update the track with new audio
      updateTrack(track.id, { audioURL: newAudioURL });

      // Clear the active region
      if (activeRegion.instance) {
        activeRegion.instance.remove();
      }
    } catch (err) {
      console.error('Error applying effect:', err);
      setError(err.message || 'Failed to apply effect');
    } finally {
      setIsProcessing(false);
    }
  };

  const getActiveTrackName = () => {
    if (!activeRegion) return null;
    const track = tracks.find((t) => t.id === activeRegion.trackId);
    return track?.name || 'Unknown';
  };

  return (
    <Card bg="dark" text="white" className="effects-panel">
      <Card.Header>
        <h5 className="mb-0">Effects</h5>
      </Card.Header>
      <Card.Body>
        {!activeRegion ? (
          <Alert variant="info">
            Select a region on any track to apply effects
          </Alert>
        ) : (
          <>
            <Alert variant="success" className="small py-2">
              Region selected on: <strong>{getActiveTrackName()}</strong>
              <br />
              {activeRegion.start.toFixed(2)}s - {activeRegion.end.toFixed(2)}s
            </Alert>

            <Form.Group className="mb-3">
              <Form.Label>Choose Effect</Form.Label>
              <Form.Select
                value={selectedEffect}
                onChange={(e) => setSelectedEffect(e.target.value)}
                disabled={isProcessing}
              >
                <option value="">-- Select Effect --</option>
                {Object.entries(effectsByCategory).map(
                  ([category, effects]) => (
                    <optgroup key={category} label={category}>
                      {effects.map((effect) => (
                        <option key={effect.id} value={effect.id}>
                          {effect.name}
                        </option>
                      ))}
                    </optgroup>
                  ),
                )}
              </Form.Select>
            </Form.Group>

            {error && (
              <Alert variant="danger" className="small">
                {error}
              </Alert>
            )}

            <Button
              variant="primary"
              onClick={handleApplyEffect}
              disabled={!selectedEffect || isProcessing}
              className="w-100"
            >
              {isProcessing ? 'Processing...' : 'Apply Effect'}
            </Button>

            <hr />

            <div className="text-muted small">
              <p className="mb-1">Tips:</p>
              <ul className="mb-0 ps-3">
                <li>Effects are applied to the selected region only</li>
                <li>Use Ctrl+Z to undo (coming soon)</li>
                <li>Create multiple regions for precise editing</li>
              </ul>
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  );
}
