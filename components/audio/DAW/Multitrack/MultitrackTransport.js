'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Button, Dropdown } from 'react-bootstrap';
import { useMultitrack, useRecording } from '../../../../contexts/DAWProvider';
import { formatTime } from '../../../../lib/dawUtils';
import RecordingModeIndicator from './RecordingModeIndicator';
import {
  FaRegCirclePlay,
  FaRegCirclePause,
  FaArrowRotateLeft,
  FaArrowRotateRight,
  FaMicrophone,
  FaStop,
} from 'react-icons/fa6';
import {
  BsSkipBackwardCircle,
  BsSpeedometer2,
  BsVolumeUp,
  BsRecordCircleFill,
} from 'react-icons/bs';
import Knob from '../../../Knob';
import styles from './MultitrackTransport.module.css';

const icoSize = '1.25rem';

/**
 * Transport controls for multitrack playback and recording
 */
export default function MultitrackTransport() {
  const {
    tracks,
    isPlaying,
    currentTime,
    duration,
    playbackSpeed,
    setPlaybackSpeed,
    masterVolume,
    setMasterVolume,
    masterPan,
    setMasterPan,
    play,
    pause,
    stop,
    seekTo,
    addTrack,
    updateTrack,
    selectedTrackId,
    cursorPosition,
  } = useMultitrack();

  const {
    isRecording,
    setIsRecording,
    isBlocked,
    mediaRecorder,
    chunksRef,
    recordingTime,
    setRecordingTime,
  } = useRecording();

  const hasAudio = tracks.some((t) => t.audioURL);
  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);

  // Recording timer
  useEffect(() => {
    let interval = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => ({
          min: prev.sec === 59 ? prev.min + 1 : prev.min,
          sec: prev.sec === 59 ? 0 : prev.sec + 1,
        }));
      }, 1000);
    } else {
      setRecordingTime({ min: 0, sec: 0 });
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, setRecordingTime]);

  // Recording controls
  const startRecording = useCallback(() => {
    if (isBlocked || !mediaRecorder) {
      console.error(
        'Cannot record, microphone permissions are blocked or recorder not ready',
      );
      alert(
        'Microphone permissions are blocked or recorder not ready. Please allow microphone access.',
      );
      return;
    }

    // Check if there's a selected track
    if (!selectedTrackId) {
      alert('Please select a track to record into');
      return;
    }

    const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
    if (!selectedTrack) {
      alert('Selected track not found');
      return;
    }

    // Arm the selected track if not already armed
    if (!selectedTrack.armed) {
      updateTrack(selectedTrackId, { armed: true });
    }

    // Start recording at cursor position
    console.log(
      `Starting recording on track "${selectedTrack.name}" at position ${cursorPosition}s`,
    );

    // Update track with recording metadata
    updateTrack(selectedTrackId, {
      recordingStartTime: cursorPosition,
      isRecording: true,
      recordingDuration: 0,
    });

    // Stop playback if playing
    if (isPlaying) {
      stop();
    }

    console.log('Starting MediaRecorder...');
    console.log(
      'Clearing chunks array, previous length:',
      chunksRef.current.length,
    );
    chunksRef.current = [];
    mediaRecorder.start(10);
    console.log('MediaRecorder.start() called, state:', mediaRecorder.state);
    setIsRecording(true);
  }, [
    isBlocked,
    mediaRecorder,
    selectedTrackId,
    tracks,
    isPlaying,
    stop,
    chunksRef,
    setIsRecording,
    updateTrack,
    cursorPosition,
  ]);

  const stopRecording = useCallback(() => {
    console.log('🛑 MultitrackTransport stopRecording called');
    console.log('- MediaRecorder exists:', !!mediaRecorder);
    console.log('- MediaRecorder state:', mediaRecorder?.state);
    console.log('- isRecording state:', isRecording);

    // First update our recording state
    setIsRecording(false);
    console.log('✅ setIsRecording(false) called');

    // Then stop the MediaRecorder if it's recording
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      console.log('📍 Calling mediaRecorder.stop()...');

      try {
        mediaRecorder.stop();
        console.log('✅ mediaRecorder.stop() called successfully');
      } catch (error) {
        console.error('❌ Error stopping MediaRecorder:', error);
      }

      // Find and update the recording track
      const recordingTrack = tracks.find((t) => t.armed);
      if (recordingTrack) {
        console.log('🎯 Found armed track:', recordingTrack.name);
        // Just clear the isRecording flag, keep it armed
        updateTrack(recordingTrack.id, { isRecording: false });
      }
    } else {
      console.warn('⚠️ MediaRecorder not in recording state or not available');
    }
  }, [mediaRecorder, setIsRecording, tracks, updateTrack, isRecording]);

  // Playback controls
  const onPlayPause = useCallback(() => {
    if (isRecording) {
      // Don't allow playback during recording
      return;
    }

    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, isRecording, play, pause]);

  const onSkipTenFwd = useCallback(() => {
    seekTo(Math.min(duration, currentTime + 10));
  }, [currentTime, duration, seekTo]);

  const onSkipTenBkwd = useCallback(() => {
    seekTo(Math.max(0, currentTime - 10));
  }, [currentTime, seekTo]);

  const onStopSeekZero = useCallback(() => {
    stop();
  }, [stop]);

  return (
    <div className={styles.transportBar}>
      {/* Playback controls */}
      <div className={styles.playbackControls}>
        {/* Record button */}
        <Button
          className={`prog-button ${isRecording ? 'recording-active' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isBlocked || !selectedTrackId}
          variant={isRecording ? 'danger' : 'secondary'}
          title={
            !selectedTrackId
              ? 'Please select a track first'
              : isRecording
                ? 'Stop recording'
                : `Start recording at ${cursorPosition.toFixed(1)}s`
          }
        >
          {isRecording ? (
            <>
              <BsRecordCircleFill
                fontSize={icoSize}
                className="recording-pulse"
              />
              <span className="ms-1">
                {String(recordingTime.min).padStart(2, '0')}:
                {String(recordingTime.sec).padStart(2, '0')}
              </span>
            </>
          ) : (
            <BsRecordCircleFill fontSize={icoSize} />
          )}
        </Button>

        <div
          className="mx-2"
          style={{ borderLeft: '1px solid #555', height: '24px' }}
        />

        <Button
          onClick={onSkipTenBkwd}
          className="prog-button pl-2"
          disabled={!hasAudio || isRecording}
        >
          <FaArrowRotateLeft fontSize={icoSize} />
        </Button>
        <Button
          className="prog-button"
          onClick={onStopSeekZero}
          disabled={!hasAudio || isRecording}
        >
          <BsSkipBackwardCircle fontSize={icoSize} />
        </Button>
        <Button
          onClick={onPlayPause}
          className="prog-button"
          disabled={!hasAudio || isRecording}
        >
          {isPlaying ? (
            <FaRegCirclePause fontSize={icoSize} />
          ) : (
            <FaRegCirclePlay fontSize={icoSize} />
          )}
        </Button>
        <Button
          onClick={onSkipTenFwd}
          className="prog-button"
          disabled={!hasAudio || isRecording}
        >
          <FaArrowRotateRight fontSize={icoSize} />
        </Button>
        <span
          className={styles.timeDisplay}
          style={{
            color: isPlaying ? 'aqua' : isRecording ? '#ff4444' : 'white',
          }}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Recording mode indicator */}
      <RecordingModeIndicator />

      {/* Master controls */}
      <div className={styles.masterControls}>
        {/* Master Volume */}
        <div className={styles.knobControl}>
          <Knob
            value={masterVolume}
            onChange={setMasterVolume}
            min={0}
            max={1.5}
            label="Master"
            displayValue={`${Math.round(masterVolume * 100)}%`}
            size={40}
            color="#e75b5c"
          />
        </div>

        {/* Master Pan */}
        <div className={styles.knobControl}>
          <Knob
            value={masterPan}
            onChange={setMasterPan}
            min={-1}
            max={1}
            label="Pan"
            displayValue={
              masterPan === 0
                ? 'C'
                : masterPan < 0
                  ? `${Math.round(Math.abs(masterPan) * 100)}L`
                  : `${Math.round(masterPan * 100)}R`
            }
            size={40}
            color="#92ceaa"
          />
        </div>

        {/* Playback speed */}
        <Dropdown
          className="pr-2"
          drop="up-centered"
          onSelect={(eventKey) => setPlaybackSpeed(parseFloat(eventKey))}
        >
          <Dropdown.Toggle
            className="prog-button mt-0 mb-0 pt-0 pb-0"
            id="dropdown-basic"
            disabled={isRecording}
          >
            <BsSpeedometer2 fontSize={icoSize} />
          </Dropdown.Toggle>
          <Dropdown.Menu className="bg-daw-toolbars">
            <Dropdown.Item className="text-white" eventKey="2">
              2x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey="1.75">
              1.75x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey="1.5">
              1.5x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey="1.25">
              1.25x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey="1">
              1x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey="0.75">
              0.75x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey="0.5">
              0.5x
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </div>
  );
}
