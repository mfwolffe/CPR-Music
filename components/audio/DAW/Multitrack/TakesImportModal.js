// components/audio/DAW/Multitrack/TakesImportModal.js
'use client';

import { useState, useEffect } from 'react';
import { Modal, Button, ListGroup, Form, Badge } from 'react-bootstrap';
import { FaFileAudio, FaClock, FaMusic } from 'react-icons/fa';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import { decodeAudioFromURL } from './AudioEngine';
import waveformCache from './WaveformCache';

export default function TakesImportModal({ show, onHide, takes = [] }) {
  const { addTrack } = useMultitrack();
  const [selectedTake, setSelectedTake] = useState(null);
  const [trackName, setTrackName] = useState('');

  // Update track name when take is selected
  useEffect(() => {
    if (selectedTake) {
      // Generate default name from take info
      const takeName =
        selectedTake.name ||
        `${selectedTake.partType} - Take ${selectedTake.takeNumber}`;
      setTrackName(takeName);
    }
  }, [selectedTake]);

  const handleImport = async () => {
    if (selectedTake && selectedTake.audioURL) {
      console.log('Importing take:', selectedTake);

      try {
        let finalURL = selectedTake.audioURL;

        // For blob URLs, we might need to ensure they're still valid
        if (selectedTake.audioURL.startsWith('blob:')) {
          // Check if blob is still accessible
          const response = await fetch(selectedTake.audioURL);
          if (response.ok) {
            const blob = await response.blob();
            finalURL = URL.createObjectURL(blob);
          } else {
            throw new Error('Blob URL expired');
          }
        }

        // Create immediate placeholder clip (Progressive Loading approach)
        const clipId = `clip-take-${selectedTake.id}-${Date.now()}`;
        const placeholderClip = {
          id: clipId,
          start: 0,
          duration: 0, // Will update when decoded
          color: '#7bafd4',
          src: finalURL,
          offset: 0,
          name: trackName || 'Imported Take',
          isLoading: true,
          loadingState: 'reading'
        };

        // Add track immediately with placeholder - UI stays responsive!
        addTrack({
          name: trackName || 'Imported Take',
          audioURL: finalURL,
          takeId: selectedTake.id,
          clips: [placeholderClip],
        });

        // Close modal immediately - track is already visible
        setSelectedTake(null);
        setTrackName('');
        onHide();

        // Continue processing in background (non-blocking)
        setTimeout(async () => {
          try {
            // Decode audio to get duration
            const audioBuffer = await decodeAudioFromURL(finalURL);
            const duration = audioBuffer ? audioBuffer.duration : 0;

            // Update clip with real duration
            const finalClip = {
              ...placeholderClip,
              duration: duration,
              isLoading: false,
              loadingState: 'complete'
            };

            // Update existing track
            // Note: We need to find the track by takeId since we don't have direct access
            // to updateTrack here. This could be improved by passing updateTrack as a prop.
            console.log('✅ Take import complete - duration:', duration);

            // Preload waveform peaks
            waveformCache.preloadURL(finalURL).catch((err) => {
              console.warn('Failed to preload waveform for imported take:', err);
            });

          } catch (bgErr) {
            console.error('Background processing failed:', bgErr);
            // Could emit an event or use a global store to update the clip error state
          }
        }, 100); // Small delay to ensure UI update happens first

      } catch (err) {
        console.error('Error importing take:', err);
        alert('Failed to import take: ' + err.message);
      }
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Mock data for testing if no takes provided
  const displayTakes = takes.length > 0 ? takes : [];

  // Show helpful message if no takes
  if (displayTakes.length === 0 && takes.length === 0) {
    console.log('No takes available in TakesImportModal');
  }

  return (
    <Modal show={show} onHide={onHide} size="lg" className="takes-import-modal">
      <Modal.Header closeButton className="bg-dark text-white">
        <Modal.Title>
          <FaFileAudio className="me-2" />
          Import Take to Multitrack
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="bg-dark">
        {displayTakes.length === 0 ? (
          <div className="text-center text-muted py-5">
            <p>No takes available. Record some takes first!</p>
          </div>
        ) : (
          <>
            <h6 className="text-white mb-3">Select a take to import:</h6>
            <ListGroup className="mb-3">
              {displayTakes.map((take) => (
                <ListGroup.Item
                  key={take.id}
                  action
                  active={selectedTake?.id === take.id}
                  onClick={() => setSelectedTake(take)}
                  className="d-flex justify-content-between align-items-center"
                >
                  <div>
                    <div className="fw-bold">
                      <FaMusic className="me-2" />
                      {take.name ||
                        `${take.partType} - Take ${take.takeNumber}`}
                    </div>
                    <small className="text-muted">
                      <FaClock className="me-1" />
                      {formatDuration(take.duration)} •{' '}
                      {formatDate(take.createdAt)}
                    </small>
                  </div>
                  <div>
                    <Badge
                      bg={take.partType === 'melody' ? 'primary' : 'secondary'}
                    >
                      {take.partType}
                    </Badge>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>

            {selectedTake && (
              <Form.Group className="mb-3">
                <Form.Label className="text-white">Track Name:</Form.Label>
                <Form.Control
                  type="text"
                  value={trackName}
                  onChange={(e) => setTrackName(e.target.value)}
                  placeholder="Enter track name"
                  className="bg-dark text-white"
                />
              </Form.Group>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="bg-dark">
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleImport}
          disabled={!selectedTake}
        >
          Import Take
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
