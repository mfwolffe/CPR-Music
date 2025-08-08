// components/audio/DAW/Multitrack/PianoRollEditor.js
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, ButtonGroup, Dropdown } from 'react-bootstrap';
import { 
  FaTimes, FaPencilAlt, FaMousePointer, FaEraser, 
  FaMagnet, FaUndo, FaRedo, FaPlay, FaPause,
  FaSave, FaTrash
} from 'react-icons/fa';
import PianoRollCanvas from './PianoRollCanvas';
import PianoRollKeyboard from './PianoRollKeyboard';

export default function PianoRollEditor({
  show,
  onHide,
  notes: initialNotes = [],
  onSave,
  instrument,
  trackName = 'MIDI Track',
  isPlaying = false,
  currentTime = 0,
  tempo = 120
}) {
  // Editor state
  const [notes, setNotes] = useState(initialNotes);
  const [currentTool, setCurrentTool] = useState('pencil'); // pencil, select, eraser, velocity
  const [snapValue, setSnapValue] = useState(1/8); // Grid snap value in beats
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const [zoom, setZoom] = useState({ x: 150, y: 1 }); // Increased default x zoom from 100 to 150
  const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 });
  const [activeNote, setActiveNote] = useState(null); // For preview
  const [hasChanges, setHasChanges] = useState(false);
  
  // History for undo/redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Refs
  const canvasContainerRef = useRef(null);
  const keyboardRef = useRef(null);
  
  // Initialize notes when modal opens or initialNotes change
  useEffect(() => {
    if (show) {
      setNotes(initialNotes);
      setHistory([initialNotes]);
      setHistoryIndex(0);
      setHasChanges(false);
      setSelectedNotes(new Set());
    }
  }, [show, initialNotes]);
  
  // Handle tool selection
  const handleToolChange = (tool) => {
    setCurrentTool(tool);
    if (tool !== 'select') {
      setSelectedNotes(new Set());
    }
  };
  
  // Handle snap value change
  const getSnapLabel = (value) => {
    if (value === 0) return 'Off';
    const denominator = Math.round(1 / value);
    return `1/${denominator}`;
  };
  
  // Save state to history
  const saveToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...notes]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [notes, history, historyIndex]);
  
  // Undo/Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevNotes = history[historyIndex - 1];
      setNotes(prevNotes);
      setHistoryIndex(historyIndex - 1);
      setHasChanges(true);
    }
  };
  
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextNotes = history[historyIndex + 1];
      setNotes(nextNotes);
      setHistoryIndex(historyIndex + 1);
      setHasChanges(true);
    }
  };
  
  // Handle note updates from canvas
  const handleNotesUpdate = (updatedNotes) => {
    saveToHistory();
    setNotes(updatedNotes);
    setHasChanges(true);
  };
  
  // Clear all notes
  const handleClear = () => {
    if (notes.length > 0 && window.confirm('Clear all notes?')) {
      handleNotesUpdate([]);
    }
  };
  
  // Save and close
  const handleSave = () => {
    if (onSave) {
      onSave(notes);
    }
    onHide();
  };
  
  // Close without saving
  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Close without saving?')) {
        onHide();
      }
    } else {
      onHide();
    }
  };
  
  // Keyboard shortcuts
  useEffect(() => {
    if (!show) return;
    
    const handleKeyDown = (e) => {
      // Tool shortcuts
      if (e.key === '1') handleToolChange('select');
      else if (e.key === '2') handleToolChange('pencil');
      else if (e.key === '3') handleToolChange('eraser');
      else if (e.key === '4') handleToolChange('velocity');
      
      // Undo/Redo
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
      
      // Save
      else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      
      // Select all
      else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedNotes(new Set(notes.map(n => n.id)));
      }
      
      // Delete selected
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNotes.size > 0) {
        e.preventDefault();
        const newNotes = notes.filter(n => !selectedNotes.has(n.id));
        handleNotesUpdate(newNotes);
        setSelectedNotes(new Set());
      }
      
      // Close on Escape
      else if (e.key === 'Escape') {
        handleClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [show, currentTool, notes, selectedNotes, hasChanges]);
  
  return (
    <Modal 
      show={show} 
      onHide={handleClose}
      size="xl"
      fullscreen="lg-down"
      className="piano-roll-modal"
      backdrop="static"
    >
      <Modal.Header className="piano-roll-header">
        <div className="d-flex align-items-center gap-3 w-100">
          {/* Track name */}
          <h5 className="mb-0">{trackName} - Piano Roll</h5>
          
          {/* Tool selection */}
          <ButtonGroup size="sm">
            <Button 
              variant={currentTool === 'select' ? 'primary' : 'secondary'}
              onClick={() => handleToolChange('select')}
              title="Select Tool (1)"
            >
              <FaMousePointer />
            </Button>
            <Button 
              variant={currentTool === 'pencil' ? 'primary' : 'secondary'}
              onClick={() => handleToolChange('pencil')}
              title="Pencil Tool (2)"
            >
              <FaPencilAlt />
            </Button>
            <Button 
              variant={currentTool === 'eraser' ? 'primary' : 'secondary'}
              onClick={() => handleToolChange('eraser')}
              title="Eraser Tool (3)"
            >
              <FaEraser />
            </Button>
          </ButtonGroup>
          
          {/* Snap controls */}
          <div className="d-flex align-items-center gap-2">
            <FaMagnet />
            <Dropdown>
              <Dropdown.Toggle size="sm" variant="secondary">
                {getSnapLabel(snapValue)}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => setSnapValue(0)}>Off</Dropdown.Item>
                <Dropdown.Item onClick={() => setSnapValue(1)}>1/1</Dropdown.Item>
                <Dropdown.Item onClick={() => setSnapValue(1/2)}>1/2</Dropdown.Item>
                <Dropdown.Item onClick={() => setSnapValue(1/4)}>1/4</Dropdown.Item>
                <Dropdown.Item onClick={() => setSnapValue(1/8)}>1/8</Dropdown.Item>
                <Dropdown.Item onClick={() => setSnapValue(1/16)}>1/16</Dropdown.Item>
                <Dropdown.Item onClick={() => setSnapValue(1/32)}>1/32</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
          
          {/* Undo/Redo */}
          <ButtonGroup size="sm">
            <Button 
              variant="secondary" 
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title="Undo (Ctrl+Z)"
            >
              <FaUndo />
            </Button>
            <Button 
              variant="secondary" 
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Redo (Ctrl+Y)"
            >
              <FaRedo />
            </Button>
          </ButtonGroup>
          
          {/* Clear button */}
          <Button
            size="sm"
            variant="outline-danger"
            onClick={handleClear}
            disabled={notes.length === 0}
            title="Clear all notes"
          >
            <FaTrash />
          </Button>
          
          {/* Zoom controls */}
          <div className="ms-auto d-flex align-items-center gap-2">
            <label className="d-flex align-items-center gap-2">
              <span>Zoom:</span>
              <input
                type="range"
                min="50"
                max="300"
                value={zoom.x}
                onChange={(e) => setZoom({ ...zoom, x: parseInt(e.target.value) })}
                className="form-range"
                style={{ width: '100px' }}
              />
            </label>
          </div>
          
          {/* Playback indicator */}
          {isPlaying && (
            <div className="d-flex align-items-center gap-2 text-success">
              <FaPlay />
              <span>{currentTime.toFixed(2)}s</span>
            </div>
          )}
          
          {/* Save indicator */}
          {hasChanges && (
            <span className="text-warning">• Unsaved</span>
          )}
        </div>
      </Modal.Header>
      
      <Modal.Body className="piano-roll-body p-0">
        <div className="piano-roll-content">
          {/* Piano keyboard */}
          <div className="piano-roll-keyboard-container">
            <PianoRollKeyboard
              ref={keyboardRef}
              scrollOffset={scrollOffset}
              zoom={zoom}
              activeNote={activeNote}
              onNoteClick={(note) => {
                // Play note preview
                console.log('Preview note:', note);
              }}
            />
          </div>
          
          {/* Piano roll canvas */}
          <div 
            ref={canvasContainerRef}
            className="piano-roll-canvas-container"
            onScroll={(e) => {
              setScrollOffset({
                x: e.target.scrollLeft,
                y: e.target.scrollTop
              });
            }}
          >
            <PianoRollCanvas
              notes={notes}
              onNotesUpdate={handleNotesUpdate}
              currentTool={currentTool}
              snapValue={snapValue}
              selectedNotes={selectedNotes}
              onSelectedNotesChange={setSelectedNotes}
              zoom={zoom}
              scrollOffset={scrollOffset}
              onScrollOffsetChange={setScrollOffset}
              isPlaying={isPlaying}
              currentTime={currentTime}
              tempo={tempo}
              instrument={instrument}
              canvasSize={{ width: 2000, height: 88 * 20 }} // 88 keys * 20px per key
            />
          </div>
        </div>
        
        {/* Velocity lane */}
        <div className="velocity-lane">
          <canvas
            width={2000}
            height={60}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </Modal.Body>
      
      <Modal.Footer className="piano-roll-header">
        <div className="d-flex justify-content-between align-items-center w-100">
          <div className="text-white-50">
            <small>
              {notes.length} notes • 
              {selectedNotes.size > 0 && ` ${selectedNotes.size} selected`}
            </small>
          </div>
          <div>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleSave}
              className="ms-2"
              disabled={!hasChanges}
            >
              <FaSave className="me-1" />
              Save Changes
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
}