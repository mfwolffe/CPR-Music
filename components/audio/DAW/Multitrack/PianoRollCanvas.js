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
  instrument,
  canvasSize = { width: 2000, height: 88 * 20 },
}) {
  const canvasRef = useRef(null);
  const [actualCanvasSize, setActualCanvasSize] = useState(canvasSize);
  const [mouseState, setMouseState] = useState({
    isDown: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    draggedNote: null,
    dragType: null,
    originalNotes: null,
  });

  // Calculate grid dimensions
  const pixelsPerBeat = zoom.x;
  const noteHeight = NOTE_HEIGHT * zoom.y;
  const gridWidth = Math.max(canvasSize.width, pixelsPerBeat * 64);
  const gridHeight = Math.max(canvasSize.height, TOTAL_NOTES * noteHeight);

  // Update canvas size when zoom changes
  useEffect(() => {
    if (canvasRef.current) {
      const newWidth = Math.max(canvasSize.width, gridWidth);
      const newHeight = Math.max(canvasSize.height, gridHeight);

      canvasRef.current.width = newWidth;
      canvasRef.current.height = newHeight;

      setActualCanvasSize({ width: newWidth, height: newHeight });
    }
  }, [zoom, canvasSize, gridWidth, gridHeight]);

  // Helper functions with bounds checking
  const pixelToTime = (x) => {
    // x is relative to the canvas content; the scroll container provides visual offset.
    return Math.max(0, x / pixelsPerBeat);
  };

  const timeToPixel = (time) => {
    // Draw in absolute coordinates; do not subtract scroll here.
    return time * pixelsPerBeat;
  };

  const pixelToNote = (y) => {
    // y is relative to the canvas content; do not add scroll here.
    const note = MAX_NOTE - Math.floor(y / noteHeight);
    return Math.max(MIN_NOTE, Math.min(MAX_NOTE, note));
  };

  const noteToPixel = (note) => {
    return (MAX_NOTE - note) * noteHeight;
  };

  const snapToGrid = (time) => {
    if (snapValue === 0) return time;
    return Math.round(time / snapValue) * snapValue;
  };

  // Find note at position
  const getNoteAtPosition = (x, y) => {
    const time = pixelToTime(x);
    const pitch = pixelToNote(y);

    return notes.find((note) => {
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
  const drawGrid = useCallback(
    (ctx) => {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 0, actualCanvasSize.width, actualCanvasSize.height);

      // Vertical lines (beats)
      for (let beat = 0; beat < 64; beat++) {
        const x = timeToPixel(beat);
        if (x < 0 || x > actualCanvasSize.width) continue;

        ctx.strokeStyle = beat % 4 === 0 ? '#444' : '#333';
        ctx.lineWidth = beat % 4 === 0 ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, actualCanvasSize.height);
        ctx.stroke();
      }

      // Horizontal lines (notes)
      for (let note = MIN_NOTE; note <= MAX_NOTE; note++) {
        const y = noteToPixel(note);
        if (y < -noteHeight || y > actualCanvasSize.height) continue;

        const isC = note % 12 === 0;
        const isBlackKey = [1, 3, 6, 8, 10].includes(note % 12);

        // Background for black keys
        if (isBlackKey) {
          ctx.fillStyle = '#252525';
          ctx.fillRect(0, y, actualCanvasSize.width, noteHeight);
        }

        // Grid line
        ctx.strokeStyle = isC ? '#444' : '#333';
        ctx.lineWidth = isC ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(actualCanvasSize.width, y);
        ctx.stroke();
      }
    },
    [actualCanvasSize, pixelsPerBeat, noteHeight],
  );

  // Draw notes
  const drawNotes = useCallback(
    (ctx) => {
      const instrumentColor = instrument?.color || '#92ce84';

      notes.forEach((note) => {
        const x = timeToPixel(note.startTime);
        const y = noteToPixel(note.note);
        // Fix: Ensure proper width calculation for note duration
        const width = Math.max(note.duration * pixelsPerBeat, 5); // Minimum 5px width
        const height = noteHeight - 2;

        // Skip if outside visible area
        if (x + width < 0 || x > actualCanvasSize.width) return;
        if (y + height < 0 || y > actualCanvasSize.height) return;

        // Note color based on selection and velocity
        const isSelected = selectedNotes && selectedNotes.has(note.id);
        const velocityAlpha = 0.5 + (note.velocity / 127) * 0.5;

        // Fill
        ctx.fillStyle = isSelected
          ? `${instrumentColor}${Math.round(velocityAlpha * 255)
              .toString(16)
              .padStart(2, '0')}`
          : `${instrumentColor}${Math.round(velocityAlpha * 180)
              .toString(16)
              .padStart(2, '0')}`;
        ctx.fillRect(x, y + 1, width, height);

        // Border
        ctx.strokeStyle = isSelected ? '#fff' : instrumentColor;
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(x, y + 1, width, height);

        // Velocity indicator
        const velocityHeight = (note.velocity / 127) * 4;
        ctx.fillStyle = instrumentColor;
        ctx.fillRect(x, y + height - velocityHeight, width, velocityHeight);
      });
    },
    [
      notes,
      selectedNotes,
      actualCanvasSize,
      instrument,
      pixelsPerBeat,
      noteHeight,
    ],
  );

  // Draw selection box
  const drawSelectionBox = useCallback(
    (ctx) => {
      if (
        currentTool !== 'select' ||
        !mouseState.isDown ||
        mouseState.draggedNote
      )
        return;

      const x = Math.min(mouseState.startX, mouseState.currentX);
      const y = Math.min(mouseState.startY, mouseState.currentY);
      const width = Math.abs(mouseState.currentX - mouseState.startX);
      const height = Math.abs(mouseState.currentY - mouseState.startY);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);
    },
    [currentTool, mouseState],
  );

  // Draw playhead
  const drawPlayhead = useCallback(
    (ctx) => {
      if (!isPlaying) return;
      // currentTime is in seconds; convert to beats for the grid
      const secPerBeat = tempo ? 60 / tempo : 0.5;
      const currentBeat = currentTime / secPerBeat;
      const x = timeToPixel(currentBeat);
      if (x < 0 || x > actualCanvasSize.width) return;

      ctx.strokeStyle = '#ff3030';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, actualCanvasSize.height);
      ctx.stroke();
    },
    [isPlaying, currentTime, actualCanvasSize, tempo],
  );

  // Main draw function with error handling
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      // Clear canvas
      ctx.clearRect(0, 0, actualCanvasSize.width, actualCanvasSize.height);

      // Draw grid
      drawGrid(ctx);

      // Draw notes
      if (notes && notes.length > 0) {
        drawNotes(ctx);
      }

      // Draw selection box
      if (mouseState.isDown && currentTool === 'select') {
        drawSelectionBox(ctx);
      }

      // Draw playhead
      if (isPlaying) {
        drawPlayhead(ctx);
      }
    } catch (error) {
      console.error('Error drawing piano roll:', error);
    }
  }, [
    actualCanvasSize,
    notes,
    mouseState,
    currentTool,
    isPlaying,
    drawGrid,
    drawNotes,
    drawSelectionBox,
    drawPlayhead,
  ]);

  // Draw on every frame
  useEffect(() => {
    const animationFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationFrame);
  }, [draw]);

  // Mouse event handlers
  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMouseState((prev) => ({
      ...prev,
      isDown: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    }));

    if (currentTool === 'pencil') {
      // Add new note with proper default duration
      const time = snapToGrid(pixelToTime(x));
      const pitch = pixelToNote(y);
      const newNote = {
        id: `note-${Date.now()}`,
        note: pitch,
        startTime: time,
        // Default length follows selected grid; if snapping is off, use 1 beat (with tiny floor)
        duration: Math.max(snapValue && snapValue > 0 ? snapValue : 1, 0.0625),
        velocity: 100,
      };
      onNotesUpdate([...notes, newNote]);
    } else if (currentTool === 'select' || currentTool === 'eraser') {
      const clickedNote = getNoteAtPosition(x, y);
      if (clickedNote) {
        if (currentTool === 'eraser') {
          // Remove note
          onNotesUpdate(notes.filter((n) => n.id !== clickedNote.id));
        } else {
          // Select note
          const edge = getNoteEdge(x, clickedNote);
          setMouseState((prev) => ({
            ...prev,
            draggedNote: clickedNote,
            dragType: edge || 'move',
            originalNotes: [...notes],
          }));
        }
      }
    }
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMouseState((prev) => ({ ...prev, currentX: x, currentY: y }));

    // Update cursor based on tool and position
    if (currentTool === 'select') {
      const note = getNoteAtPosition(x, y);
      if (note) {
        const edge = getNoteEdge(x, note);
        canvasRef.current.style.cursor = edge ? 'ew-resize' : 'move';
      } else {
        canvasRef.current.style.cursor = 'crosshair';
      }
    } else if (currentTool === 'pencil') {
      canvasRef.current.style.cursor = 'crosshair';
    } else if (currentTool === 'eraser') {
      canvasRef.current.style.cursor = 'pointer';
    }

    // Handle dragging
    if (
      mouseState.isDown &&
      mouseState.draggedNote &&
      currentTool === 'select'
    ) {
      const draggedNote = mouseState.draggedNote;
      const updatedNotes = [...notes];
      const noteIndex = updatedNotes.findIndex((n) => n.id === draggedNote.id);

      if (noteIndex !== -1) {
        if (mouseState.dragType === 'move') {
          const deltaTime = pixelToTime(x) - pixelToTime(mouseState.startX);
          const deltaPitch = pixelToNote(y) - pixelToNote(mouseState.startY);

          updatedNotes[noteIndex] = {
            ...draggedNote,
            startTime: snapToGrid(draggedNote.startTime + deltaTime),
            note: Math.max(
              MIN_NOTE,
              Math.min(MAX_NOTE, draggedNote.note + deltaPitch),
            ),
          };
        } else if (mouseState.dragType === 'left') {
          const newStartTime = snapToGrid(pixelToTime(x));
          const endTime = draggedNote.startTime + draggedNote.duration;
          const newDuration = Math.max(
            snapValue || 0.125,
            endTime - newStartTime,
          );

          updatedNotes[noteIndex] = {
            ...draggedNote,
            startTime: newStartTime,
            duration: newDuration,
          };
        } else if (mouseState.dragType === 'right') {
          const newEndTime = snapToGrid(pixelToTime(x));
          const newDuration = Math.max(
            snapValue || 0.125,
            newEndTime - draggedNote.startTime,
          );

          updatedNotes[noteIndex] = {
            ...draggedNote,
            duration: newDuration,
          };
        }

        onNotesUpdate(updatedNotes);
      }
    }
  };

  const handleMouseUp = () => {
    setMouseState({
      isDown: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      draggedNote: null,
      dragType: null,
      originalNotes: null,
    });
  };

  const handleMouseLeave = () => {
    if (mouseState.isDown) {
      handleMouseUp();
    }
  };

  // Prevent scroll offset from going out of bounds
  useEffect(() => {
    if (scrollOffset) {
      const maxScrollX = Math.max(0, gridWidth - canvasSize.width);
      const maxScrollY = Math.max(0, gridHeight - canvasSize.height);

      if (
        scrollOffset.x < 0 ||
        scrollOffset.x > maxScrollX ||
        scrollOffset.y < 0 ||
        scrollOffset.y > maxScrollY
      ) {
        console.warn('Scroll offset out of bounds, resetting:', scrollOffset);
      }
    }
  }, [scrollOffset, gridWidth, gridHeight, canvasSize]);

  return (
    <div
      style={{
        width: gridWidth,
        height: gridHeight,
        position: 'relative',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          imageRendering: 'pixelated',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
