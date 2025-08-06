// components/audio/DAW/Multitrack/Track.js
'use client';

import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { Button, Form, Dropdown } from 'react-bootstrap';
import {
  FaTrash,
  FaVolumeMute,
  FaVolumeUp,
  FaFileImport,
} from 'react-icons/fa';
import { MdPanTool } from 'react-icons/md';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

export default function Track({ track, index, zoomLevel = 100 }) {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [waveformReady, setWaveformReady] = useState(false);

  const {
    updateTrack,
    removeTrack,
    selectedTrackId,
    setSelectedTrackId,
    soloTrackId,
    setSoloTrackId,
    activeRegion,
    setActiveRegion,
  } = useMultitrack();

  // Initialize wavesurfer manually
  useEffect(() => {
    if (!containerRef.current || !track.audioURL) return;

    console.log(`Track ${track.id} - Initializing wavesurfer...`);

    // Destroy previous instance if it exists
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }

    // Create new wavesurfer instance
    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 60,
      waveColor: track.color || '#7bafd4',
      progressColor: '#92ce84',
      cursorColor: '#cbb677',
      barWidth: 2,
      barHeight: 0.8,
      barRadius: 3,
      normalize: true,
      interact: true,
      dragToSeek: true,
      minPxPerSec: 50 * (zoomLevel / 100),
      hideScrollbar: false,
      autoCenter: false,
      autoScroll: false,
    });

    wavesurferRef.current = ws;

    // Set up event handlers
    ws.on('ready', () => {
      console.log(`Track ${track.id} - Wavesurfer ready`);
      setWaveformReady(true);
      setIsLoading(false);
      updateTrack(track.id, { wavesurferInstance: ws });
    });

    ws.on('error', (err) => {
      console.error(`Track ${track.id} - Wavesurfer error:`, err);
      setIsLoading(false);
    });

    // Load the audio
    console.log(`Track ${track.id} - Loading audio:`, track.audioURL);
    ws.load(track.audioURL).catch((err) => {
      console.error(`Track ${track.id} - Failed to load audio:`, err);
      setIsLoading(false);
    });

    // Cleanup
    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [track.id, track.audioURL]); // Only recreate when track ID or audio URL changes

  // Initialize regions plugin
  useEffect(() => {
    if (!wavesurferRef.current || !waveformReady) return;

    const ws = wavesurferRef.current;
    const regions = ws.registerPlugin(RegionsPlugin.create());

    let regionCreationEnabled = true;
    let disableDragSelection = null;

    // Enable drag selection initially
    disableDragSelection = regions.enableDragSelection({
      color: 'rgba(155, 115, 215, 0.4)',
    });

    regions.on('region-created', (region) => {
      console.log(`Track ${track.id} - Region created:`, region);

      // Only process if region creation is enabled
      if (!regionCreationEnabled) {
        region.remove();
        return;
      }

      // Remove any existing active region from OTHER tracks
      if (
        activeRegion &&
        activeRegion.trackId !== track.id &&
        activeRegion.instance
      ) {
        try {
          activeRegion.instance.remove();
        } catch (e) {
          console.warn('Could not remove previous region:', e);
        }
      }

      // Set this as the new active region
      setActiveRegion({
        trackId: track.id,
        instance: region,
        start: region.start,
        end: region.end,
      });

      // Disable further region creation on this track
      regionCreationEnabled = false;
      if (disableDragSelection) {
        disableDragSelection();
      }
    });

    regions.on('region-removed', (region) => {
      console.log(`Track ${track.id} - Region removed`);

      // Only clear active region if it's from this track
      if (activeRegion && activeRegion.trackId === track.id) {
        setActiveRegion(null);
      }

      // Re-enable region creation
      regionCreationEnabled = true;
      disableDragSelection = regions.enableDragSelection({
        color: 'rgba(155, 115, 215, 0.4)',
      });
    });

    // Handle clicks on existing regions
    regions.on('region-clicked', (region, e) => {
      e.stopPropagation();
      console.log(`Track ${track.id} - Region clicked:`, region);
    });

    return () => {
      // Cleanup all regions before destroying the plugin
      regions.getRegions().forEach((region) => {
        try {
          region.remove();
        } catch (e) {
          console.warn('Error removing region during cleanup:', e);
        }
      });
      regions.destroy();
    };
  }, [waveformReady, track.id]); // Removed activeRegion from dependencies to prevent loops

  // Update zoom
  useEffect(() => {
    if (wavesurferRef.current && waveformReady) {
      wavesurferRef.current.zoom(50 * (zoomLevel / 100));
    }
  }, [zoomLevel, waveformReady]);

  // Update volume
  useEffect(() => {
    if (wavesurferRef.current && waveformReady) {
      wavesurferRef.current.setVolume(track.muted ? 0 : track.volume);
    }
  }, [track.volume, track.muted, waveformReady]);

  const handleVolumeChange = (e) => {
    updateTrack(track.id, { volume: parseFloat(e.target.value) });
  };

  const handlePanChange = (e) => {
    updateTrack(track.id, { pan: parseFloat(e.target.value) });
  };

  const handleMute = () => {
    updateTrack(track.id, { muted: !track.muted });
  };

  const handleSolo = () => {
    setSoloTrackId(soloTrackId === track.id ? null : track.id);
  };

  const handleFileImport = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('audio/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        updateTrack(track.id, {
          audioURL: e.target.result,
          name: file.name.replace(/\.[^/.]+$/, ''),
        });
      };
      reader.readAsDataURL(file);
    }
    event.target.value = '';
  };

  const isSelected = selectedTrackId === track.id;
  const isSolo = soloTrackId === track.id;

  return (
    <div
      className={`track ${isSelected ? 'track-selected' : ''}`}
      onClick={() => setSelectedTrackId(track.id)}
    >
      {/* Left Side - Track Controls */}
      <div className="track-controls">
        <div className="track-header">
          <Dropdown>
            <Dropdown.Toggle
              size="sm"
              variant="link"
              className="track-menu-btn"
              onClick={(e) => e.stopPropagation()}
            >
              ▼
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => fileInputRef.current?.click()}>
                <FaFileImport /> Import Audio
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item
                onClick={(e) => {
                  e.stopPropagation();
                  removeTrack(track.id);
                }}
                className="text-danger"
              >
                <FaTrash /> Delete Track
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>

          <Form.Control
            type="text"
            value={track.name}
            onChange={(e) => updateTrack(track.id, { name: e.target.value })}
            className="track-name-input"
            onClick={(e) => e.stopPropagation()}
          />

          <Button
            size="sm"
            variant="link"
            className="track-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              removeTrack(track.id);
            }}
          >
            ×
          </Button>
        </div>

        <div className="track-buttons">
          <Button
            size="sm"
            variant={track.muted ? 'warning' : 'outline-secondary'}
            onClick={(e) => {
              e.stopPropagation();
              handleMute();
            }}
            className="track-btn"
          >
            Mute
          </Button>

          <Button
            size="sm"
            variant={isSolo ? 'primary' : 'outline-secondary'}
            onClick={(e) => {
              e.stopPropagation();
              handleSolo();
            }}
            className="track-btn"
          >
            Solo
          </Button>
        </div>

        <div className="track-sliders">
          <div className="slider-group">
            <label>
              <MdPanTool size={12} />
              <Form.Range
                value={track.pan}
                onChange={handlePanChange}
                onClick={(e) => e.stopPropagation()}
                min={-1}
                max={1}
                step={0.01}
                className="track-pan-slider"
              />
            </label>
          </div>

          <div className="slider-group">
            <label>
              {track.muted ? (
                <FaVolumeMute size={12} />
              ) : (
                <FaVolumeUp size={12} />
              )}
              <Form.Range
                value={track.volume}
                onChange={handleVolumeChange}
                onClick={(e) => e.stopPropagation()}
                min={0}
                max={1}
                step={0.01}
                disabled={track.muted}
                className="track-volume-slider"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Right Side - Waveform */}
      <div
        ref={containerRef}
        className="track-waveform"
        style={{
          minHeight: '60px',
          backgroundColor: '#2a2a2a',
          position: 'relative',
        }}
      >
        {/* Loading indicator */}
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#666',
              fontSize: '12px',
            }}
          >
            Loading waveform...
          </div>
        )}

        {/* No audio indicator */}
        {!track.audioURL && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#444',
              fontSize: '12px',
            }}
          >
            No audio loaded
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleFileImport}
      />
    </div>
  );
}
