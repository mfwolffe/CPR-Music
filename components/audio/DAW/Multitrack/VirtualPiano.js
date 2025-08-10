// components/audio/DAW/Multitrack/VirtualPiano.js
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Modal, Button, ButtonGroup, Badge } from 'react-bootstrap';
import { FaCircle, FaStop, FaClock } from 'react-icons/fa';
import { MdPiano } from 'react-icons/md';
import PianoKeyboard from './PianoKeyboard';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

export default function VirtualPiano({ show, onHide }) {
  const {
    tracks,
    selectedTrackId,
    isPlaying,
    currentTime,
    playNoteOnSelectedTrack,
    stopNoteOnSelectedTrack,
    updateTrack,
  } = useMultitrack();

  // State
  const [activeNotes, setActiveNotes] = useState([]);
  const [quantizeValue, setQuantizeValue] = useState(0); // 0 = off, 0.25 = 1/16, 0.5 = 1/8, 1 = 1/4
  const [noteCount, setNoteCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  // Refs for tracking notes in progress
  const notesInProgressRef = useRef(new Map()); // note -> noteData
  const recordingStartTimeRef = useRef(null);
  const lastNoteIdRef = useRef(0);

  // Get selected MIDI track
  const selectedTrack = tracks.find(
    (t) => t.id === selectedTrackId && t.type === 'midi',
  );
  const tempo = selectedTrack?.midiData?.tempo || 120;

  // Update recording state when playback starts/stops
  useEffect(() => {
    setIsRecording(isPlaying && selectedTrack !== undefined);

    if (isPlaying && !recordingStartTimeRef.current) {
      recordingStartTimeRef.current = currentTime;
    } else if (!isPlaying) {
      // Clean up any notes that were held when playback stopped
      handlePlaybackStopped();
      recordingStartTimeRef.current = null;
    }
  }, [isPlaying, selectedTrack]);

  // Convert current time to beat position
  const convertTimeToBeat = useCallback(
    (timeInSeconds) => {
      const secondsPerBeat = 60 / tempo;
      return timeInSeconds / secondsPerBeat;
    },
    [tempo],
  );

  // Quantize a beat position if quantization is enabled
  const quantizeBeat = useCallback(
    (beat) => {
      if (quantizeValue === 0) return beat;
      return Math.round(beat / quantizeValue) * quantizeValue;
    },
    [quantizeValue],
  );

  // Generate unique note ID
  const generateNoteId = useCallback(() => {
    lastNoteIdRef.current += 1;
    return `vp-note-${Date.now()}-${lastNoteIdRef.current}`;
  }, []);

  // Add a completed note to the track
  const addNoteToTrack = useCallback(
    (noteData) => {
      if (!selectedTrack) return;

      // Ensure minimum duration
      const minDuration = 0.125; // 1/32 note
      if (noteData.duration < minDuration) {
        noteData.duration = minDuration;
      }

      // Debug logging
      console.log('🎹 VirtualPiano: Adding note to track', {
        trackId: selectedTrack.id,
        trackName: selectedTrack.name,
        noteData: noteData,
        existingNotes: selectedTrack.midiData?.notes?.length || 0,
        midiData: selectedTrack.midiData,
      });

      // Create the updated notes array
      const existingNotes = selectedTrack.midiData?.notes || [];
      const updatedNotes = [...existingNotes, noteData];

      // Update the track
      updateTrack(selectedTrack.id, {
        midiData: {
          ...selectedTrack.midiData,
          notes: updatedNotes,
        },
      });

      console.log('🎹 VirtualPiano: After update call', {
        updatedNotesLength: updatedNotes.length,
      });

      setNoteCount((prev) => prev + 1);
    },
    [selectedTrack, updateTrack],
  );

  // Handle when playback is stopped with notes still held
  const handlePlaybackStopped = useCallback(() => {
    notesInProgressRef.current.forEach((noteData, note) => {
      // Finalize any held notes
      const endBeat = convertTimeToBeat(currentTime);
      noteData.duration = Math.max(0.125, endBeat - noteData.startTime);
      addNoteToTrack(noteData);

      // Make sure to stop the sound
      stopNoteOnSelectedTrack(note);
    });

    notesInProgressRef.current.clear();
    setActiveNotes([]);
  }, [currentTime, convertTimeToBeat, addNoteToTrack, stopNoteOnSelectedTrack]);

  // Main note event handler
  const handleNoteClick = useCallback(
    (note, type) => {
      if (!selectedTrack) {
        console.warn('No MIDI track selected');
        return;
      }

      if (type === 'down') {
        // Always play the note sound
        playNoteOnSelectedTrack(note, 100);
        setActiveNotes((prev) => [...prev, note]);

        // If recording (playing), start tracking this note
        if (isRecording && isPlaying) {
          const beatPosition = convertTimeToBeat(currentTime);
          const quantizedBeat = quantizeBeat(beatPosition);

          const noteData = {
            id: generateNoteId(),
            note: note,
            velocity: 100,
            startTime: quantizedBeat,
            duration: 0, // Will be set on note up
          };

          notesInProgressRef.current.set(note, noteData);
          console.log(
            `Recording note ${note} at beat ${quantizedBeat.toFixed(3)}`,
          );
        }
      } else if (type === 'up') {
        // Always stop the note sound
        stopNoteOnSelectedTrack(note);
        setActiveNotes((prev) => prev.filter((n) => n !== note));

        // If we were recording this note, finalize it
        if (isRecording && notesInProgressRef.current.has(note)) {
          const noteData = notesInProgressRef.current.get(note);
          const endBeat = convertTimeToBeat(currentTime);
          const quantizedEndBeat =
            quantizeValue > 0 ? quantizeBeat(endBeat) : endBeat;

          // Calculate duration
          noteData.duration = Math.max(
            0.125,
            quantizedEndBeat - noteData.startTime,
          );

          console.log(`🎹 VirtualPiano: Finalizing note ${note}`, {
            startBeat: noteData.startTime,
            endBeat: quantizedEndBeat,
            duration: noteData.duration,
            noteData: noteData,
          });

          // Add to track
          addNoteToTrack(noteData);
          notesInProgressRef.current.delete(note);
        }
      }
    },
    [
      selectedTrack,
      playNoteOnSelectedTrack,
      stopNoteOnSelectedTrack,
      isRecording,
      isPlaying,
      currentTime,
      convertTimeToBeat,
      quantizeBeat,
      generateNoteId,
      addNoteToTrack,
    ],
  );

  // Handle modal close
  const handleClose = useCallback(() => {
    // Stop all active notes
    activeNotes.forEach((note) => {
      stopNoteOnSelectedTrack(note);
    });
    setActiveNotes([]);

    // Clear any notes in progress
    notesInProgressRef.current.clear();

    onHide();
  }, [activeNotes, stopNoteOnSelectedTrack, onHide]);

  // Reset note count when track changes
  useEffect(() => {
    setNoteCount(0);
  }, [selectedTrackId]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e) => {
      // Number keys 1-5 for quantization
      if (e.key >= '1' && e.key <= '5') {
        const quantizeMap = {
          1: 0, // Off
          2: 1, // 1/4
          3: 0.5, // 1/8
          4: 0.25, // 1/16
          5: 0.125, // 1/32
        };
        setQuantizeValue(quantizeMap[e.key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [show]);

  // Calculate current measure and beat
  const getCurrentPosition = () => {
    const beat = convertTimeToBeat(currentTime);
    const measure = Math.floor(beat / 4) + 1;
    const beatInMeasure = (beat % 4) + 1;
    return `${measure}:${beatInMeasure.toFixed(1)}`;
  };

  // Debug: Log selected track details
  useEffect(() => {
    if (selectedTrack) {
      console.log('🔍 VirtualPiano: Selected track details', {
        id: selectedTrack.id,
        name: selectedTrack.name,
        type: selectedTrack.type,
        hasMidiData: !!selectedTrack.midiData,
        notesArray: selectedTrack.midiData?.notes,
        notesLength: selectedTrack.midiData?.notes?.length || 0,
        fullTrack: selectedTrack,
      });
    }
  }, [selectedTrack]);

  useEffect(() => {
    const midiTrack = tracks.find(
      (t) => t.id === selectedTrackId && t.type === 'midi',
    );
    if (midiTrack) {
      console.log('🔄 VirtualPiano: Track updated', {
        trackId: midiTrack.id,
        notesLength: midiTrack.midiData?.notes?.length || 0,
        notes: midiTrack.midiData?.notes,
      });
    }
  }, [tracks, selectedTrackId]);

  return (
    <Modal
      show={show}
      onHide={handleClose}
      size="lg"
      backdrop="static"
      keyboard={true}
      className="virtual-piano-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          <MdPiano size={24} />
          Virtual Piano - {selectedTrack?.name || 'No MIDI Track Selected'}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {/* Status Bar */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-3">
            {/* Recording Status */}
            <div className="d-flex align-items-center gap-2">
              {isRecording ? (
                <>
                  <FaCircle className="text-danger blink" size={12} />
                  <span className="text-danger fw-bold">RECORDING</span>
                </>
              ) : isPlaying ? (
                <>
                  <FaCircle className="text-success" size={12} />
                  <span className="text-success">Playing (not recording)</span>
                </>
              ) : (
                <>
                  <FaStop className="text-secondary" size={12} />
                  <span className="text-secondary">Ready</span>
                </>
              )}
            </div>

            {/* Position Display */}
            {isPlaying && (
              <Badge bg="dark" className="d-flex align-items-center gap-1">
                <FaClock size={10} />
                {getCurrentPosition()}
              </Badge>
            )}

            {/* Note Counter */}
            {isRecording && noteCount > 0 && (
              <Badge bg="info">
                {noteCount} note{noteCount !== 1 ? 's' : ''} recorded
              </Badge>
            )}
          </div>

          {/* Quantization Controls */}
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted small">Quantize:</span>
            <ButtonGroup size="sm">
              <Button
                variant={quantizeValue === 0 ? 'primary' : 'outline-secondary'}
                onClick={() => setQuantizeValue(0)}
                title="No quantization (1)"
              >
                Off
              </Button>
              <Button
                variant={quantizeValue === 1 ? 'primary' : 'outline-secondary'}
                onClick={() => setQuantizeValue(1)}
                title="1/4 note (2)"
              >
                1/4
              </Button>
              <Button
                variant={
                  quantizeValue === 0.5 ? 'primary' : 'outline-secondary'
                }
                onClick={() => setQuantizeValue(0.5)}
                title="1/8 note (3)"
              >
                1/8
              </Button>
              <Button
                variant={
                  quantizeValue === 0.25 ? 'primary' : 'outline-secondary'
                }
                onClick={() => setQuantizeValue(0.25)}
                title="1/16 note (4)"
              >
                1/16
              </Button>
              <Button
                variant={
                  quantizeValue === 0.125 ? 'primary' : 'outline-secondary'
                }
                onClick={() => setQuantizeValue(0.125)}
                title="1/32 note (5)"
              >
                1/32
              </Button>
            </ButtonGroup>
          </div>
        </div>

        {/* Piano Keyboard */}
        <div className="piano-container">
          {selectedTrack ? (
            <PianoKeyboard
              startNote={36} // C2
              endNote={84} // C6
              activeNotes={activeNotes}
              onNoteClick={handleNoteClick}
              width={740}
              height={140}
              showNoteNames={true}
            />
          ) : (
            <div className="text-center py-5 text-muted">
              <MdPiano size={48} className="mb-3" />
              <p>Please select a MIDI track to use the virtual piano</p>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-3 text-muted small">
          <p className="mb-1">
            <strong>Tips:</strong> Click and drag across keys to play
            glissandos. Press number keys 1-5 to change quantization.
          </p>
          {isPlaying && !isRecording && selectedTrack && (
            <p className="mb-0 text-warning">
              ⚠️ Playback is active but not recording - notes will play but
              won't be saved to the track.
            </p>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className="d-flex justify-content-between align-items-center w-100">
          <div className="text-muted small">
            {selectedTrack && `${tempo} BPM`}
          </div>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
