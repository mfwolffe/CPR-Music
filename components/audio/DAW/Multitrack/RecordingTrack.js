// components/audio/DAW/Multitrack/RecordingTrack.js
'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { FaCircle, FaStop, FaMicrophone } from 'react-icons/fa';
import { MdPanTool } from 'react-icons/md';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import WalkingWaveform from './WalkingWaveform';
import Track from './Track';

export default function RecordingTrack({ track, index, zoomLevel = 100 }) {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const { updateTrack, selectedTrackId, setSelectedTrackId } = useMultitrack();

  // Initialize media stream
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
        },
      })
      .then((stream) => {
        setMediaStream(stream);
      })
      .catch((err) => {
        console.error('Error accessing microphone:', err);
      });

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecording = () => {
    console.log('RecordingTrack: Starting recording', {
      hasMediaStream: !!mediaStream,
    });

    if (!mediaStream) {
      console.error('RecordingTrack: No media stream available');
      return;
    }

    chunksRef.current = [];

    // Determine MIME type
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    console.log('RecordingTrack: Using MIME type:', mimeType);

    // Create MediaRecorder
    const recorder = new MediaRecorder(mediaStream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);

      console.log('Recording stopped, blob created:', blob);

      // Update the track with the recorded audio
      updateTrack(track.id, {
        audioURL: url,
        isRecording: false,
        isEmpty: false,
      });

      setRecordedBlob(blob);
      setIsRecording(false);
    };

    // Start recording
    recorder.start(10); // Collect data every 10ms
    setIsRecording(true);
    console.log('RecordingTrack: Recording started');

    // Update track to show recording state
    updateTrack(track.id, { isRecording: true });
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
      className={`track ${isSelected ? 'track-selected' : ''}`}
      onClick={() => setSelectedTrackId(track.id)}
    >
      {/* Left Side - Track Controls */}
      <div className="track-controls">
        <div className="track-header">
          <div style={{ width: '24px' }}></div>

          <Form.Control
            type="text"
            value={track.name}
            onChange={(e) => updateTrack(track.id, { name: e.target.value })}
            className="track-name-input"
            onClick={(e) => e.stopPropagation()}
          />

          <div style={{ width: '24px' }}></div>
        </div>

        <div className="track-buttons">
          {!isRecording ? (
            <Button
              size="sm"
              variant="danger"
              onClick={(e) => {
                e.stopPropagation();
                startRecording();
              }}
              className="w-100"
            >
              <FaCircle /> Record
            </Button>
          ) : (
            <Button
              size="sm"
              variant="warning"
              onClick={(e) => {
                e.stopPropagation();
                stopRecording();
              }}
              className="w-100"
            >
              <FaStop /> Stop
            </Button>
          )}
        </div>

        <div className="track-sliders">
          <div className="slider-group">
            <label>
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
              />
            </label>
          </div>

          <div className="slider-group">
            <label>
              <FaMicrophone size={12} />
              <Form.Range
                value={track.volume || 1}
                onChange={(e) =>
                  updateTrack(track.id, { volume: parseFloat(e.target.value) })
                }
                onClick={(e) => e.stopPropagation()}
                min={0}
                max={1}
                step={0.01}
                className="track-volume-slider"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Right Side - Waveform or Recording Visualizer */}
      <div
        className="track-waveform"
        style={{
          minHeight: '60px',
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
            })}
            <WalkingWaveform
              mediaStream={mediaStream}
              isRecording={isRecording}
              trackId={track.id}
              height={60}
              color="#ff6b6b"
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
  );
}
