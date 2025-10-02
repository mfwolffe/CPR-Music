// components/audio/DAW/Multitrack/MultitrackEditor.js
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Button,
  Container,
  Row,
  Col,
  ButtonGroup,
  ToggleButton,
} from 'react-bootstrap';
import {
  FaPlus,
  FaCut,
  FaCopy,
  FaPaste,
  FaUndo,
  FaRedo,
  FaTrash,
  FaFileImport,
  FaDatabase,
  FaMicrophone,
  FaMusic,
  FaKeyboard,
  FaMousePointer,
  FaHandPaper,
  FaMagnet,
} from 'react-icons/fa';
import { RiScissors2Fill } from 'react-icons/ri';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import { Dropdown } from 'react-bootstrap';
import AudioTrack from './AudioTrack';
import MIDITrack from './MIDITrack';
import MultitrackTransport from './MultitrackTransport';
import EffectsPanel from './EffectsPanel';
import EffectSelectionModal from './EffectSelectionModal';
import EffectParametersModal from './EffectParametersModal';
import MultitrackTimeline from './MultitrackTimeline';
import TakesImportModal from './TakesImportModal';
import MultitrackMixdown from './MultitrackMixdown';
import MIDIInputManager from './MIDIInputManager';
import MIDIDeviceSelector from './MIDIDeviceSelector';
import PianoKeyboard from './PianoKeyboard';
import clipClipboard from './ClipClipboard';
import {
  splitClipsAtTime,
  rippleDelete,
  findClipsInRange,
  duplicateClips,
  quantizeClips,
} from './clipOperations';

// Create singleton MIDI manager
const midiInputManager = new MIDIInputManager();
if (typeof window !== 'undefined') window.__midiInputManager = midiInputManager;

