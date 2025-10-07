// components/audio/DAW/Multitrack/AudioTrack.js
'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { Button, Form, ButtonGroup, ProgressBar } from 'react-bootstrap';
import {
  FaCircle,
  FaStop,
  FaFileImport,
  FaTrash,
} from 'react-icons/fa';
import { MdPanTool } from 'react-icons/md';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import RecordingManager from './recording/RecordingManager';
import LiveWaveformVisualizer from './recording/LiveWaveformVisualizer';
import TrackClipCanvas from '../../../../contexts/TrackClipCanvas';
import ClipPlayer from './ClipPlayer';
import audioContextManager from './AudioContextManager';
import { decodeAudioFromURL } from './AudioEngine';
import waveformCache from './WaveformCache';
import { getAudioProcessor } from './AudioProcessor';

function AudioTrack({ track, index, zoomLevel = 100 }) {
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
    getTransportTime,
    startRecordingTimer,
    stopRecordingTimer,
  } = useMultitrack();

  // State for media stream and UI
  const [mediaStream, setMediaStream] = useState(null);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [countdownValue, setCountdownValue] = useState(0);
  const [controlTab, setControlTab] = useState('vol'); // 'vol' | 'pan'

  // Advanced import state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingState, setLoadingState] = useState('idle');
  const [processingMethod, setProcessingMethod] = useState('unknown');
  const [isDragOver, setIsDragOver] = useState(false);

  // Refs
  const fileInputRef = useRef(null);
  const clipPlayerRef = useRef(null);

  // Use track.isRecording as single source of truth
  const isRecording = track.isRecording || false;

  // Initialize media stream
  useEffect(() => {
    let stream = null;
    let mounted = true;

    const initMediaStream = async () => {
      try {
        console.log(`🎤 AudioTrack: Initializing media stream for track ${track.id}`);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
            sampleRate: 48000,
            latency: 0
          }
        });

        if (mounted) {
          setMediaStream(stream);
          console.log(`🎤 AudioTrack: Media stream ready for track ${track.id}`);
        }
      } catch (error) {
        console.error(`🎤 AudioTrack: Error accessing microphone:`, error);
      }
    };

    initMediaStream();

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        console.log(`🎤 AudioTrack: Media stream stopped for track ${track.id}`);
      }
    };
  }, [track.id]);

  // Subscribe to RecordingManager events
  useEffect(() => {
    const handleCountdownStart = ({ trackId, countdown }) => {
      if (trackId === track.id) {
        setIsCountingIn(true);
        setCountdownValue(countdown);
        console.log(`🎤 AudioTrack: Countdown started for track ${track.id}`);
      }
    };

    const handleCountdownUpdate = ({ trackId, value }) => {
      if (trackId === track.id) {
        setCountdownValue(value);
      }
    };

    const handleCountdownComplete = ({ trackId }) => {
      if (trackId === track.id) {
        setIsCountingIn(false);
        setCountdownValue(0);
        console.log(`🎤 AudioTrack: Countdown complete for track ${track.id}`);
      }
    };

    const handleRecordingStart = ({ trackId, type }) => {
      if (trackId === track.id && type === 'audio') {
        console.log(`🎤 AudioTrack: Recording started for track ${track.id}`);
        // Start the recording timer to advance playhead
        startRecordingTimer();

        // Update track state
        updateTrack(track.id, {
          isRecording: true,
          recordingStartPosition: getTransportTime ? getTransportTime() : 0
        });
      }
    };

    const handleRecordingStop = ({ trackId, type }) => {
      if (trackId === track.id && type === 'audio') {
        console.log(`🎤 AudioTrack: Recording stopped for track ${track.id}`);
        // Stop the recording timer
        stopRecordingTimer();

        // Update track state
        updateTrack(track.id, {
          isRecording: false
        });
      }
    };

    const handleRecordingComplete = (data) => {
      if (data.trackId === track.id) {
        console.log(`🎤 AudioTrack: Recording complete for track ${track.id}`, {
          duration: data.duration,
          startPosition: data.startPosition
        });

        // Add the recorded clip to the track
        if (data.audioURL && data.duration > 0) {
          const newClip = {
            id: `clip-${track.id}-${Date.now()}`,
            start: data.startPosition || 0,
            duration: data.duration,
            color: track.color || '#ff6b6b',
            src: data.audioURL,
            offset: 0,
            name: `Recording ${new Date().toLocaleTimeString()}`
          };

          updateTrack(track.id, {
            audioURL: data.audioURL,
            clips: [...(track.clips || []), newClip]
          });
        }
      }
    };

    // Subscribe to events
    RecordingManager.on('countdown-start', handleCountdownStart);
    RecordingManager.on('countdown-update', handleCountdownUpdate);
    RecordingManager.on('countdown-complete', handleCountdownComplete);
    RecordingManager.on('recording-start', handleRecordingStart);
    RecordingManager.on('recording-stop', handleRecordingStop);
    RecordingManager.on('audio-recording-complete', handleRecordingComplete);

    // Cleanup
    return () => {
      RecordingManager.off('countdown-start', handleCountdownStart);
      RecordingManager.off('countdown-update', handleCountdownUpdate);
      RecordingManager.off('countdown-complete', handleCountdownComplete);
      RecordingManager.off('recording-start', handleRecordingStart);
      RecordingManager.off('recording-stop', handleRecordingStop);
      RecordingManager.off('audio-recording-complete', handleRecordingComplete);
    };
  }, [track.id, updateTrack, startRecordingTimer, stopRecordingTimer, getTransportTime]);

  // Handle record button click
  const handleRecord = async () => {
    console.log(`🎤 AudioTrack: Record button clicked for track ${track.id}`, {
      isRecording,
      isCountingIn,
      hasMediaStream: !!mediaStream
    });

    if (isRecording || isCountingIn) {
      // Stop recording or cancel countdown
      RecordingManager.stopRecording(track.id);
    } else if (mediaStream) {
      // Get current position from transport
      const startPosition = getTransportTime ? getTransportTime() : 0;

      // Start recording
      await RecordingManager.startRecording(track.id, 'audio', {
        mediaStream,
        startPosition
      });
    } else {
      console.error(`🎤 AudioTrack: Cannot start recording - no media stream`);
    }
  };

  // Handle clip playback (existing code)
  useEffect(() => {
    if (clipPlayerRef.current) {
      if (isPlaying && !track.muted && (soloTrackId === null || soloTrackId === track.id)) {
        const updatedClips = track.clips?.map((clip) => ({
          ...clip,
          volume: track.volume || 1,
          pan: track.pan || 0,
        }));
        clipPlayerRef.current.play(updatedClips, currentTime);
      } else {
        clipPlayerRef.current.pause();
      }
    }
  }, [isPlaying, track.id, track.clips, track.muted, track.volume, track.pan, soloTrackId, currentTime]);

  // Seek when playback starts
  useEffect(() => {
    if (isPlaying && !isRecording && clipPlayerRef.current) {
      clipPlayerRef.current.seek(currentTime);
    }
  }, [isPlaying, track.id, track.muted, soloTrackId, isRecording, getTransportTime]);

  // Handler functions
  const handleRemove = () => {
    if (window.confirm('Remove this track?')) {
      removeTrack(track.id);
    }
  };

  // Progress update helper for advanced import
  const updateLoadingProgress = (state, progress) => {
    setLoadingState(state);
    setLoadingProgress(progress);
    console.log(`🔄 Loading ${state}: ${Math.round(progress)}%`);
  };

  // Advanced file import (existing code)
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

      // Create placeholder clip
      clipId = `clip-${track.id}-${Date.now()}`;
      const placeholderClip = {
        id: clipId,
        start: 0,
        duration: 0,
        color: track.color || '#7bafd4',
        src: url,
        offset: 0,
        name: file.name.replace(/\.[^/.]+$/, ''),
        isLoading: true,
        loadingState: 'reading'
      };

      // Add placeholder
      updateTrack(track.id, {
        audioURL: url,
        clips: [...(track.clips || []), placeholderClip]
      });

      // Process audio
      const result = await audioProcessor.processAudioFile(
        url,
        clipId,
        (stage, progress) => {
          updateLoadingProgress(stage, progress);

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

      setProcessingMethod(result.method);
      console.log(`🔧 Audio processed using: ${result.method}`);

      // Update with final data
      const finalClip = {
        ...placeholderClip,
        duration: result.duration,
        isLoading: false,
        loadingState: 'complete',
        processingMethod: result.method
      };

      updateTrack(track.id, (prevTrack) => ({
        ...prevTrack,
        clips: prevTrack.clips.map(clip =>
          clip.id === clipId ? finalClip : clip
        )
      }));

      updateLoadingProgress('complete', 100);

      if (result.peaks) {
        console.log(`✅ Peaks ready (${result.peaks.length} samples)`);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err) {
      console.error('Error importing file:', err);
      updateLoadingProgress('error', 100);

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

  const isSelected = selectedTrackId === track.id;
  const isSolo = soloTrackId === track.id;

  // Render
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
          position: 'sticky',
          left: 0,
          zIndex: 10,
        }}
      >
        <span style={{ color: '#666', fontSize: '14px', fontWeight: 'bold' }}>
          {index + 1}
        </span>
      </div>

      {/* Main track div */}
      <div
        className={`track ${isSelected ? 'track-selected' : ''}`}
        onClick={() => setSelectedTrackId(track.id)}
        style={{ display: 'flex', flex: 1 }}
      >
        {/* Track Controls */}
        <div
          className="track-controls"
          style={{
            width: '230px',
            flexShrink: 0,
            padding: '10px',
            borderRight: '1px solid #444',
            backgroundColor: '#232323',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            position: 'sticky',
            left: '80px',
            zIndex: 9,
          }}
        >
          {/* Track Name */}
          <input
            type="text"
            value={track.name}
            onChange={(e) => updateTrack(track.id, { name: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="track-name-input"
            style={{
              fontSize: '0.875rem',
              padding: '4px 8px',
            }}
          />

          {/* Record Button with Countdown */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isRecording ? (
              <Button
                size="sm"
                variant={isCountingIn ? 'danger' : 'outline-danger'}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRecord();
                }}
                disabled={!mediaStream}
                title={isCountingIn ? `Countdown: ${countdownValue}` : 'Start Recording'}
                style={{ flex: 1 }}
              >
                {isCountingIn ? countdownValue : <FaCircle />}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="warning"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRecord();
                }}
                title="Stop Recording"
                style={{ flex: 1 }}
              >
                <FaStop />
              </Button>
            )}

            {/* File Import */}
            <Button
              size="sm"
              variant="outline-primary"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              title="Import Audio File"
              style={{ flex: 1 }}
            >
              <FaFileImport />
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileImport}
            style={{ display: 'none' }}
          />

          {/* Loading Progress */}
          {isLoading && (
            <div>
              <ProgressBar
                now={loadingProgress}
                label={`${Math.round(loadingProgress)}%`}
                variant={
                  loadingState === 'error' ? 'danger' :
                  loadingState === 'complete' ? 'success' :
                  'primary'
                }
                style={{ height: '16px', fontSize: '11px' }}
              />
              <div className="text-center mt-1" style={{ fontSize: '10px', color: '#aaa' }}>
                {loadingState} {processingMethod && `(${processingMethod})`}
              </div>
            </div>
          )}

          {/* Volume/Pan Controls */}
          <div>
            <ButtonGroup size="sm" className="w-100 mb-2">
              <Button
                variant={controlTab === 'vol' ? 'primary' : 'outline-secondary'}
                onClick={() => setControlTab('vol')}
              >
                Vol
              </Button>
              <Button
                variant={controlTab === 'pan' ? 'primary' : 'outline-secondary'}
                onClick={() => setControlTab('pan')}
              >
                Pan
              </Button>
            </ButtonGroup>

            {controlTab === 'vol' ? (
              <div className="track-control-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="control-icon" style={{ fontSize: '12px' }}>🔊</span>
                <input
                  type="range"
                  className="track-volume-slider"
                  min="0"
                  max="1"
                  step="0.01"
                  value={track.volume || 1}
                  onChange={(e) => updateTrack(track.id, { volume: parseFloat(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                  disabled={track.muted}
                  style={{ flex: 1 }}
                />
                <span className="control-value" style={{ fontSize: '11px', width: 30 }}>
                  {Math.round((track.volume || 1) * 100)}
                </span>
              </div>
            ) : (
              <div className="track-control-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdPanTool size={12} className="control-icon" />
                <input
                  type="range"
                  className="track-pan-slider"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={track.pan || 0}
                  onChange={(e) => updateTrack(track.id, { pan: parseFloat(e.target.value) })}
                  onClick={(e) => e.stopPropagation()}
                  disabled={track.muted}
                  style={{ flex: 1 }}
                />
                <span className="control-value" style={{ fontSize: '11px', width: 30 }}>
                  {track.pan > 0 ? `R${Math.round((track.pan || 0) * 100)}` :
                   track.pan < 0 ? `L${Math.round(Math.abs((track.pan || 0) * 100))}` : 'C'}
                </span>
              </div>
            )}
          </div>

          {/* Solo/Mute/Delete Buttons */}
          <div style={{ display: 'flex', gap: 4, marginTop: 'auto' }}>
            <Button
              variant={isSolo ? 'warning' : 'outline-secondary'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSoloTrackId(isSolo ? null : track.id);
              }}
              title="Solo"
              style={{ flex: 1 }}
            >
              S
            </Button>
            <Button
              variant={track.muted ? 'danger' : 'outline-secondary'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                updateTrack(track.id, { muted: !track.muted });
              }}
              title={track.muted ? 'Unmute' : 'Mute'}
              style={{ flex: 1 }}
            >
              M
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              title="Delete Track"
              style={{ flex: 1 }}
            >
              <FaTrash />
            </Button>
          </div>
        </div>

        {/* Track Content Area */}
        <div
          className="track-content"
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            minHeight: '120px',
            backgroundColor: isDragOver ? 'rgba(100, 149, 237, 0.1)' : 'transparent',
            transition: 'background-color 0.2s, border 0.2s',
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isRecording ? (
            <LiveWaveformVisualizer
              trackId={track.id}
              mediaStream={mediaStream}
              height={160}
              color="#ff6b6b"
              backgroundColor="transparent"
              zoomLevel={zoomLevel}
              getTransportTime={getTransportTime}
            />
          ) : (
            <>
              <TrackClipCanvas
                clips={track.clips || []}
                zoomLevel={zoomLevel}
                duration={duration}
                currentTime={currentTime}
                isPlaying={isPlaying}
                trackColor={track.color || '#7bafd4'}
                trackId={track.id}
                updateTrack={updateTrack}
              />
              <ClipPlayer
                ref={clipPlayerRef}
                updateTrack={updateTrack}
                trackId={track.id}
                volume={track.volume || 1}
                pan={track.pan || 0}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export default memo(AudioTrack, (prevProps, nextProps) => {
  const isEqual =
    prevProps.track.id === nextProps.track.id &&
    prevProps.track.name === nextProps.track.name &&
    prevProps.track.muted === nextProps.track.muted &&
    prevProps.track.volume === nextProps.track.volume &&
    prevProps.track.pan === nextProps.track.pan &&
    prevProps.track.clips === nextProps.track.clips &&
    prevProps.track.audioURL === nextProps.track.audioURL &&
    prevProps.track.isRecording === nextProps.track.isRecording &&
    prevProps.index === nextProps.index &&
    prevProps.zoomLevel === nextProps.zoomLevel;

  if (!isEqual) {
    console.log('🔄 AudioTrack: Re-rendering due to prop change', {
      trackId: prevProps.track.id,
      changes: {
        name: prevProps.track.name !== nextProps.track.name,
        muted: prevProps.track.muted !== nextProps.track.muted,
        volume: prevProps.track.volume !== nextProps.track.volume,
        pan: prevProps.track.pan !== nextProps.track.pan,
        clips: prevProps.track.clips !== nextProps.track.clips,
        audioURL: prevProps.track.audioURL !== nextProps.track.audioURL,
        isRecording: prevProps.track.isRecording !== nextProps.track.isRecording,
        index: prevProps.index !== nextProps.index,
        zoomLevel: prevProps.zoomLevel !== nextProps.zoomLevel,
      }
    });
  }

  return isEqual;
});