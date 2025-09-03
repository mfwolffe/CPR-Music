// components/audio/DAW/Multitrack/Track.js
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button, Form, ButtonGroup, ProgressBar, Alert } from 'react-bootstrap';
import {
  FaTrash,
  FaFileImport,
  FaVolumeUp,
  FaVolumeMute,
  FaCircle,
} from 'react-icons/fa';
import { MdPanTool } from 'react-icons/md';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import TrackClipCanvas from '../../../../contexts/TrackClipCanvas';
import ClipPlayer from './ClipPlayer';
import audioContextManager from './AudioContextManager';
import { decodeAudioFromURL } from './AudioEngine';
import waveformCache from './WaveformCache';
import { getAudioProcessor } from './AudioProcessor';

export default function Track({ track, index, zoomLevel = 100 }) {
  const {
    updateTrack,
    removeTrack,
    setSelectedTrackId,
    selectedTrackId,
    soloTrackId,
    setSoloTrackId,
    duration,
    currentTime,
    isPlaying,
  } = useMultitrack();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingState, setLoadingState] = useState('idle'); // 'idle', 'reading', 'decoding', 'generating-waveform', 'complete', 'error'
  const [processingMethod, setProcessingMethod] = useState('unknown'); // 'worker', 'main-thread', 'unknown'
  const fileInputRef = useRef(null);
  const clipPlayerRef = useRef(null);
  const [controlTab, setControlTab] = useState('vol'); // 'vol' | 'pan'
  const [isDragOver, setIsDragOver] = useState(false);

  // Resume audio context if needed
  const resumeAudioContextIfNeeded = async () => {
    const ctx = audioContextManager.getContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  };

  // Initialize clip player
  useEffect(() => {
    const initPlayer = async () => {
      try {
        const audioContext = audioContextManager.getContext();
        clipPlayerRef.current = new ClipPlayer(audioContext);
      } catch (error) {
        console.error('Error initializing clip player:', error);
      }
    };

    initPlayer();

    return () => {
      if (clipPlayerRef.current) {
        clipPlayerRef.current.dispose();
      }
    };
  }, []);

  // Update clips when they change
  useEffect(() => {
    const updateClips = async () => {
      if (!clipPlayerRef.current || !track.clips) return;

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
        resumeAudioContextIfNeeded().then(() => {
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

  // Cleanup audio processor on unmount
  useEffect(() => {
    return () => {
      // Note: We use a singleton, so we don't dispose it here
      // It will be cleaned up when the app unmounts
    };
  }, []);

  // Progress update helper
  const updateLoadingProgress = (state, progress) => {
    setLoadingState(state);
    setLoadingProgress(progress);
    console.log(`🔄 Loading ${state}: ${Math.round(progress)}%`);
  };

  // Handle file import - Hybrid Worker/Fallback approach
  const processAudioFile = async (file) => {
    if (!file || !file.type.startsWith('audio/')) return;

    setIsLoading(true);
    setProcessingMethod('unknown');
    updateLoadingProgress('reading', 0);
    
    let clipId = null;
    const audioProcessor = getAudioProcessor();

    try {
      const url = URL.createObjectURL(file);
      updateLoadingProgress('reading', 10);

      // Phase 1: Create immediate placeholder clip
      clipId = `clip-${track.id}-${Date.now()}`;
      const placeholderClip = {
        id: clipId,
        start: 0,
        duration: 0, // Will update when processed
        color: track.color || '#7bafd4',
        src: url,
        offset: 0,
        name: file.name.replace(/\.[^/.]+$/, ''),
        isLoading: true,
        loadingState: 'reading'
      };

      // Immediately add track with placeholder - UI stays responsive!
      updateTrack(track.id, {
        audioURL: url,
        clips: [placeholderClip]
      });

      // Phase 2: Process with hybrid approach (Worker or Main Thread)
      const result = await audioProcessor.processAudioFile(
        url,
        clipId,
        (stage, progress) => {
          updateLoadingProgress(stage, progress);
          
          // Update clip loading state in real-time
          updateTrack(track.id, (prevTrack) => ({
            ...prevTrack,
            clips: prevTrack.clips.map(clip =>
              clip.id === clipId
                ? { ...clip, loadingState: stage }
                : clip
            )
          }));
        }
      );

      // Set processing method indicator
      setProcessingMethod(result.method);
      console.log(`🔧 Audio processed using: ${result.method}`);

      // Phase 3: Update clip with final data
      const finalClip = {
        ...placeholderClip,
        duration: result.duration,
        isLoading: false,
        loadingState: 'complete',
        processingMethod: result.method
      };

      updateTrack(track.id, {
        clips: [finalClip]
      });

      updateLoadingProgress('complete', 100);

      // Phase 4: Cache peaks if not already cached by worker
      if (result.peaks) {
        // Store peaks in cache for immediate use
        console.log(`✅ Peaks ready (${result.peaks.length} samples)`);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err) {
      console.error('Error importing file:', err);
      updateLoadingProgress('error', 100);
      
      // Update clip to show error state
      if (clipId) {
        updateTrack(track.id, (prevTrack) => ({
          ...prevTrack,
          clips: prevTrack.clips.map(clip => 
            clip.id === clipId 
              ? { ...clip, isLoading: false, loadingState: 'error', hasError: true }
              : clip
          )
        }));
      }
    } finally {
      // Keep loading indicators for a moment to show completion
      setTimeout(() => {
        setIsLoading(false);
        setLoadingProgress(0);
        setLoadingState('idle');
        setProcessingMethod('unknown');
      }, 1500);
    }
  };

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    await processAudioFile(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('audio/')) {
        await processAudioFile(file);
      }
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
    <div className="track-container" style={{ display: 'flex' }}>
      {/* Sidebar spacer - matches timeline sidebar */}
      <div
        className="track-sidebar"
        style={{
          width: '80px',
          backgroundColor: '#1e1e1e',
          borderRight: '1px solid #3a3a3a',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Track number */}
        <span style={{ color: '#666', fontSize: '14px', fontWeight: 'bold' }}>
          {index + 1}
        </span>
      </div>

      {/* Main track div */}
      <div
        className={`track ${isSelected ? 'track-selected' : ''} ${
          track.type === 'recording' ? 'recording-track' : ''
        } ${track.type === 'audio' ? 'audio-track' : ''}`}
        onClick={() => setSelectedTrackId(track.id)}
        style={{ display: 'flex', flex: 1 }}
      >
        {/* Track Controls - fixed width matching timeline */}
        <div
          className="track-controls"
          style={{
            width: '200px',
            flexShrink: 0,
            backgroundColor: '#232323',
            borderRight: '1px solid #444',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div className="track-header">
            <Form.Control
              type="text"
              value={track.name}
              onChange={(e) => updateTrack(track.id, { name: e.target.value })}
              className="track-name-input"
              onClick={(e) => e.stopPropagation()}
              style={{ marginBottom: '8px' }}
            />
          </div>

          {/* Audio Controls - Stacked Vertically */}
          {/* Vol/Pan toggle like MIDI */}
          <ButtonGroup
            size="sm"
            className="control-tabs"
            style={{ marginBottom: 4 }}
          >
            <Button
              variant={controlTab === 'vol' ? 'secondary' : 'outline-secondary'}
              onClick={(e) => {
                e.stopPropagation();
                setControlTab('vol');
              }}
            >
              Vol
            </Button>
            <Button
              variant={controlTab === 'pan' ? 'secondary' : 'outline-secondary'}
              onClick={(e) => {
                e.stopPropagation();
                setControlTab('pan');
              }}
            >
              Pan
            </Button>
          </ButtonGroup>

          {controlTab === 'vol' ? (
            <div
              className="track-control-row"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <FaVolumeUp size={12} className="control-icon" />
              <input
                type="range"
                className="track-volume-slider"
                min="0"
                max="1"
                step="0.01"
                value={track.volume}
                onChange={handleVolumeChange}
                disabled={track.muted}
                style={{ flex: 1 }}
              />
              <span
                className="control-value"
                style={{ fontSize: '11px', width: 30 }}
              >
                {Math.round(track.volume * 100)}
              </span>
            </div>
          ) : (
            <div
              className="track-control-row"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <MdPanTool size={12} className="control-icon" />
              <input
                type="range"
                className="track-pan-slider"
                min="-1"
                max="1"
                step="0.01"
                value={track.pan}
                onChange={handlePanChange}
                disabled={track.muted}
                style={{ flex: 1 }}
              />
              <span
                className="control-value"
                style={{ fontSize: '11px', width: 30 }}
              >
                {track.pan > 0
                  ? `R${Math.round(track.pan * 100)}`
                  : track.pan < 0
                    ? `L${Math.round(-track.pan * 100)}`
                    : 'C'}
              </span>
            </div>
          )}

          {/* Three-button row like MIDI: Solo / Mute / Record */}
          <div className="track-button-row" style={{ display: 'flex', gap: 4 }}>
            <Button
              variant={isSolo ? 'warning' : 'outline-secondary'}
              size="sm"
              onClick={handleSolo}
              title="Solo"
              style={{ flex: 1 }}
            >
              S
            </Button>
            <Button
              variant={track.muted ? 'danger' : 'outline-secondary'}
              size="sm"
              onClick={handleMute}
              title={track.muted ? 'Unmute' : 'Mute'}
              style={{ flex: 1 }}
            >
              M
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              disabled
              title="Record not available for audio clips"
              style={{ flex: 1 }}
            >
              <FaCircle />
            </Button>
          </div>

          {/* Import and Delete Row - side by side */}
          <div className="track-button-row" style={{ display: 'flex', gap: 4 }}>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              title="Import Audio"
              style={{ flex: 1 }}
            >
              <FaFileImport />
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={handleRemove}
              title="Delete Track"
              style={{ flex: 1 }}
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

        {/* Track Waveform - takes remaining space */}
        <div
          className="track-waveform"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            flex: 1,
            backgroundColor: isDragOver ? '#3a3a3a' : '#2a2a2a',
            position: 'relative',
            overflow: 'hidden',
            border: isDragOver ? '2px dashed #7bafd4' : 'none',
            transition: 'background-color 0.2s, border 0.2s',
          }}
        >
          {isLoading ? (
            <div
              className="waveform-loading"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#666',
                padding: '20px',
                gap: '10px',
              }}
            >
              {/* Loading state indicator */}
              <div style={{ fontSize: '14px', marginBottom: '5px' }}>
                {loadingState === 'reading' && '📖 Reading file...'}
                {loadingState === 'decoding' && '🔧 Decoding audio...'}
                {loadingState === 'generating-peaks' && '🌊 Generating peaks...'}
                {loadingState === 'complete' && '✅ Complete!'}
                {loadingState === 'error' && '❌ Error occurred'}
                {loadingState === 'idle' && 'Processing...'}
              </div>
              
              {/* Processing method indicator */}
              {processingMethod !== 'unknown' && (
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>
                  {processingMethod === 'worker' && '🚀 Web Worker (non-blocking)'}
                  {processingMethod === 'main-thread' && '🔄 Main Thread (progressive)'}
                </div>
              )}
              
              {/* Progress bar */}
              <ProgressBar 
                now={loadingProgress} 
                style={{ width: '200px', height: '8px' }}
                variant={loadingState === 'error' ? 'danger' : 
                        loadingState === 'complete' ? 'success' : 'primary'}
                striped={loadingState !== 'complete' && loadingState !== 'error'}
                animated={loadingState !== 'complete' && loadingState !== 'error'}
              />
              
              {/* Percentage */}
              <small style={{ color: '#888', fontSize: '12px' }}>
                {Math.round(loadingProgress)}%
              </small>
            </div>
          ) : track.clips && track.clips.length > 0 ? (
            <TrackClipCanvas
              track={track}
              clips={track.clips}
              zoomLevel={zoomLevel}
              height={200}
            />
          ) : (
            <div
              className="empty-waveform-state"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: isDragOver ? '#7bafd4' : '#666',
                transition: 'color 0.2s',
              }}
            >
              <FaFileImport size={24} />
              <div>{isDragOver ? 'Drop audio file here' : 'Import or drop audio file'}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
