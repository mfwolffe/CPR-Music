// components/audio/DAW/Multitrack/RecordingTrack.js
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button, Form, ButtonGroup } from 'react-bootstrap';
import { FaCircle, FaStop, FaMicrophone, FaVolumeUp } from 'react-icons/fa';
import { MdPanTool } from 'react-icons/md';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import WalkingWaveform from './WalkingWaveform';
import Track from './Track';

export default function RecordingTrack({ track, index, zoomLevel = 100 }) {
  const {
    updateTrack,
    setSelectedTrackId,
    selectedTrackId,
    currentTime,
    duration,
  } = useMultitrack();

  const [mediaStream, setMediaStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [controlTab, setControlTab] = useState('vol'); // 'vol' | 'pan'
  const [recordedBlob, setRecordedBlob] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Initialize media stream
  useEffect(() => {
    const initMediaStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setMediaStream(stream);
        console.log('RecordingTrack: Media stream initialized');
      } catch (error) {
        console.error('RecordingTrack: Error accessing microphone:', error);
      }
    };

    initMediaStream();

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []); // Only run once on mount

  // No need to calculate pixelsPerSecond here - let WalkingWaveform handle it
  // to ensure consistency with TrackClipCanvas

  const startRecording = () => {
    console.log('RecordingTrack: startRecording called', {
      hasMediaStream: !!mediaStream,
      isAlreadyRecording: isRecording,
      canRecord: !isRecording && mediaStream,
      currentTime,
    });

    if (isRecording || !mediaStream) {
      console.error('RecordingTrack: Cannot start recording', {
        isRecording,
        hasMediaStream: !!mediaStream,
      });
      return;
    }

    chunksRef.current = [];

    // Capture current playhead position when recording starts
    const recordingStartPosition = currentTime;

    // Determine MIME type
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    console.log('RecordingTrack: Using MIME type:', mimeType);
    console.log(
      'RecordingTrack: Recording will start at position:',
      recordingStartPosition,
    );

    // Create MediaRecorder
    const recorder = new MediaRecorder(mediaStream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);

      console.log('Recording stopped, blob created:', blob);

      // Get audio duration using Web Audio API
      let audioDuration = 0;
      try {
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioDuration = audioBuffer.duration;
        console.log('Audio duration:', audioDuration);
      } catch (error) {
        console.error('Error getting audio duration:', error);
        audioDuration = 10; // fallback duration
      }

      // Create a clip at the position where recording started
      const newClip = {
        id: `clip-${track.id}-${Date.now()}`,
        start: recordingStartPosition, // Use the stored start position
        duration: audioDuration,
        src: url,
        offset: 0,
        color: track.color || '#ff6b6b',
        name: `Recording ${new Date().toLocaleTimeString()}`,
      };

      // Update the track with the recorded audio AND the clip
      updateTrack(track.id, {
        audioURL: url,
        isRecording: false,
        isEmpty: false,
        clips: [...(track.clips || []), newClip], // Add the new clip
        type: 'audio', // Convert from recording to audio track
        recordingStartPosition: undefined, // Clear the start position
      });

      setRecordedBlob(blob);
      setIsRecording(false);

      // Important: Update duration in multitrack context if needed
      if (
        audioDuration > 0 &&
        recordingStartPosition + audioDuration > duration
      ) {
        // This will trigger duration update in MultitrackContext
        setTimeout(() => {
          updateTrack(track.id, {
            duration: recordingStartPosition + audioDuration,
          });
        }, 100);
      }
    };

    // Start recording
    recorder.start(10); // Collect data every 10ms
    setIsRecording(true);
    console.log('RecordingTrack: Recording started');

    // Update track to show recording state AND store start position
    updateTrack(track.id, {
      isRecording: true,
      recordingStartPosition: recordingStartPosition,
    });
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  const isSelected = selectedTrackId === track.id;

  // If we have recorded audio, render the normal track
  if (track.audioURL && !track.isEmpty && !isRecording) {
    return <Track track={track} index={index} zoomLevel={zoomLevel} />;
  }

  // Otherwise, render the recording interface
  return (
    <div
      className="track-container"
      style={{ display: 'flex', height: '160px' }}
    >
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
        {/* Track number with recording indicator */}
        <span
          style={{
            color: isRecording ? '#ff6b6b' : '#666',
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {isRecording && <FaCircle size={8} />}
          {index + 1}
        </span>
      </div>

      {/* Main track div */}
      <div
        className={`track recording-track ${isSelected ? 'track-selected' : ''}`}
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

          {/* Three-button row: Solo / Mute / Record */}
          <div className="track-button-row" style={{ display: 'flex', gap: 4 }}>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                // Solo is managed globally; placeholder if needed later
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
            {!isRecording ? (
              <Button
                size="sm"
                variant="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  startRecording();
                }}
                title="Record"
                style={{ flex: 1 }}
              >
                <FaCircle />
              </Button>
            ) : (
              <Button
                size="sm"
                variant="warning"
                onClick={(e) => {
                  e.stopPropagation();
                  stopRecording();
                }}
                title="Stop"
                style={{ flex: 1 }}
              >
                <FaStop />
              </Button>
            )}
          </div>

          {/* Vol/Pan toggle like MIDI */}
          <ButtonGroup
            size="sm"
            className="control-tabs"
            style={{ marginTop: 4 }}
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
            <div className="slider-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaMicrophone size={12} />
                <Form.Range
                  value={track.volume || 1}
                  onChange={(e) =>
                    updateTrack(track.id, {
                      volume: parseFloat(e.target.value),
                    })
                  }
                  onClick={(e) => e.stopPropagation()}
                  min={0}
                  max={1}
                  step={0.01}
                  className="track-volume-slider"
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: '11px', width: 30 }}>
                  {Math.round((track.volume || 1) * 100)}
                </span>
              </label>
            </div>
          ) : (
            <div className="slider-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdPanTool size={12} />
                <Form.Range
                  value={track.pan || 0}
                  onChange={(e) =>
                    updateTrack(track.id, { pan: parseFloat(e.target.value) })
                  }
                  onClick={(e) => e.stopPropagation()}
                  min={-1}
                  max={1}
                  step={0.01}
                  className="track-pan-slider"
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: '11px', width: 30 }}>
                  {track.pan > 0
                    ? `R${Math.round((track.pan || 0) * 100)}`
                    : track.pan < 0
                      ? `L${Math.round(Math.abs((track.pan || 0) * 100))}`
                      : 'C'}
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Track Waveform - takes remaining space */}
        <div
          className="track-waveform"
          style={{
            flex: 1,
            backgroundColor: '#2a2a2a',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {isRecording ? (
            <>
              {console.log('RecordingTrack: Rendering WalkingWaveform', {
                mediaStream: !!mediaStream,
                isRecording,
                startPosition: track.recordingStartPosition || 0,
                zoomLevel,
                duration,
              })}
              <WalkingWaveform
                mediaStream={mediaStream}
                isRecording={isRecording}
                trackId={track.id}
                height={160}
                color="#ff6b6b"
                startPosition={track.recordingStartPosition || 0}
                zoomLevel={zoomLevel}
                duration={duration}
              />
            </>
          ) : (
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
              {mediaStream ? 'Ready to record' : 'Initializing microphone...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
