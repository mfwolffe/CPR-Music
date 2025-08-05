'use client';

import { useCallback } from 'react';
import { Button, Dropdown } from 'react-bootstrap';
import { useAudio, useUI } from '../../../contexts/DAWProvider';
import { formatTime } from '../../../lib/dawUtils';
import { 
  FaRegCirclePlay, 
  FaRegCirclePause, 
  FaArrowRotateLeft, 
  FaArrowRotateRight 
} from 'react-icons/fa6';
import { 
  BsSkipBackwardCircle, 
  BsSpeedometer2, 
  BsZoomIn, 
  BsZoomOut 
} from 'react-icons/bs';
import { TbZoomReset } from 'react-icons/tb';

const icoSize = "1.25rem";

/**
 * Transport controls for playback, seeking, zoom, and speed
 */
export default function Transport() {
  const { 
    wavesurferRef, 
    isPlaying, 
    currentTime, 
    playbackSpeed, 
    setPlaybackSpeed 
  } = useAudio();
  const { zoomLevel, setZoomLevel } = useUI();
  
  const wavesurfer = wavesurferRef?.current;
  
  // Playback controls
  const onPlayPause = useCallback(() => {
    if (wavesurfer) {
      wavesurfer.playPause();
    }
  }, [wavesurfer]);
  
  const onSkipTenFwd = useCallback(() => {
    if (wavesurfer) {
      wavesurfer.skip(10);
    }
  }, [wavesurfer]);
  
  const onSkipTenBkwd = useCallback(() => {
    if (wavesurfer) {
      wavesurfer.skip(-10);
    }
  }, [wavesurfer]);
  
  const onStopSeekZero = useCallback(() => {
    if (wavesurfer) {
      wavesurfer.seekTo(0);
      if (wavesurfer.isPlaying()) {
        wavesurfer.pause();
      }
    }
  }, [wavesurfer]);
  
  // Zoom controls
  const zoomIn = useCallback(() => {
    const newLevel = zoomLevel + 25;
    setZoomLevel(newLevel);
    if (wavesurfer) {
      wavesurfer.zoom(newLevel);
    }
  }, [wavesurfer, zoomLevel, setZoomLevel]);
  
  const zoomOut = useCallback(() => {
    const newLevel = Math.max(0, zoomLevel - 25);
    setZoomLevel(newLevel);
    if (wavesurfer) {
      wavesurfer.zoom(newLevel);
    }
  }, [wavesurfer, zoomLevel, setZoomLevel]);
  
  const resetZoom = useCallback(() => {
    setZoomLevel(0);
    if (wavesurfer) {
      wavesurfer.zoom(0);
    }
  }, [wavesurfer, setZoomLevel]);
  
  if (!wavesurfer) return null;
  
  return (
    <div className="d-flex w-100 ml-auto mr-auto prog-bar align-items-center flex-between flex gap-0375">
      {/* Playback controls */}
      <div className="d-flex gap-05 align-items-center">
        <Button onClick={onSkipTenBkwd} className="prog-button pl-2">
          <FaArrowRotateLeft fontSize={icoSize} />
        </Button>
        <Button className="prog-button" onClick={onStopSeekZero}>
          <BsSkipBackwardCircle fontSize={icoSize} />
        </Button>
        <Button onClick={onPlayPause} className="prog-button">
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
          {formatTime(currentTime)}
        </span>
      </div>
      
      {/* Zoom and speed controls */}
      <div className="d-flex gap-0375 align-items-center">
        <Button className="prog-button" onClick={zoomIn}>
          <BsZoomIn fontSize={icoSize} />
        </Button>
        <Button className="prog-button" onClick={zoomOut}>
          <BsZoomOut fontSize={icoSize} />
        </Button>
        <Button className="prog-button" onClick={resetZoom}>
          <TbZoomReset fontSize={icoSize} />
        </Button>
        
        <Dropdown
          className="pr-2"
          drop="up-centered"
          onSelect={(eventKey) => setPlaybackSpeed(parseFloat(eventKey))}
        >
          <Dropdown.Toggle
            className="prog-button mt-0 mb-0 pt-0 pb-0"
            id="dropdown-basic"
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