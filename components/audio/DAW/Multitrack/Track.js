// components/audio/DAW/Multitrack/UpdatedTrack.js
'use client';

import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Button, Form, Dropdown } from 'react-bootstrap';
import {
  FaTrash,
  FaVolumeMute,
  FaVolumeUp,
  FaFileImport,
} from 'react-icons/fa';
import { MdPanTool } from 'react-icons/md';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import EnhancedTrackClipCanvas from '../../../../contexts/TrackClipCanvas';
import waveformCache from './WaveformCache';

export default function UpdatedTrack({ track, index, zoomLevel = 100 }) {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
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
  } = useMultitrack();

  // Guard against missing track prop
  if (!track) {
    console.error('Track component rendered without track prop');
    return null;
  }

  // Initialize wavesurfer (temporary - will be removed in Phase 2)
  useEffect(() => {
    if (!track || !track.id) {
      console.error('Track component: Invalid track object', track);
      return;
    }

    if (!containerRef.current || !track.audioURL) return;

    console.log(`Track ${track.id} - Initializing wavesurfer (temporary)...`);

    // Clear active region if it belongs to this track
    if (activeRegion && activeRegion.trackId === track.id) {
      setActiveRegion(null);
    }

    // Destroy previous instance if it exists
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }

    // Create temporary wavesurfer instance (hidden)
    const containerHeight = containerRef.current.offsetHeight || 80;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'transparent',
      progressColor: 'transparent',
      cursorColor: 'transparent',
      height: 0, // Hide wavesurfer completely
      interact: false,
      normalize: true,
      backend: 'WebAudio',
    });

    wavesurferRef.current = ws;

    // Load audio
    ws.load(track.audioURL)
      .then(() => {
        console.log(`Track ${track.id} - Audio loaded`);
        setIsLoading(false);

        // Preload waveform peaks for better performance
        if (track.audioURL) {
          waveformCache.preloadURL(track.audioURL).catch((err) => {
            console.warn('Failed to preload waveform:', err);
          });
        }

        // Update track with wavesurfer instance
        updateTrack(track.id, { wavesurferInstance: ws });
      })
      .catch((err) => {
        console.error(`Track ${track.id} - Error loading audio:`, err);
        setIsLoading(false);
      });

    // Cleanup
    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [track.audioURL, track.id]);

  // Handle file import
  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    try {
      const url = URL.createObjectURL(file);

      // Initialize a clip for the new audio
      const clipId = `clip-${track.id}-${Date.now()}`;
      const clips = [
        {
          id: clipId,
          start: 0,
          duration: 0, // Will be updated when audio loads
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

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Error importing file:', err);
      setIsLoading(false);
    }
  };

  // Update clip duration when wavesurfer loads
  useEffect(() => {
    if (!track.wavesurferInstance || !track.clips?.length) return;

    const ws = track.wavesurferInstance;
    const duration = ws.getDuration();

    if (duration > 0 && track.clips[0]?.duration === 0) {
      updateTrack(track.id, {
        clips: track.clips.map((c) => ({
          ...c,
          duration: duration,
        })),
      });
    }
  }, [track.wavesurferInstance, track.clips, track.id, updateTrack]);

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
      className={`track ${isSelected ? 'selected' : ''}`}
      onClick={() => setSelectedTrackId(track.id)}
      style={{
        border: isSelected ? '2px solid #cbb677' : '1px solid #444',
        borderRadius: '8px',
        marginBottom: '10px',
        backgroundColor: '#1a1a1a',
        position: 'relative',
      }}
    >
      {/* Track Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px',
          borderBottom: '1px solid #333',
          gap: '10px',
        }}
      >
        <Form.Control
          type="text"
          value={track.name}
          onChange={(e) => updateTrack(track.id, { name: e.target.value })}
          style={{
            width: '150px',
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            color: '#fff',
          }}
        />

        <Button
          variant={track.muted ? 'danger' : 'secondary'}
          size="sm"
          onClick={handleMute}
          title={track.muted ? 'Unmute' : 'Mute'}
        >
          {track.muted ? <FaVolumeMute /> : <FaVolumeUp />}
        </Button>

        <Button
          variant={isSolo ? 'warning' : 'secondary'}
          size="sm"
          onClick={handleSolo}
          title="Solo"
        >
          S
        </Button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <label style={{ fontSize: '12px', color: '#888' }}>Vol</label>
          <Form.Range
            min="0"
            max="1"
            step="0.01"
            value={track.volume}
            onChange={handleVolumeChange}
            style={{ width: '80px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <MdPanTool size={14} style={{ color: '#888' }} />
          <Form.Range
            min="-1"
            max="1"
            step="0.01"
            value={track.pan}
            onChange={handlePanChange}
            style={{ width: '80px' }}
          />
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '5px' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <FaFileImport />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileImport}
            style={{ display: 'none' }}
          />

          <Button variant="danger" size="sm" onClick={handleRemove}>
            <FaTrash />
          </Button>
        </div>
      </div>

      {/* Waveform Container */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          height: '100px',
          backgroundColor: '#2a2a2a',
          overflow: 'hidden',
        }}
      >
        {/* Hidden wavesurfer container */}
        <div style={{ display: 'none' }} />

        {/* Enhanced clip canvas with waveforms */}
        {track.clips && track.clips.length > 0 && (
          <EnhancedTrackClipCanvas
            track={track}
            zoomLevel={zoomLevel}
            height={100}
          />
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#888',
            }}
          >
            Loading...
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!track.clips || track.clips.length === 0) && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#666',
              textAlign: 'center',
            }}
          >
            <FaFileImport size={24} />
            <div style={{ fontSize: '12px', marginTop: '5px' }}>
              Import audio file
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
