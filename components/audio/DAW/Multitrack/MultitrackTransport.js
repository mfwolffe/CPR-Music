// components/audio/DAW/Multitrack/MultitrackTransport.js
'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import Metronome from './Metronome';

export default function MultitrackTransport() {
  const {
    play,
    pause,
    stop,
    seek,
    isPlaying,
    currentTime,
    duration,
    tracks,
  } = useMultitrack();

  const [masterVolume, setMasterVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

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

  return (
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
          <div
            className="progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="time-display">{formatTime(duration)}</span>
      </div>

      {/* Metronome */}
      <Metronome tempo={120} />

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
  );
}