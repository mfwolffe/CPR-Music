// components/audio/DAW/Multitrack/MultitrackTransport.js
'use client';

import { Button } from 'react-bootstrap';
import {
  FaPlay,
  FaPause,
  FaStop,
  FaStepBackward,
  FaStepForward,
  FaMicrophone,
} from 'react-icons/fa';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

export default function MultitrackTransport() {
  const { isPlaying, play, pause, stop, currentTime, duration } =
    useMultitrack();

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="multitrack-transport">
      <div className="transport-controls">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            /* TODO: Skip to start */
          }}
          disabled={true}
        >
          <FaStepBackward />
        </Button>

        <Button
          size="sm"
          variant="primary"
          onClick={isPlaying ? pause : play}
          disabled={true} // Will implement in Phase 5
        >
          {isPlaying ? <FaPause /> : <FaPlay />}
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={stop}
          disabled={true} // Will implement in Phase 5
        >
          <FaStop />
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            /* TODO: Skip to end */
          }}
          disabled={true}
        >
          <FaStepForward />
        </Button>

        <div className="transport-divider" />

        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            /* TODO: Start recording */
          }}
          disabled={true} // Will implement in Phase 4
        >
          <FaMicrophone /> Record
        </Button>
      </div>

      <div className="transport-time">
        <span className="time-display">
          {formatTime(currentTime)} / {formatTime(duration || 0)}
        </span>
      </div>

      <div className="transport-status">
        <span className="text-muted">Transport controls coming in Phase 5</span>
      </div>
    </div>
  );
}