export default function MultitrackEditor({ availableTakes: propTakes = [] }) {
  console.log('MultitrackEditor rendering');
  const tracksScrollRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const isSyncingScrollRef = useRef(false);

  const {
    tracks = [],
    addTrack,
    updateTrack,
    removeTrack,
    selectedTrackId,
    setSelectedTrackId,
    selectedClipId,
    setSelectedClipId,
    currentTime,
    duration,
    isPlaying,
    soloTrackId,
    setSoloTrackId,
    // tool & snap controls
    editorTool,
    setEditorTool,
    snapEnabled,
    setSnapEnabled,
    gridSizeSec,
    setGridSizeSec,
    // effects modal system
    setShowEffectSelectionModal,
    setEffectTargetTrackId,
  } = useMultitrack();

  const [showEffectsPanel, setShowEffectsPanel] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showTakesModal, setShowTakesModal] = useState(false);
  // Use propTakes directly instead of state since it's managed by RecordingContext
  const availableTakes = propTakes;
  
  console.log('🎛️ MultitrackEditor: Available takes for modal:', availableTakes);
  const [midiInputActive, setMidiInputActive] = useState(false);
  const [selectedMidiDevice, setSelectedMidiDevice] = useState(null);
  const [showPiano, setShowPiano] = useState(false);
  const [activeNotes, setActiveNotes] = useState([]);
  const pianoNoteHandlerRef = useRef(null);

  // Track undo/redo history
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Get selected track and clips
  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
  const selectedClips =
    selectedTrack?.clips?.filter((c) => c.id === selectedClipId) || [];

  // Handle copy
  const handleCopy = useCallback(() => {
    if (!selectedTrack || selectedClips.length === 0) return;

    clipClipboard.copy(selectedClips, selectedTrack.id);
    console.log('Copied', selectedClips.length, 'clips');
  }, [selectedTrack, selectedClips]);

  // Handle cut
  const handleCut = useCallback(() => {
    if (!selectedTrack || selectedClips.length === 0) return;

    const clipIds = clipClipboard.cut(selectedClips, selectedTrack.id);

    // Remove cut clips
    updateTrack(selectedTrack.id, {
      clips: selectedTrack.clips.filter((c) => !clipIds.includes(c.id)),
    });

    setSelectedClipId(null);
    console.log('Cut', selectedClips.length, 'clips');
  }, [selectedTrack, selectedClips, updateTrack, setSelectedClipId]);

  // Handle paste
  const handlePaste = useCallback(() => {
    if (!selectedTrack || !clipClipboard.hasContent()) return;

    // Paste at current playhead position
    const pastePosition = currentTime;
    const newClips = clipClipboard.paste(pastePosition, selectedTrack.id);

    if (newClips.length > 0) {
      updateTrack(selectedTrack.id, {
        clips: [...(selectedTrack.clips || []), ...newClips],
      });

      // Select first pasted clip
      setSelectedClipId(newClips[0].id);
      console.log('Pasted', newClips.length, 'clips at', pastePosition);
    }
  }, [selectedTrack, currentTime, updateTrack, setSelectedClipId]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (!selectedTrack || !selectedClipId) return;

    updateTrack(selectedTrack.id, {
      clips: selectedTrack.clips.filter((c) => c.id !== selectedClipId),
    });

    setSelectedClipId(null);
  }, [selectedTrack, selectedClipId, updateTrack, setSelectedClipId]);

  // Handle split at playhead
  const handleSplitAtPlayhead = useCallback(() => {
    tracks.forEach((track) => {
      if (!track.clips || track.clips.length === 0) return;

      const newClips = splitClipsAtTime(track.clips, currentTime);
      if (newClips.length > track.clips.length) {
        updateTrack(track.id, { clips: newClips });
      }
    });
  }, [tracks, currentTime, updateTrack]);

  // Handle duplicate
  const handleDuplicate = useCallback(() => {
    if (!selectedTrack || selectedClips.length === 0) return;

    // Find the end of selected clips
    const maxEnd = Math.max(
      ...selectedClips.map((c) => (c.start || 0) + (c.duration || 0)),
    );
    const minStart = Math.min(...selectedClips.map((c) => c.start || 0));
    const offset = maxEnd - minStart;

    const duplicated = duplicateClips(selectedClips, offset);

    updateTrack(selectedTrack.id, {
      clips: [...selectedTrack.clips, ...duplicated],
    });

    // Select first duplicated clip
    if (duplicated.length > 0) {
      setSelectedClipId(duplicated[0].id);
    }
  }, [selectedTrack, selectedClips, updateTrack, setSelectedClipId]);

  // Handle quantize
  const handleQuantize = useCallback(() => {
    if (!selectedTrack || !snapEnabled) return;

    const quantized = quantizeClips(
      selectedClipId
        ? selectedTrack.clips.filter((c) => c.id === selectedClipId)
        : selectedTrack.clips,
      gridSizeSec,
    );

    updateTrack(selectedTrack.id, { clips: quantized });
  }, [selectedTrack, selectedClipId, snapEnabled, gridSizeSec, updateTrack]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Tool shortcuts
      if (e.key === '1') setEditorTool('select');
      if (e.key === '2') setEditorTool('clip');
      if (e.key === '3') setEditorTool('cut');

      // Edit shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        e.preventDefault();
        handleCopy();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'x') {
        e.preventDefault();
        handleCut();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        e.preventDefault();
        handlePaste();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        handleDuplicate();
      }
      if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleSplitAtPlayhead();
      }
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        handleQuantize();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleCopy,
    handleCut,
    handlePaste,
    handleDelete,
    handleDuplicate,
    handleSplitAtPlayhead,
    handleQuantize,
    setEditorTool,
  ]);

  // MIDI setup
  useEffect(() => {
    midiInputManager.addListener('editor', (noteData) => {
      if (midiInputActive && selectedTrackId) {
        const track = tracks.find((t) => t.id === selectedTrackId);
        if (track && track.type === 'midi' && track.isRecording) {
          console.log('MIDI Editor received note:', noteData);
        }
      }
    });

    return () => {
      midiInputManager.removeListener('editor');
    };
  }, [midiInputActive, selectedTrackId, tracks]);

  const handleAddAudioTrack = () => {
    addTrack({ type: 'audio' });
  };

  const handleAddMIDITrack = () => {
    addTrack({
      type: 'midi',
      midiData: { notes: [], tempo: 120 },
      clips: [], // Initialize empty clips array for MIDI tracks
    });
  };


  const handleImportTake = (take) => {
    addTrack({
      type: 'audio',
      name: take.name,
      audioURL: take.audioURL,
      clips: [
        {
          id: `clip-${Date.now()}`,
          start: 0,
          duration: take.duration || 0,
          src: take.audioURL,
          offset: 0,
          color: '#7bafd4',
        },
      ],
    });
  };

  const canPaste = clipClipboard.hasContent();
  const hasSelection = selectedClipId !== null;

  // Update playhead positions for both timeline and tracks
  useEffect(() => {
    // Remove any old playhead elements that might be lingering
    const oldPlayhead = document.getElementById('multitrack-playhead');
    if (oldPlayhead) {
      oldPlayhead.remove();
    }

    const updatePlayheads = () => {
      const timelinePlayhead = document.getElementById(
        'multitrack-timeline-playhead',
      );
      const tracksPlayhead = document.getElementById(
        'multitrack-tracks-playhead',
      );

      // Allow playhead updates during recording even when project duration is 0
      const isAnyTrackRecording = tracks.some(track => track.isRecording);
      if ((!duration || duration === 0) && !isAnyTrackRecording) return;

      // Derive content width from the shared inner container so 1s = 1s across UI
      const inner = document.getElementById('multitrack-tracks-inner');
      // All tracks now use 230px controls for consistency
      const controlsWidth = 230;
      const gutterWidth = 80 + controlsWidth; // sidebar + track controls

      // Calculate consistent pixels per second
      const baseDuration = duration > 0 ? duration : 30;
      const baseTimelineWidth = gutterWidth + 3000 * (zoomLevel / 100);
      const baseContentWidth = baseTimelineWidth - gutterWidth;
      const pixelsPerSecond = baseContentWidth / baseDuration;

      // Playhead position is simply currentTime * pixelsPerSecond (no scaling needed)
      const x = currentTime * pixelsPerSecond;

      if (timelinePlayhead) {
        timelinePlayhead.style.left = `${x}px`;
      }
      if (tracksPlayhead) {
        tracksPlayhead.style.left = `${x}px`;
      }

      // Auto-scroll to keep playhead visible during playback/recording
      if ((isPlaying || isAnyTrackRecording) && tracksScrollRef.current) {
        const scrollContainer = tracksScrollRef.current;
        const scrollLeft = scrollContainer.scrollLeft;
        const containerWidth = scrollContainer.clientWidth;

        // Target: keep playhead at 75% of visible area (matching MIDI track behavior)
        const targetPlayheadPosition = containerWidth * 0.75;
        const playheadPositionInViewport = x - scrollLeft;

        // If playhead is going off screen (past 85%) or too far left (before 65%), scroll to keep it at 75%
        if (playheadPositionInViewport > containerWidth * 0.85 || playheadPositionInViewport < containerWidth * 0.65) {
          const newScrollLeft = Math.max(0, x - targetPlayheadPosition);
          scrollContainer.scrollLeft = newScrollLeft;

          // Sync timeline scroll
          if (timelineScrollRef.current) {
            timelineScrollRef.current.scrollLeft = newScrollLeft;
          }
        }
      }
    };

    updatePlayheads();

    // Update on animation frame if playing OR if any track is recording
    let animationId;
    const isAnyTrackRecording = tracks.some(track => track.isRecording);
    if (isPlaying || isAnyTrackRecording) {
      const animate = () => {
        updatePlayheads();
        animationId = requestAnimationFrame(animate);
      };
      animate();
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [duration, zoomLevel, isPlaying, tracks, currentTime]); // Include tracks to detect recording state changes and currentTime for playhead updates

  return (
    <Container fluid className={`multitrack-editor multitrack-editor-container p-3 ${showPiano ? 'piano-visible' : ''}`}>
      <Row className="mb-3 main-controls-row">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex gap-2 align-items-center controls-left">
              {/* Tool Selection */}
              <ButtonGroup size="sm">
                <ToggleButton
                  id="tool-select"
                  type="radio"
                  variant="outline-secondary"
                  name="tool"
                  value="select"
                  checked={editorTool === 'select'}
                  onChange={(e) => setEditorTool(e.currentTarget.value)}
                  title="Selection Tool (1)"
                >
                  <FaMousePointer />
                </ToggleButton>
                <ToggleButton
                  id="tool-clip"
                  type="radio"
                  variant="outline-secondary"
                  name="tool"
                  value="clip"
                  checked={editorTool === 'clip'}
                  onChange={(e) => setEditorTool(e.currentTarget.value)}
                  title="Clip Tool (2)"
                >
                  <FaHandPaper />
                </ToggleButton>
                <ToggleButton
                  id="tool-cut"
                  type="radio"
                  variant="outline-secondary"
                  name="tool"
                  value="cut"
                  checked={editorTool === 'cut'}
                  onChange={(e) => setEditorTool(e.currentTarget.value)}
                  title="Cut Tool (3)"
                >
                  <RiScissors2Fill />
                </ToggleButton>
              </ButtonGroup>

              {/* Clip Operations */}
              <div className="vr" />
              <ButtonGroup size="sm">
                <Button
                  variant="outline-secondary"
                  onClick={handleCut}
                  disabled={!hasSelection}
                  title="Cut (Cmd/Ctrl+X)"
                >
                  <FaCut />
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={handleCopy}
                  disabled={!hasSelection}
                  title="Copy (Cmd/Ctrl+C)"
                >
                  <FaCopy />
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={handlePaste}
                  disabled={!canPaste}
                  title="Paste (Cmd/Ctrl+V)"
                >
                  <FaPaste />
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={handleDelete}
                  disabled={!hasSelection}
                  title="Delete"
                >
                  <FaTrash />
                </Button>
              </ButtonGroup>

              {/* Snap controls */}
              <div className="vr" />
              <Button
                variant={snapEnabled ? 'secondary' : 'outline-secondary'}
                size="sm"
                onClick={() => setSnapEnabled(!snapEnabled)}
                title="Toggle Snap to Grid"
              >
                <FaMagnet />
              </Button>
              <select
                className="form-select form-select-sm"
                style={{ width: '100px' }}
                value={gridSizeSec}
                onChange={(e) => setGridSizeSec(parseFloat(e.target.value))}
                disabled={!snapEnabled}
              >
                <option value="0.01">1/100</option>
                <option value="0.0625">1/16</option>
                <option value="0.125">1/8</option>
                <option value="0.25">1/4</option>
                <option value="0.5">1/2</option>
                <option value="1">1 bar</option>
              </select>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={handleQuantize}
                disabled={!snapEnabled || !selectedTrack}
                title="Quantize (Q)"
              >
                Q
              </Button>
            </div>

            <div className="d-flex gap-2 controls-right">
              <Dropdown drop="down" align="end">
                <Dropdown.Toggle variant="primary" size="sm">
                  <FaPlus /> Add Track
                </Dropdown.Toggle>
                <Dropdown.Menu renderOnMount={true} popperConfig={{
                  strategy: 'fixed',
                  modifiers: [
                    {
                      name: 'offset',
                      options: {
                        offset: [0, 4],
                      },
                    },
                  ],
                }}>
                  <Dropdown.Item onClick={handleAddAudioTrack}>
                    <FaMicrophone /> Audio Track
                  </Dropdown.Item>
                  <Dropdown.Item onClick={handleAddMIDITrack}>
                    <FaKeyboard /> MIDI Track
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={() => setShowTakesModal(true)}>
                    <FaDatabase /> Import from Takes
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (selectedTrackId) {
                    setEffectTargetTrackId(selectedTrackId);
                    setShowEffectSelectionModal(true);
                  } else {
                    alert('Please select a track first to add effects.');
                  }
                }}
                disabled={!selectedTrackId}
                title={selectedTrackId ? "Add effects to selected track" : "Select a track first"}
              >
                Effects
              </Button>

              <MultitrackMixdown tracks={tracks} />
            </div>
          </div>
        </Col>
      </Row>

      {/* Transport Controls - MOVED TO TOP */}
      <Row className="mb-2">
        <Col>
          <MultitrackTransport 
            showPiano={showPiano}
            setShowPiano={setShowPiano}
            onPianoNoteHandler={(handler) => { pianoNoteHandlerRef.current = handler; }}
            onActiveNotesChange={setActiveNotes}
          />
        </Col>
      </Row>

      {/* Timeline */}
      <Row className="mb-2">
        <Col>
          <MultitrackTimeline
            zoomLevel={zoomLevel}
            scrollRef={timelineScrollRef}
            onScroll={(e) => {
              if (!tracksScrollRef.current) return;
              if (isSyncingScrollRef.current) return;
              isSyncingScrollRef.current = true;
              try {
                tracksScrollRef.current.scrollLeft = e.target.scrollLeft;
              } finally {
                // Allow the reciprocal handler to run without ping-pong loops
                setTimeout(() => {
                  isSyncingScrollRef.current = false;
                }, 0);
              }
            }}
          />
        </Col>
      </Row>

      {/* Tracks */}
      <Row style={{ flex: 1, minHeight: 0 }}>
        <Col style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div
            ref={tracksScrollRef}
            onScroll={(e) => {
              if (!timelineScrollRef.current) return;
              if (isSyncingScrollRef.current) return;
              isSyncingScrollRef.current = true;
              try {
                timelineScrollRef.current.scrollLeft = e.target.scrollLeft;
              } finally {
                setTimeout(() => {
                  isSyncingScrollRef.current = false;
                }, 0);
              }
            }}
            style={{
              overflowX: 'auto',
              overflowY: 'auto',
              position: 'relative',
              paddingBottom: '20px', // minimal space for scrolling
            }}
            className={`tracks-container ${showPiano ? 'piano-visible' : ''}`}
          >
            <div
              id="multitrack-tracks-inner"
              style={(() => {
                // Compute dynamic width and grid size during recording
                const isAnyTrackRecording = tracks.some(t => t.isRecording);
                const baseWidth = 310 + 3000 * (zoomLevel / 100);
                const baseContentWidth = baseWidth - 230; // Subtract controls

                // Calculate baseDuration to include all clip extents (prevents cutoff)
                const maxClipEnd = tracks.reduce((max, track) => {
                  if (!track.clips) return max;
                  const trackEnd = track.clips.reduce((tMax, clip) => {
                    return Math.max(tMax, (clip.start || 0) + (clip.duration || 0));
                  }, 0);
                  return Math.max(max, trackEnd);
                }, 0);
                const baseDuration = Math.max(duration || 30, maxClipEnd, 30);

                // Keep pixels-per-second CONSTANT based on initial base duration
                // This prevents grid from moving during recording
                const pixelsPerSecond = baseContentWidth / baseDuration;

                const effectiveDuration = isAnyTrackRecording
                  ? Math.max(baseDuration, currentTime + 20)
                  : baseDuration;

                // Width = controls + (pixels per second * duration)
                const expandedWidth = 230 + (pixelsPerSecond * effectiveDuration);

                // Calculate grid size based on actual time intervals (1 second per grid)
                // Use the CONSTANT pixelsPerSecond so grid doesn't move
                const gridSizeX = pixelsPerSecond; // 1 second
                const gridSizeY = 20; // Fixed vertical spacing

                return {
                  position: 'relative',
                  minHeight: '600px',
                  width: `${expandedWidth}px`,
                  backgroundImage: `
                    linear-gradient(90deg, rgba(100, 149, 237, 0.1) 1px, transparent 1px),
                    linear-gradient(rgba(100, 149, 237, 0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: `${gridSizeX}px ${gridSizeY}px`
                };
              })()}
            >
              {tracks.map((track, index) => {
                if (track.type === 'midi') {
                  return (
                    <MIDITrack
                      key={track.id}
                      track={track}
                      index={index}
                      zoomLevel={zoomLevel}
                    />
                  );
                } else {
                  // Use enhanced AudioTrack component for both 'audio' and 'recording' types
                  // This provides backward compatibility while consolidating functionality
                  return (
                    <AudioTrack
                      key={track.id}
                      track={track}
                      index={index}
                      zoomLevel={zoomLevel}
                    />
                  );
                }
              })}

              {/* Global playhead that spans all tracks */}
              {tracks.length > 0 && (
                <div
                  id="multitrack-tracks-playhead"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '2px',
                    height: `${tracks.reduce((totalHeight, track) => {
                      // Calculate height based on track type
                      if (track.type === 'midi') {
                        return totalHeight + 240; // MIDI tracks are 240px (from daw-midi.css)
                      } else {
                        // Audio tracks (including legacy 'recording' type) are 200px
                        return totalHeight + 200;
                      }
                    }, 0)}px`,
                    backgroundColor: '#ff3030',
                    boxShadow: '0 0 3px rgba(255, 48, 48, 0.8)',
                    pointerEvents: 'none',
                    zIndex: 1000,
                    marginLeft: '310px', // 80px sidebar + 230px controls
                  }}
                />
              )}
            </div>
          </div>
        </Col>
      </Row>

      {/* Zoom Control */}
      <Row className="mt-3">
        <Col>
          <div className="d-flex align-items-center gap-2">
            <label>Zoom:</label>
            <input
              type="range"
              min="10"
              max="500"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(parseInt(e.target.value))}
              style={{ width: '200px' }}
            />
            <span>{zoomLevel}%</span>

            {/* Zoom presets */}
            <ButtonGroup size="sm" className="ms-3">
              <Button
                variant="outline-secondary"
                onClick={() => setZoomLevel(50)}
              >
                50%
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => setZoomLevel(100)}
              >
                100%
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => setZoomLevel(200)}
              >
                200%
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => setZoomLevel(400)}
              >
                400%
              </Button>
            </ButtonGroup>
          </div>
        </Col>
      </Row>

      {/* MIDI Device Selector */}
      {tracks.some((t) => t.type === 'midi') && (
        <MIDIDeviceSelector
          midiInputManager={midiInputManager}
          selectedDevice={selectedMidiDevice}
          onDeviceSelect={setSelectedMidiDevice}
          isActive={midiInputActive}
          onToggleActive={setMidiInputActive}
        />
      )}

      {/* Modals */}
      <TakesImportModal
        show={showTakesModal}
        onHide={() => setShowTakesModal(false)}
        takes={availableTakes}
        onImport={handleImportTake}
      />

      {showEffectsPanel && (
        <EffectsPanel
          show={showEffectsPanel}
          onHide={() => setShowEffectsPanel(false)}
        />
      )}

      {/* Piano Section - Bottom of Editor */}
      {showPiano && (
        <Row className="mt-3">
          <Col>
            <div className="piano-keyboard-section">
              <div className="piano-keyboard-wrapper">
                <div className="piano-keyboard-info">
                  <small>
                    Playing on: <strong>{tracks.find(t => t.id === selectedTrackId && t.type === 'midi')?.name || 'No MIDI Track Selected'}</strong>
                  </small>
                  <small>
                    Click keys to play • Use Z/X/C… and Q/W/E… on your keyboard
                  </small>
                </div>
                <PianoKeyboard
                  startNote={36} // C2
                  endNote={84} // C6
                  activeNotes={activeNotes}
                  width={800}
                  height={120}
                  onNoteClick={(note, type) => {
                    if (pianoNoteHandlerRef.current) {
                      pianoNoteHandlerRef.current(note, type);
                    }
                  }}
                  captureComputerKeyboard={true}
                />
              </div>
            </div>
          </Col>
        </Row>
      )}

      {/* Effects Modal System */}
      <EffectSelectionModal />
      <EffectParametersModal />
    </Container>
  );
}
