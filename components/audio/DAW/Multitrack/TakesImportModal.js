// components/audio/DAW/Multitrack/TakesImportModal.js
'use client';

import { useState, useEffect } from 'react';
import { Modal, Button, ListGroup, Form, Badge } from 'react-bootstrap';
import { FaFileAudio, FaClock, FaMusic } from 'react-icons/fa';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

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

  const handleImport = () => {
    if (selectedTake && selectedTake.audioURL) {
      console.log('Importing take:', selectedTake);

      // For blob URLs, we might need to ensure they're still valid
      if (selectedTake.audioURL.startsWith('blob:')) {
        // Check if blob is still accessible
        fetch(selectedTake.audioURL)
          .then((response) => {
            if (response.ok) {
              return response.blob();
            }
            throw new Error('Blob URL expired');
          })
          .then((blob) => {
            // Create a new blob URL to ensure it's fresh
            const newURL = URL.createObjectURL(blob);
            addTrack({
              name: trackName || 'Imported Take',
              audioURL: newURL,
              takeId: selectedTake.id,
            });

            // Reset and close
            setSelectedTake(null);
            setTrackName('');
            onHide();
          })
          .catch((err) => {
            console.error('Error accessing blob:', err);
            alert('This take is no longer available. Please record a new one.');
          });
      } else {
        // For regular URLs, import directly
        addTrack({
          name: trackName || 'Imported Take',
          audioURL: selectedTake.audioURL,
          takeId: selectedTake.id,
        });

        // Reset and close
        setSelectedTake(null);
        setTrackName('');
        onHide();
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
