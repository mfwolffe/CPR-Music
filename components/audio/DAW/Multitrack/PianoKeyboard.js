// components/audio/DAW/Multitrack/PianoKeyboard.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { MIDIUtils } from './MIDIScheduler';

export default function PianoKeyboard({ 
  startNote = 48, // C3
  endNote = 72,   // C5
  activeNotes = [],
  onNoteClick,
  width = 800,
  height = 120,
  showNoteNames = true
}) {
  const canvasRef = useRef(null);
  const [mouseDownNote, setMouseDownNote] = useState(null);
  
  // Piano key layout
  const blackKeyPattern   = [1, 3, 6, 8, 10];               // C#, D#, F#, G#, A#
  const whiteKeyPattern   = [0, 2, 4, 5, 7, 9, 11];         // C, D, E, F, G, A, B
  const blackKeyPositions = [0.65, 1.35, 2.65, 3.35, 4.35]; // Relative positions
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const whiteKeyWidth  = width / getWhiteKeyCount();
    const blackKeyWidth  = whiteKeyWidth * 0.6;
    const blackKeyHeight = height * 0.65;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw white keys first
    let whiteKeyIndex = 0;
    for (let note = startNote; note <= endNote; note++) {
      const noteClass = note % 12;
      
      if (whiteKeyPattern.includes(noteClass)) {
        const x = whiteKeyIndex * whiteKeyWidth;
        const isActive = activeNotes.includes(note);
        
        // Draw white key
        ctx.fillStyle = isActive ? '#92ce84' : '#ffffff';
        ctx.fillRect(x + 1, 1, whiteKeyWidth - 2, height - 2);
        
        // Draw border
        ctx.strokeStyle = '#333';
        ctx.strokeRect(x, 0, whiteKeyWidth, height);
        
        // Draw note name
        if (showNoteNames && noteClass === 0) { // Only show C notes
          ctx.fillStyle = isActive ? '#fff' : '#666';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            MIDIUtils.MIDIToNote(note), 
            x + whiteKeyWidth / 2, 
            height - 10
          );
        }
        
        whiteKeyIndex++;
      }
    }
    
    // Draw black keys on top
    whiteKeyIndex = 0;
    for (let note = startNote; note <= endNote; note++) {
      const noteClass = note % 12;
      
      if (whiteKeyPattern.includes(noteClass)) {
        whiteKeyIndex++;
      } else if (blackKeyPattern.includes(noteClass)) {
        const octavePosition = Math.floor((note - startNote) / 12) * 7;
        const keyPosition = blackKeyPositions[blackKeyPattern.indexOf(noteClass)];
        const x = (octavePosition + keyPosition) * whiteKeyWidth - blackKeyWidth / 2;
        const isActive = activeNotes.includes(note);
        
        // Draw black key
        ctx.fillStyle = isActive ? '#a2de94' : '#2a2a2a';
        ctx.fillRect(x, 0, blackKeyWidth, blackKeyHeight);
        
        // Draw border
        ctx.strokeStyle = '#111';
        ctx.strokeRect(x, 0, blackKeyWidth, blackKeyHeight);
      }
    }
    
  }, [startNote, endNote, activeNotes, width, height, showNoteNames]);
  
  function getWhiteKeyCount() {
    let count = 0;
    for (let note = startNote; note <= endNote; note++) {
      if (whiteKeyPattern.includes(note % 12)) {
        count++;
      }
    }
    return count;
  }
  
  function getNoteFromPosition(x, y) {
    const whiteKeyWidth = width / getWhiteKeyCount();
    const blackKeyWidth = whiteKeyWidth * 0.6;
    const blackKeyHeight = height * 0.65;
    
    // Check black keys first (they're on top)
    if (y < blackKeyHeight) {
      let whiteKeyIndex = 0;
      for (let note = startNote; note <= endNote; note++) {
        const noteClass = note % 12;
        
        if (whiteKeyPattern.includes(noteClass)) {
          whiteKeyIndex++;
        } else if (blackKeyPattern.includes(noteClass)) {
          const octavePosition = Math.floor((note - startNote) / 12) * 7;
          const keyPosition = blackKeyPositions[blackKeyPattern.indexOf(noteClass)];
          const keyX = (octavePosition + keyPosition) * whiteKeyWidth - blackKeyWidth / 2;
          
          if (x >= keyX && x < keyX + blackKeyWidth) {
            return note;
          }
        }
      }
    }
    
    // Check white keys
    const whiteKeyIndex = Math.floor(x / whiteKeyWidth);
    let currentWhiteKey = 0;
    
    for (let note = startNote; note <= endNote; note++) {
      if (whiteKeyPattern.includes(note % 12)) {
        if (currentWhiteKey === whiteKeyIndex) {
          return note;
        }
        currentWhiteKey++;
      }
    }
    
    return null;
  }
  
  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const note = getNoteFromPosition(x, y);
    
    if (note && onNoteClick) {
      setMouseDownNote(note);
      onNoteClick(note, 'down');
    }
  };
  
  const handleMouseUp = (e) => {
    if (mouseDownNote && onNoteClick) {
      onNoteClick(mouseDownNote, 'up');
      setMouseDownNote(null);
    }
  };
  
  const handleMouseMove = (e) => {
    if (!mouseDownNote) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const note = getNoteFromPosition(x, y);
    
    if (note && note !== mouseDownNote && onNoteClick) {
      onNoteClick(mouseDownNote, 'up');
      onNoteClick(note, 'down');
      setMouseDownNote(note);
    }
  };
  
  const handleMouseLeave = () => {
    if (mouseDownNote && onNoteClick) {
      onNoteClick(mouseDownNote, 'up');
      setMouseDownNote(null);
    }
  };
  
  return (
    <div className="piano-keyboard-container">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          width: '100%',
          maxWidth: `${width}px`,
          height: 'auto'
        }}
      />
    </div>
  );
}