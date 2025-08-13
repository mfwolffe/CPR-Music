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
import Track from './Track';
import RecordingTrack from './RecordingTrack';
import MIDITrack from './MIDITrack';
import MultitrackTransport from './MultitrackTransport';
import EffectsPanel from './EffectsPanel';
import MultitrackTimeline from './MultitrackTimeline';
import TakesImportModal from './TakesImportModal';
import MultitrackMixdown from './MultitrackMixdown';
import MIDIInputManager from './MIDIInputManager';
import MIDIDeviceSelector from './MIDIDeviceSelector';
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

export default function MultitrackEditor({ availableTakes: propTakes = [] }) {
  console.log('MultitrackEditor rendering');

  const {
    tracks = [],
    addTrack,
    updateTrack,
    selectedTrackId,
    selectedClipId,
    setSelectedClipId,
    currentTime,
    // tool & snap controls
    editorTool,
    setEditorTool,
    snapEnabled,
    setSnapEnabled,
    gridSizeSec,
    setGridSizeSec,
  } = useMultitrack();

  const [showEffectsPanel, setShowEffectsPanel] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showTakesModal, setShowTakesModal] = useState(false);
  const [availableTakes] = useState(propTakes);
  const [midiInputActive, setMidiInputActive] = useState(false);
  const [selectedMidiDevice, setSelectedMidiDevice] = useState(null);

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
      selectedClipId ? selectedClips : selectedTrack.clips,
      gridSizeSec,
    );

    updateTrack(selectedTrack.id, { clips: quantized });
  }, [
    selectedTrack,
    selectedClips,
    selectedClipId,
    snapEnabled,
    gridSizeSec,
    updateTrack,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if we're in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const isMeta = e.metaKey || e.ctrlKey;

      if (isMeta && e.key === 'c') {
        e.preventDefault();
        handleCopy();
      } else if (isMeta && e.key === 'x') {
        e.preventDefault();
        handleCut();
      } else if (isMeta && e.key === 'v') {
        e.preventDefault();
        handlePaste();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (isMeta && e.key === 'd') {
        e.preventDefault();
        handleDuplicate();
      } else if (e.key === 's' && !isMeta) {
        e.preventDefault();
        handleSplitAtPlayhead();
      } else if (e.key === 'q' && !isMeta) {
        e.preventDefault();
        handleQuantize();
      } else if (e.key === '1') {
        setEditorTool('select');
      } else if (e.key === '2') {
        setEditorTool('clip');
      } else if (e.key === '3') {
        setEditorTool('cut');
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
    addTrack({ type: 'midi', midiData: { notes: [], tempo: 120 } });
  };

  const handleAddRecordingTrack = () => {
    addTrack({ type: 'recording' });
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

  return (
    <Container fluid className="multitrack-editor p-3">
      <Row className="mb-3">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex gap-2 align-items-center">
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
                  variant="outline-danger"
                  onClick={handleDelete}
                  disabled={!hasSelection}
                  title="Delete (Delete/Backspace)"
                >
                  <FaTrash />
                </Button>
              </ButtonGroup>

              {/* Edit Operations */}
              <div className="vr" />
              <ButtonGroup size="sm">
                <Button
                  variant="outline-secondary"
                  onClick={handleSplitAtPlayhead}
                  title="Split at Playhead (S)"
                >
                  <RiScissors2Fill />
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={handleDuplicate}
                  disabled={!hasSelection}
                  title="Duplicate (Cmd/Ctrl+D)"
                >
                  <FaCopy /> <FaCopy />
                </Button>
              </ButtonGroup>

              {/* Snap Controls */}
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

            <div className="d-flex gap-2">
              <Dropdown>
                <Dropdown.Toggle variant="primary" size="sm">
                  <FaPlus /> Add Track
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={handleAddAudioTrack}>
                    <FaMusic /> Audio Track
                  </Dropdown.Item>
                  <Dropdown.Item onClick={handleAddRecordingTrack}>
                    <FaMicrophone /> Recording Track
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
                onClick={() => setShowEffectsPanel(!showEffectsPanel)}
              >
                Effects
              </Button>

              <MultitrackMixdown tracks={tracks} />
            </div>
          </div>
        </Col>
      </Row>

      {/* Transport */}
      <Row className="mb-3">
        <Col>
          <MultitrackTransport />
        </Col>
      </Row>

      {/* Timeline */}
      <Row className="mb-2">
        <Col>
          <MultitrackTimeline zoomLevel={zoomLevel} />
        </Col>
      </Row>

      {/* Tracks */}
      <Row>
        <Col>
          <div className="tracks-container">
            {tracks.map((track, index) => {
              if (track.type === 'recording') {
                return (
                  <RecordingTrack key={track.id} track={track} index={index} />
                );
              } else if (track.type === 'midi') {
                return <MIDITrack key={track.id} track={track} index={index} />;
              } else {
                return (
                  <Track
                    key={track.id}
                    track={track}
                    index={index}
                    zoomLevel={zoomLevel}
                  />
                );
              }
            })}
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
    </Container>
  );
}
