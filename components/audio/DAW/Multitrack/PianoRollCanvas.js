// components/audio/DAW/Multitrack/PianoRollCanvas.js
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

const NOTE_HEIGHT = 20; // Height of each piano key row
const MIN_NOTE = 21; // A0
const MAX_NOTE = 108; // C8
const TOTAL_NOTES = MAX_NOTE - MIN_NOTE + 1;

export default function PianoRollCanvas({
  notes = [],
  selectedNotes,
  onSelectedNotesChange,
  onNotesUpdate,
  currentTool,
  snapValue,
  zoom,
  tempo,
  isPlaying,
  currentTime,
  scrollOffset,
  instrument
}) {
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [mouseState, setMouseState] = useState({
    isDown: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    draggedNote: null,
    dragType: null, // 'move', 'resize-left', 'resize-right'
    originalNotes: null
  });
  
  // Calculate grid dimensions
  const pixelsPerBeat = zoom.x;
  const noteHeight = NOTE_HEIGHT * zoom.y;
  const gridWidth = pixelsPerBeat * 32; // Reduced from 64 to 32 beats (8 bars at 4/4)
  const gridHeight = TOTAL_NOTES * noteHeight;
  
  // Helper functions
  const pixelToTime = (x) => {
    return (x + scrollOffset.x) / pixelsPerBeat;
  };
  
  const timeToPixel = (time) => {
    return time * pixelsPerBeat - scrollOffset.x;
  };
  
  const pixelToNote = (y) => {
    return MAX_NOTE - Math.floor((y + scrollOffset.y) / noteHeight);
  };
  
  const noteToPixel = (note) => {
    return (MAX_NOTE - note) * noteHeight - scrollOffset.y;
  };
  
  const snapToGrid = (time) => {
    if (snapValue === 0) return time;
    return Math.round(time / snapValue) * snapValue;
  };
  
  // Find note at position
  const getNoteAtPosition = (x, y) => {
    const time = pixelToTime(x);
    const pitch = pixelToNote(y);
    
    return notes.find(note => {
      const noteStart = note.startTime;
      const noteEnd = note.startTime + note.duration;
      return note.note === pitch && time >= noteStart && time <= noteEnd;
    });
  };
  
  // Check if near note edge for resizing
  const getNoteEdge = (x, note) => {
    const startX = timeToPixel(note.startTime);
    const endX = timeToPixel(note.startTime + note.duration);
    const edgeThreshold = 5;
    
    if (Math.abs(x - startX) < edgeThreshold) return 'left';
    if (Math.abs(x - endX) < edgeThreshold) return 'right';
    return null;
  };
  
  // Draw grid
  const drawGrid = useCallback((ctx) => {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
    
    // Vertical lines (beats)
    for (let beat = 0; beat < 32; beat++) { // Changed from 64 to 32
      const x = timeToPixel(beat);
      if (x < 0 || x > canvasSize.width) continue;
      
      ctx.strokeStyle = beat % 4 === 0 ? '#444' : '#333';
      ctx.lineWidth = beat % 4 === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasSize.height);
      ctx.stroke();
    }
    
    // Horizontal lines (notes)
    for (let note = MIN_NOTE; note <= MAX_NOTE; note++) {
      const y = noteToPixel(note);
      if (y < -noteHeight || y > canvasSize.height) continue;
      
      const isC = (note % 12) === 0;
      const isBlackKey = [1, 3, 6, 8, 10].includes(note % 12);
      
      // Background for black keys
      if (isBlackKey) {
        ctx.fillStyle = '#252525';
        ctx.fillRect(0, y, canvasSize.width, noteHeight);
      }
      
      // Grid line
      ctx.strokeStyle = isC ? '#444' : '#333';
      ctx.lineWidth = isC ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasSize.width, y);
      ctx.stroke();
    }
  }, [canvasSize, scrollOffset, zoom, pixelsPerBeat, noteHeight]);
  
  // Draw notes
  const drawNotes = useCallback((ctx) => {
    const instrumentColor = instrument?.color || '#92ce84';
    
    notes.forEach(note => {
      const x = timeToPixel(note.startTime);
      const y = noteToPixel(note.note);
      const width = note.duration * pixelsPerBeat;
      const height = noteHeight - 2; // Small gap between notes
      
      // Skip if outside visible area
      if (x + width < 0 || x > canvasSize.width) return;
      if (y + height < 0 || y > canvasSize.height) return;
      
      // Note color based on selection and velocity
      const isSelected = selectedNotes.has(note.id);
      const velocityAlpha = 0.5 + (note.velocity / 127) * 0.5;
      
      // Fill
      ctx.fillStyle = isSelected 
        ? `${instrumentColor}${Math.round(velocityAlpha * 255).toString(16)}`
        : `${instrumentColor}${Math.round(velocityAlpha * 180).toString(16)}`;
      ctx.fillRect(x, y + 1, width, height);
      
      // Border
      ctx.strokeStyle = isSelected ? '#fff' : instrumentColor;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(x, y + 1, width, height);
      
      // Velocity indicator (small bar at bottom)
      const velocityHeight = (note.velocity / 127) * 4;
      ctx.fillStyle = instrumentColor;
      ctx.fillRect(x, y + height - velocityHeight, width, velocityHeight);
    });
  }, [notes, selectedNotes, canvasSize, scrollOffset, zoom, instrument, pixelsPerBeat, noteHeight]);
  
  // Draw selection box
  const drawSelectionBox = useCallback((ctx) => {
    if (currentTool !== 'select' || !mouseState.isDown || mouseState.draggedNote) return;
    
    const x = Math.min(mouseState.startX, mouseState.currentX);
    const y = Math.min(mouseState.startY, mouseState.currentY);
    const width = Math.abs(mouseState.currentX - mouseState.startX);
    const height = Math.abs(mouseState.currentY - mouseState.startY);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);
  }, [currentTool, mouseState]);
  
  // Draw playhead
  const drawPlayhead = useCallback((ctx) => {
    if (!isPlaying) return;
    
    const x = timeToPixel(currentTime);
    if (x < 0 || x > canvasSize.width) return;
    
    ctx.strokeStyle = '#ff3030';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasSize.height);
    ctx.stroke();
  }, [isPlaying, currentTime, canvasSize, scrollOffset, zoom]);
  
  // Main draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    drawGrid(ctx);
    drawNotes(ctx);
    drawSelectionBox(ctx);
    drawPlayhead(ctx);
  }, [drawGrid, drawNotes, drawSelectionBox, drawPlayhead]);
  
  // Handle mouse events
  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMouseState({
      ...mouseState,
      isDown: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y
    });
    
    if (currentTool === 'pencil') {
      const time = snapToGrid(pixelToTime(x));
      const pitch = pixelToNote(y);
      
      // Check if note exists at this position
      const existingNote = notes.find(n => 
        n.note === pitch && 
        time >= n.startTime && 
        time < n.startTime + n.duration
      );
      
      if (existingNote) {
        // Delete existing note
        const newNotes = notes.filter(n => n.id !== existingNote.id);
        onNotesUpdate(newNotes);
      } else {
        // Create new note
        const newNote = {
          id: `note-${Date.now()}-${Math.random()}`,
          note: pitch,
          velocity: 100,
          startTime: time,
          duration: snapValue || 0.25
        };
        onNotesUpdate([...notes, newNote]);
      }
    } else if (currentTool === 'select') {
      const clickedNote = getNoteAtPosition(x, y);
      
      if (clickedNote) {
        const edge = getNoteEdge(x, clickedNote);
        
        if (!e.shiftKey && !selectedNotes.has(clickedNote.id)) {
          onSelectedNotesChange(new Set([clickedNote.id]));
        } else if (e.shiftKey) {
          const newSelection = new Set(selectedNotes);
          if (newSelection.has(clickedNote.id)) {
            newSelection.delete(clickedNote.id);
          } else {
            newSelection.add(clickedNote.id);
          }
          onSelectedNotesChange(newSelection);
        }
        
        setMouseState({
          ...mouseState,
          isDown: true,
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
          draggedNote: clickedNote,
          dragType: edge || 'move',
          originalNotes: [...notes]
        });
      } else {
        // Start selection box
        onSelectedNotesChange(new Set());
      }
    } else if (currentTool === 'eraser') {
      const noteToDelete = getNoteAtPosition(x, y);
      if (noteToDelete) {
        const newNotes = notes.filter(n => n.id !== noteToDelete.id);
        onNotesUpdate(newNotes);
      }
    }
  };
  
  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const canvas = canvasRef.current;
    
    // Update cursor based on tool and position
    if (currentTool === 'select') {
      const note = getNoteAtPosition(x, y);
      if (note) {
        const edge = getNoteEdge(x, note);
        canvas.style.cursor = edge ? 'ew-resize' : 'move';
      } else {
        canvas.style.cursor = 'crosshair';
      }
    } else if (currentTool === 'pencil') {
      canvas.style.cursor = 'crosshair';
    } else if (currentTool === 'eraser') {
      canvas.style.cursor = 'crosshair';
    }
    
    if (!mouseState.isDown) return;
    
    setMouseState({ ...mouseState, currentX: x, currentY: y });
    
    if (currentTool === 'select' && mouseState.draggedNote) {
      // Handle dragging notes
      const deltaTime = pixelToTime(x) - pixelToTime(mouseState.startX);
      const deltaPitch = pixelToNote(y) - pixelToNote(mouseState.startY);
      
      const updatedNotes = mouseState.originalNotes.map(note => {
        if (!selectedNotes.has(note.id)) return note;
        
        if (mouseState.dragType === 'move') {
          return {
            ...note,
            startTime: snapToGrid(note.startTime + deltaTime),
            note: Math.max(MIN_NOTE, Math.min(MAX_NOTE, note.note + deltaPitch))
          };
        } else if (mouseState.dragType === 'resize-left') {
          const newStart = snapToGrid(note.startTime + deltaTime);
          const newDuration = note.duration - (newStart - note.startTime);
          return {
            ...note,
            startTime: newStart,
            duration: Math.max(snapValue || 0.125, newDuration)
          };
        } else if (mouseState.dragType === 'resize-right') {
          return {
            ...note,
            duration: Math.max(snapValue || 0.125, snapToGrid(note.duration + deltaTime))
          };
        }
        return note;
      });
      
      onNotesUpdate(updatedNotes);
    } else if (currentTool === 'select' && !mouseState.draggedNote) {
      // Selection box
      const minX = Math.min(mouseState.startX, x);
      const maxX = Math.max(mouseState.startX, x);
      const minY = Math.min(mouseState.startY, y);
      const maxY = Math.max(mouseState.startY, y);
      
      const boxSelected = new Set();
      notes.forEach(note => {
        const noteX = timeToPixel(note.startTime);
        const noteY = noteToPixel(note.note);
        const noteEndX = timeToPixel(note.startTime + note.duration);
        
        if (noteX < maxX && noteEndX > minX && noteY < maxY && noteY + noteHeight > minY) {
          boxSelected.add(note.id);
        }
      });
      
      onSelectedNotesChange(boxSelected);
    }
  };
  
  const handleMouseUp = () => {
    setMouseState({
      ...mouseState,
      isDown: false,
      draggedNote: null,
      dragType: null,
      originalNotes: null
    });
  };
  
  // Update canvas size
  useEffect(() => {
    const updateSize = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.parentElement.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
  // Redraw on changes
  useEffect(() => {
    draw();
  }, [draw]);
  
  return (
    <div style={{ width: gridWidth, height: gridHeight, position: 'relative' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          position: 'fixed',
          cursor: 'crosshair'
        }}
      />
    </div>
  );
}