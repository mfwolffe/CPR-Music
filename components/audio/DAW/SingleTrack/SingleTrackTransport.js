'use client';

import { useCallback } from 'react';
import { Button, Dropdown } from 'react-bootstrap';
import { useSingleTrack } from '../../../../contexts/DAWProvider';
import {
  FaRegCirclePlay,
  FaRegCirclePause,
  FaArrowRotateLeft,
  FaArrowRotateRight
} from 'react-icons/fa6';
import {
  BsSkipBackwardCircle,
  BsZoomIn,
  BsZoomOut,
  BsSpeedometer2
} from 'react-icons/bs';
import { TbZoomReset } from 'react-icons/tb';

const icoSize = "1.25rem";

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function SingleTrackTransport() {
  const {
    isPlaying,
    currentTime,
    duration,
    playPause,
    stop,
    seek,
    zoomLevel,
    setZoomLevel,
    playbackSpeed,
    setPlaybackSpeed,
  } = useSingleTrack();

  const onSkipTenFwd = useCallback(() => {
    seek(currentTime + 10);
  }, [currentTime, seek]);

  const onSkipTenBkwd = useCallback(() => {
    seek(currentTime - 10);
  }, [currentTime, seek]);

  const zoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 25, 400));
  }, [setZoomLevel]);

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 25, 25));
  }, [setZoomLevel]);

  const resetZoom = useCallback(() => {
    setZoomLevel(100);
  }, [setZoomLevel]);

  return (
    <div className="d-flex w-100 ml-auto mr-auto prog-bar align-items-center flex-between flex gap-0375">
      {/* Playback controls */}
      <div className="d-flex gap-05 align-items-center">
        <Button onClick={onSkipTenBkwd} className="prog-button pl-2">
          <FaArrowRotateLeft fontSize={icoSize} />
        </Button>
        <Button className="prog-button" onClick={stop}>
          <BsSkipBackwardCircle fontSize={icoSize} />
        </Button>
        <Button onClick={playPause} className="prog-button">
          {isPlaying ? (
            <FaRegCirclePause fontSize={icoSize} />
          ) : (
            <FaRegCirclePlay fontSize={icoSize} />
          )}
        </Button>
        <Button onClick={onSkipTenFwd} className="prog-button">
          <FaArrowRotateRight fontSize={icoSize} />
        </Button>
        <span
          className="pl-1 pt-0 pb-0 mt-0 mb-0"
          style={{ color: isPlaying ? 'aqua' : 'white' }}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Zoom and Speed controls */}
      <div className="d-flex gap-0375 align-items-center">
        {/* Speed control */}
        <Dropdown>
          <Dropdown.Toggle
            variant="dark"
            size="sm"
            className="prog-button d-flex align-items-center gap-1"
            style={{ padding: '4px 8px' }}
          >
            <BsSpeedometer2 fontSize="1rem" />
            <span style={{ fontSize: '0.85rem' }}>
              {playbackSpeed === 1 ? '1x' : `${playbackSpeed}x`}
            </span>
          </Dropdown.Toggle>

          <Dropdown.Menu variant="dark">
            <Dropdown.Item onClick={() => setPlaybackSpeed(0.25)}>0.25x</Dropdown.Item>
            <Dropdown.Item onClick={() => setPlaybackSpeed(0.5)}>0.5x</Dropdown.Item>
            <Dropdown.Item onClick={() => setPlaybackSpeed(0.75)}>0.75x</Dropdown.Item>
            <Dropdown.Item onClick={() => setPlaybackSpeed(1)}>1x (Normal)</Dropdown.Item>
            <Dropdown.Item onClick={() => setPlaybackSpeed(1.25)}>1.25x</Dropdown.Item>
            <Dropdown.Item onClick={() => setPlaybackSpeed(1.5)}>1.5x</Dropdown.Item>
            <Dropdown.Item onClick={() => setPlaybackSpeed(2)}>2x</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        {/* Zoom controls */}
        <Button className="prog-button" onClick={zoomIn}>
          <BsZoomIn fontSize={icoSize} />
        </Button>
        <Button className="prog-button" onClick={zoomOut}>
          <BsZoomOut fontSize={icoSize} />
        </Button>
        <Button className="prog-button" onClick={resetZoom}>
          <TbZoomReset fontSize={icoSize} />
        </Button>
        <span className="text-muted" style={{ fontSize: '0.85rem' }}>
          {zoomLevel}%
        </span>
      </div>
    </div>
  );
}
