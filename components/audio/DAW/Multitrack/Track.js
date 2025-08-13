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
  const regionsPluginRef = useRef(null);

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

  // Guard against missing track prop
  if (!track) {
    console.error('Track component rendered without track prop');
    return null;
  }

  // Initialize wavesurfer manually
  useEffect(() => {
    // Guard against missing track
    if (!track || !track.id) {
      console.error('Track component: Invalid track object', track);
      return;
    }

    if (!containerRef.current || !track.audioURL) return;

    console.log(`Track ${track.id} - Initializing wavesurfer...`);

    // Clear active region if it belongs to this track (since we're recreating wavesurfer)
    if (activeRegion && activeRegion.trackId === track.id) {
      setActiveRegion(null);
    }

    // Destroy previous instance if it exists
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }

    // Create new wavesurfer instance
    // In Track.js, update the wavesurfer creation to use container height
    // Replace the existing WaveSurfer.create call with this:

    // Calculate the actual container height
    const containerHeight = containerRef.current.offsetHeight || 80;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 100, // Match the 100px container height
      waveColor: track.color || '#7bafd4',
      progressColor: '#92ce84',
      cursorColor: '#cbb677',
      barWidth: 2,
      barHeight: 1, // Full height bars
      barRadius: 2,
      barGap: 1,
      normalize: true,
      interact: false,
      dragToSeek: false,
      minPxPerSec: 50 * (zoomLevel / 100),
      hideScrollbar: false,
      autoCenter: false,
      autoScroll: false,
      fillParent: true,
      backend: 'WebAudio',
    });

    wavesurferRef.current = ws;

    // Set up event handlers
    ws.on('ready', () => {
      console.log(`Track ${track.id} - Wavesurfer ready`);
      setWaveformReady(true);
      setIsLoading(false);
      updateTrack(track.id, {
        wavesurferInstance: ws,
        regionsPlugin: null, // Will be set when regions plugin is initialized
      });

      // Update the global duration when track is ready
      const duration = ws.getDuration();
      console.log(`Track ${track.id} - Duration: ${duration}s`);
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
      // Clear active region if it belongs to this track
      if (activeRegion && activeRegion.trackId === track.id) {
        setActiveRegion(null);
      }

      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [track.id, track.audioURL, updateTrack]);

  // Initialize regions plugin
  useEffect(() => {
    if (!wavesurferRef.current || !waveformReady) return;

    const ws = wavesurferRef.current;

    // Clean up any existing regions plugin
    if (regionsPluginRef.current) {
      try {
        regionsPluginRef.current.destroy();
      } catch (e) {
        console.warn('Error destroying regions plugin:', e);
      }
      regionsPluginRef.current = null;
    }

    const regions = ws.registerPlugin(RegionsPlugin.create());
    regionsPluginRef.current = regions;

    // Update track with regions plugin reference
    updateTrack(track.id, { regionsPlugin: regions });

    // Store the drag selection disabler function
    let dragSelectionDisabler = null;

    // Enable drag selection only if this is the selected track
    if (track.id === selectedTrackId) {
      dragSelectionDisabler = regions.enableDragSelection({
        color: 'rgba(155, 115, 215, 0.4)',
      });
    }

    regions.on('region-created', (region) => {
      // Only allow regions on the selected track
      if (track.id !== selectedTrackId) {
        region.remove();
        return;
      }

      console.log(`Track ${track.id} - Region created:`, region);

      setActiveRegion({
        trackId: track.id,
        instance: region,
        start: region.start,
        end: region.end,
      });
    });

    // Handle double-click to remove regions
    regions.on('region-double-clicked', (region) => {
      console.log(`Track ${track.id} - Region double-clicked, removing`);
      region.remove();

      // If this was the active region, clear it
      if (activeRegion && activeRegion.instance === region) {
        setActiveRegion(null);
      }
    });

    regions.on('region-removed', (region) => {
      console.log(`Track ${track.id} - Region removed`);

      // Only clear active region if it matches the removed region
      if (activeRegion && activeRegion.instance === region) {
        setActiveRegion(null);
      }
    });

    // Handle clicks on existing regions
    regions.on('region-clicked', (region, e) => {
      e.stopPropagation();
      console.log(`Track ${track.id} - Region clicked:`, region);
    });

    return () => {
      // Cleanup all regions before destroying the plugin
      if (regionsPluginRef.current) {
        try {
          const allRegions = regionsPluginRef.current.getRegions();
          allRegions.forEach((region) => {
            try {
              region.remove();
            } catch (e) {
              console.warn('Error removing region during cleanup:', e);
            }
          });
          regionsPluginRef.current.destroy();
        } catch (e) {
          console.warn('Error during regions cleanup:', e);
        }
        regionsPluginRef.current = null;
      }
    };
  }, [waveformReady, track.id, setActiveRegion, selectedTrackId, updateTrack]);

  // Enable/disable region creation based on track selection
  useEffect(() => {
    if (!regionsPluginRef.current || !waveformReady) return;

    const regions = regionsPluginRef.current;

    if (track.id === selectedTrackId) {
      // Enable region creation on selected track
      try {
        regions.enableDragSelection({
          color: 'rgba(155, 115, 215, 0.4)',
        });
      } catch (e) {
        console.warn('Could not enable drag selection:', e);
      }
    } else {
      // Clear regions on non-selected tracks
      try {
        const allRegions = regions.getRegions();
        allRegions.forEach((region) => {
          region.remove();
        });
      } catch (e) {
        console.warn('Could not clear regions:', e);
      }
    }
  }, [selectedTrackId, track.id, waveformReady]);

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
      className={`track ${isSelected ? 'track-active' : ''}`}
      onClick={() => setSelectedTrackId(track.id)}
      style={{
        border: isSelected ? '2px solid #ffd700' : '1px solid #444',
        borderRadius: '4px',
        margin: '2px 0',
        padding: '4px',
      }}
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
