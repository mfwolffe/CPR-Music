// components/audio/DAW/Multitrack/Track.js
'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Form, Dropdown } from 'react-bootstrap';
import {
  FaTrash,
  FaVolumeMute,
  FaVolumeUp,
  FaFileImport,
} from 'react-icons/fa';
import { MdPanTool } from 'react-icons/md';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import TrackClipCanvas from '../../../../contexts/TrackClipCanvas';
import AudioEngine from './AudioEngine';
import waveformCache from './WaveformCache';
import ClipPlayer from './ClipPlayer';

export default function Track({ track, index, zoomLevel = 100 }) {
  const containerRef = useRef(null);
  const clipPlayerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    updateTrack,
    removeTrack,
    selectedTrackId,
    setSelectedTrackId,
    soloTrackId,
    setSoloTrackId,
    activeRegion,
    setActiveRegion,
    editorTool,
    isPlaying,
    currentTime,
    registerTrackPlayer,
    unregisterTrackPlayer,
  } = useMultitrack();

  // Guard against missing track prop
  if (!track) {
    console.error('Track component rendered without track prop');
    return null;
  }

  // Initialize ClipPlayer
  useEffect(() => {
    if (!track || !track.id) {
      console.error('Track component: Invalid track object', track);
      return;
    }

    console.log(`Track ${track.id} - Initializing ClipPlayer...`);

    const audioContext = AudioEngine.getAudioContext();
    const clipPlayer = new ClipPlayer(audioContext);
    clipPlayerRef.current = clipPlayer;

    // Register with multitrack context
    registerTrackPlayer?.(track.id, clipPlayer);

    // Clear active region if it belongs to this track
    if (activeRegion && activeRegion.trackId === track.id) {
      setActiveRegion(null);
    }

    // Cleanup
    return () => {
      console.log(`Track ${track.id} - Cleaning up ClipPlayer`);
      unregisterTrackPlayer?.(track.id);
      if (clipPlayerRef.current) {
        clipPlayerRef.current.dispose();
        clipPlayerRef.current = null;
      }
    };
  }, [track.id]);

  // Update clips when they change
  useEffect(() => {
    if (!clipPlayerRef.current || !track.clips) return;

    const updateClips = async () => {
      try {
        await clipPlayerRef.current.updateClips(
          track.clips,
          track.muted ? 0 : track.volume,
          track.pan,
        );

        // If we're playing, restart playback to include new clips
        if (isPlaying && clipPlayerRef.current) {
          clipPlayerRef.current.play(currentTime);
        }
      } catch (error) {
        console.error(`Error updating clips for track ${track.id}:`, error);
      }
    };

    updateClips();
  }, [track.clips, track.volume, track.pan, track.muted]);

  // Handle playback state changes
  useEffect(() => {
    if (!clipPlayerRef.current) return;

    if (isPlaying) {
      // Check if we should play this track (solo/mute logic)
      const shouldPlay = soloTrackId ? track.id === soloTrackId : !track.muted;

      if (shouldPlay) {
        resumeAudioContext().then(() => {
          clipPlayerRef.current.play(currentTime);
        });
      }
    } else {
      clipPlayerRef.current.stop();
    }
  }, [isPlaying, currentTime, track.id, track.muted, soloTrackId]);

  // Handle seek
  useEffect(() => {
    if (!clipPlayerRef.current || isPlaying) return;
    clipPlayerRef.current.seek(currentTime);
  }, [currentTime, isPlaying]);

  // Handle volume changes
  useEffect(() => {
    if (!clipPlayerRef.current) return;
    clipPlayerRef.current.setVolume(track.muted ? 0 : track.volume);
  }, [track.volume, track.muted]);

  // Handle pan changes
  useEffect(() => {
    if (!clipPlayerRef.current) return;
    clipPlayerRef.current.setPan(track.pan);
  }, [track.pan]);

  // Handle file import
  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    try {
      const url = URL.createObjectURL(file);

      // Decode to get duration
      const audioBuffer = await decodeAudioFromURL(url);
      const duration = audioBuffer ? audioBuffer.duration : 0;

      // Initialize a clip for the new audio
      const clipId = `clip-${track.id}-${Date.now()}`;
      const clips = [
        {
          id: clipId,
          start: 0,
          duration: duration,
          color: track.color || '#7bafd4',
          src: url,
          offset: 0,
          name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        },
      ];

      updateTrack(track.id, {
        audioURL: url,
        clips: clips,
      });

      // Preload waveform peaks
      waveformCache.preloadURL(url).catch((err) => {
        console.warn('Failed to preload waveform:', err);
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error importing file:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVolumeChange = (e) => {
    const volume = parseFloat(e.target.value);
    updateTrack(track.id, { volume });
  };

  const handlePanChange = (e) => {
    const pan = parseFloat(e.target.value);
    updateTrack(track.id, { pan });
  };

  const handleMute = () => {
    updateTrack(track.id, { muted: !track.muted });
  };

  const handleSolo = () => {
    setSoloTrackId(soloTrackId === track.id ? null : track.id);
  };

  const handleRemove = () => {
    if (window.confirm('Remove this track?')) {
      removeTrack(track.id);
    }
  };

  const isSelected = selectedTrackId === track.id;
  const isSolo = soloTrackId === track.id;

  return (
    <div
      className={`track ${isSelected ? 'track-selected' : ''} ${
        track.type === 'recording' ? 'recording-track' : ''
      }`}
      onClick={() => setSelectedTrackId(track.id)}
    >
      {/* Left Side - Track Controls */}
      <div className="track-controls">
        <div className="track-header">
          <Form.Control
            type="text"
            value={track.name}
            onChange={(e) => updateTrack(track.id, { name: e.target.value })}
            className="track-name-input"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Audio Controls - Stacked Vertically */}
        <div className="track-audio-controls">
          {/* Volume */}
          <div className="track-control-row">
            <FaVolumeUp size={12} className="control-icon" />
            <input
              type="range"
              className="track-volume-slider"
              min="0"
              max="1"
              step="0.01"
              value={track.volume}
              onChange={(e) =>
                updateTrack(track.id, { volume: parseFloat(e.target.value) })
              }
              disabled={track.muted}
            />
            <span className="control-value">
              {Math.round(track.volume * 100)}
            </span>
          </div>

          {/* Pan */}
          <div className="track-control-row">
            <MdPanTool size={12} className="control-icon" />
            <input
              type="range"
              className="track-pan-slider"
              min="-1"
              max="1"
              step="0.01"
              value={track.pan}
              onChange={(e) =>
                updateTrack(track.id, { pan: parseFloat(e.target.value) })
              }
              disabled={track.muted}
            />
            <span className="control-value">
              {track.pan > 0
                ? `R${Math.round(track.pan * 100)}`
                : track.pan < 0
                  ? `L${Math.round(-track.pan * 100)}`
                  : 'C'}
            </span>
          </div>
        </div>

        {/* Action Buttons - Stacked */}
        <div className="track-action-buttons">
          <div className="track-button-row">
            <Button
              variant={
                soloTrackId === track.id ? 'warning' : 'outline-secondary'
              }
              size="sm"
              onClick={() =>
                setSoloTrackId(soloTrackId === track.id ? null : track.id)
              }
              title="Solo"
            >
              S
            </Button>
            <Button
              variant={track.muted ? 'danger' : 'outline-secondary'}
              size="sm"
              onClick={() => updateTrack(track.id, { muted: !track.muted })}
              title={track.muted ? 'Unmute' : 'Mute'}
            >
              M
            </Button>
          </div>

          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="w-100"
            title="Import Audio"
          >
            <FaFileImport />
          </Button>

          <Button
            variant="outline-danger"
            size="sm"
            onClick={() => removeTrack(track.id)}
            className="w-100"
            title="Delete Track"
          >
            <FaTrash />
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileImport}
          style={{ display: 'none' }}
        />
      </div>

      {/* Right Side - Waveform */}
      <div className="track-waveform">
        {isLoading ? (
          <div className="waveform-loading">Loading...</div>
        ) : track.clips && track.clips.length > 0 ? (
          <TrackClipCanvas
            track={track}
            clips={track.clips}
            zoomLevel={zoomLevel}
            height={120}
          />
        ) : (
          <div className="empty-waveform-state">
            <FaFileImport size={24} />
            <div>Import audio file</div>
          </div>
        )}
      </div>
    </div>
  );
}
