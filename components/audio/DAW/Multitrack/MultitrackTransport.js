'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
// Sentinel used when instruments don't return a preview handle
const NO_TOKEN = Symbol('no_token');
import { Button, ButtonGroup, ProgressBar } from 'react-bootstrap';
import {
  FaPlay,
  FaPause,
  FaStop,
  FaStepBackward,
  FaStepForward,
  FaVolumeUp,
  FaVolumeMute,
} from 'react-icons/fa';
import { MdPiano } from 'react-icons/md';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import Metronome from './Metronome';
import PianoKeyboard from './PianoKeyboard';

export default function MultitrackTransport({
  showPiano: showPianoProp,
  setShowPiano: setShowPianoProp,
}) {
  const {
    play,
    pause,
    stop,
    seek,
    isPlaying,
    currentTime,
    duration,
    tracks,
    selectedTrackId,
    playNoteOnSelectedTrack,
    stopNoteOnSelectedTrack,
    addNoteToSelectedTrack,
  } = useMultitrack();

  const [masterVolume, setMasterVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showPianoState, setShowPianoState] = useState(false);
  const showPiano = showPianoProp ?? showPianoState;
  const setShowPiano = setShowPianoProp ?? setShowPianoState;
  const [activeNotes, setActiveNotes] = useState([]);
  const previewTokensRef = useRef(new Map()); // note -> token

  // Ref to track previous isPlaying state for edge-triggered cleanup
  const prevIsPlayingRef = useRef(isPlaying);

  const activeNotesRef = useRef(new Set());
  useEffect(() => {
    activeNotesRef.current = new Set(activeNotes);
  }, [activeNotes]);

  // Live capture (seconds → beats) while armed & playing
  const liveNotesRef = useRef(new Map()); // note -> { startSec, velocity }
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle progress bar click
  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const progress = x / width;
    seek(progress);
  };

  // Handle piano key presses: preview always; record when armed & playing
  const handlePianoNote = (note, action) => {
    const selectedMidiTrack = tracks.find(
      (t) => t.id === selectedTrackId && t.type === 'midi',
    );

    if (!selectedMidiTrack) {
      console.warn('⚠️ No MIDI track selected!');
      return;
    }

    const tempo = selectedMidiTrack.midiData?.tempo || 120;
    const secPerBeat = 60 / tempo;
    const velocity = 0.85; // 0..1 for context

    // Record while transport is running; don't depend on per-track isRecording
    const armedAndRolling = isPlayingRef.current || showPiano;
    console.log('[Transport Piano]', {
      armedAndRolling,
      tempo,
      selectedTrackId,
    });

    if (action === 'down') {
      // Ensure UI highlight updates reliably without stale closure
      setActiveNotes((prev) => (prev.includes(note) ? prev : [...prev, note]));

      // Prevent double-attacks by guarding on existing preview token
      if (!previewTokensRef.current.has(note)) {
        try {
          const token = playNoteOnSelectedTrack(note, velocity);
          previewTokensRef.current.set(note, token ?? NO_TOKEN);
        } catch {}
      }

      // Start live capture (seconds + high-res wall clock) if armed & playing
      if (armedAndRolling) {
        liveNotesRef.current.set(note, {
          startSec: currentTimeRef.current,
          startWall: performance.now(),
          velocity,
        });
      }
    } else if (action === 'up') {
      const stored = previewTokensRef.current.get(note);
      try {
        if (stored && stored !== NO_TOKEN) {
          stopNoteOnSelectedTrack(note, stored);
        } else {
          // No handle from instrument → use single-arg stop to ensure a gate-off
          stopNoteOnSelectedTrack(note);
        }
      } catch {}
      previewTokensRef.current.delete(note);
      setActiveNotes((prev) => prev.filter((n) => n !== note));

      // Finish capture → convert to beats and write
      const live = liveNotesRef.current.get(note);
      if (
        armedAndRolling &&
        live &&
        typeof addNoteToSelectedTrack === 'function'
      ) {
        const durationSec = live.startWall
          ? Math.max(0, (performance.now() - live.startWall) / 1000)
          : Math.max(0, currentTimeRef.current - live.startSec);
        if (durationSec > 0.04) {
          // ignore ultra-taps
          const startBeat = live.startSec / secPerBeat;
          const durationBeats = durationSec / secPerBeat;
          addNoteToSelectedTrack(note, live.velocity, startBeat, durationBeats);
        }
        liveNotesRef.current.delete(note);
      }
    }
  };
  useEffect(() => {
    const wasPlaying = prevIsPlayingRef.current;
    prevIsPlayingRef.current = isPlaying;

    // Only clear when we actually transition from playing to stopped
    if (wasPlaying && !isPlaying) {
      const snapshot = Array.from(activeNotesRef.current);
      snapshot.forEach((n) => {
        const t = previewTokensRef.current.get(n);
        try {
          if (t && t !== NO_TOKEN) {
            stopNoteOnSelectedTrack(n, t);
          } else {
            stopNoteOnSelectedTrack(n);
          }
        } catch {}
      });
      previewTokensRef.current.clear();
      setActiveNotes([]);
      liveNotesRef.current.clear();
    }
  }, [isPlaying, stopNoteOnSelectedTrack]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Only handle if not typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (isPlaying) {
            pause();
          } else {
            play();
          }
          break;
        case 'Enter':
          e.preventDefault();
          stop();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying, play, pause, stop]);

  // Update volume on all tracks when master volume changes
  useEffect(() => {
    // This would typically be handled by a master gain node
    // For now, we'll just log the change
    console.log('Master volume:', masterVolume);
  }, [masterVolume]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const selectedMidiTrack = tracks.find(
    (t) => t.id === selectedTrackId && t.type === 'midi',
  );

  // Debug: Log when selected track changes
  useEffect(() => {
    console.log('🎯 Selected track changed:', {
      selectedTrackId,
      selectedMidiTrack: selectedMidiTrack
        ? {
            id: selectedMidiTrack.id,
            name: selectedMidiTrack.name,
            type: selectedMidiTrack.type,
          }
        : null,
    });
  }, [selectedTrackId, selectedMidiTrack]);
  return (
    <>
      {/* Piano Keyboard Section - Outside and above transport */}
      {showPiano && selectedMidiTrack && (
        <div className="piano-keyboard-section">
          <div className="piano-keyboard-wrapper">
            <div className="piano-keyboard-info">
              <small>
                Playing on: <strong>{selectedMidiTrack.name}</strong>
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
              height={100}
              onNoteClick={handlePianoNote}
              captureComputerKeyboard={true}
            />
          </div>
        </div>
      )}

      {/* Transport Controls */}
      <div className="multitrack-transport d-flex align-items-center gap-3">
        {/* Transport Controls */}
        <ButtonGroup>
          <Button
            size="sm"
            variant={isPlaying ? 'warning' : 'primary'}
            onClick={isPlaying ? pause : play}
            disabled={tracks.length === 0}
          >
            {isPlaying ? <FaPause /> : <FaPlay />}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={stop}
            disabled={tracks.length === 0}
          >
            <FaStop />
          </Button>
        </ButtonGroup>

        {/* Progress Bar */}
        <div className="flex-grow-1 d-flex align-items-center gap-2">
          <span className="time-display">{formatTime(currentTime)}</span>
          <div
            className="progress flex-grow-1"
            style={{ height: '6px', cursor: 'pointer' }}
            onClick={handleSeek}
          >
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <span className="time-display">{formatTime(duration)}</span>
        </div>

        {/* Metronome */}
        <Metronome tempo={120} />

        {/* Piano Toggle */}
        <Button
          size="sm"
          variant={showPiano ? 'primary' : 'outline-secondary'}
          onClick={() => {
            console.log('🎹 Piano toggle clicked');
            setShowPiano(!showPiano);
          }}
          title={
            selectedMidiTrack
              ? `Virtual piano for ${selectedMidiTrack.name}`
              : 'Select a MIDI track first'
          }
          disabled={!selectedMidiTrack}
        >
          <MdPiano /> Piano
        </Button>

        {/* Master Volume */}
        <div className="d-flex align-items-center gap-2">
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
          </Button>
          <input
            type="range"
            className="form-range"
            style={{ width: '100px' }}
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
          />
        </div>

        {/* Track Info */}
        <div className="track-info">
          <small className="text-muted">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''}
          </small>
        </div>
      </div>
    </>
  );
}
