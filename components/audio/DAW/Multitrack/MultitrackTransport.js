// components/audio/DAW/Multitrack/MultitrackTransport.js
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, ButtonGroup, Form, ProgressBar } from 'react-bootstrap';
import {
  FaPlay,
  FaPause,
  FaStop,
  FaRecordVinyl,
  FaUndo,
  FaRedo,
  FaVolumeMute,
  FaVolumeUp,
} from 'react-icons/fa';
import { BsZoomIn, BsZoomOut } from 'react-icons/bs';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

export default function MultitrackTransport() {
  const {
    isPlaying,
    play,
    pause,
    stop,
    currentTime,
    duration,
    tracks = [], // Default to empty array
    seek,
  } = useMultitrack();

  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Update master volume for all tracks
  useEffect(() => {
    tracks.forEach((track) => {
      if (track && track.wavesurferInstance) {
        const effectiveVolume = isMuted ? 0 : volume * (track.volume || 1);
        try {
          track.wavesurferInstance.setVolume(effectiveVolume);
        } catch (err) {
          console.error(`Error setting volume for track ${track.id}:`, err);
        }
      }
    });
  }, [volume, isMuted, tracks]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  const handlePlayPause = useCallback(() => {
    if (!tracks || tracks.length === 0) {
      console.warn('No tracks available to play');
      return;
    }

    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause, tracks]);

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  const handleSeek = useCallback(
    (e) => {
      const progressBar = e.currentTarget;
      const clickX = e.nativeEvent.offsetX;
      const width = progressBar.offsetWidth;
      const progress = clickX / width;
      seek(progress);
    },
    [seek],
  );

  const handleVolumeChange = useCallback((e) => {
    setVolume(parseFloat(e.target.value));
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted]);

  const trackCount = tracks ? tracks.length : 0;
  const hasAudioTracks =
    tracks && tracks.some((track) => track && track.audioURL);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="multitrack-transport p-3 bg-dark text-white">
      <div className="d-flex align-items-center gap-3">
        {/* Main Transport */}
        <ButtonGroup>
          <Button
            variant={isPlaying ? 'warning' : 'primary'}
            onClick={handlePlayPause}
            disabled={trackCount === 0 || !hasAudioTracks}
            title={
              trackCount === 0
                ? 'Add tracks to enable playback'
                : isPlaying
                  ? 'Pause'
                  : 'Play'
            }
          >
            {isPlaying ? <FaPause /> : <FaPlay />}
          </Button>
          <Button
            variant="secondary"
            onClick={handleStop}
            disabled={trackCount === 0}
          >
            <FaStop />
          </Button>
        </ButtonGroup>

        {/* Progress Bar and Time */}
        <div className="flex-grow-1">
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="time-display">{formatTime(currentTime)}</span>
            <ProgressBar
              className="flex-grow-1"
              style={{ height: '8px', cursor: 'pointer' }}
              now={progress}
              onClick={handleSeek}
            />
            <span className="time-display">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Master Volume */}
        <div className="d-flex align-items-center gap-2">
          <Button
            size="sm"
            variant={isMuted ? 'danger' : 'outline-secondary'}
            onClick={toggleMute}
          >
            {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
          </Button>
          <Form.Range
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            min={0}
            max={1}
            step={0.01}
            style={{ width: '100px' }}
            disabled={isMuted}
          />
        </div>

        {/* Track Info */}
        <div className="track-info text-muted">
          {trackCount === 0 ? (
            <small>No tracks</small>
          ) : (
            <small>
              {trackCount} track{trackCount !== 1 ? 's' : ''}
              {!hasAudioTracks && ' (no audio)'}
            </small>
          )}
        </div>
      </div>
    </div>
  );
}
