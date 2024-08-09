import { useCallback, useState } from 'react';

import { BsSpeedometer2 } from 'react-icons/bs';
import { FaRegCirclePlay } from 'react-icons/fa6';
import { FaRegCirclePause } from 'react-icons/fa6';
import { Button, Dropdown } from 'react-bootstrap';
import { FaArrowRotateLeft } from 'react-icons/fa6';
import { FaArrowRotateRight } from 'react-icons/fa6';
import { BsSkipBackwardCircle } from 'react-icons/bs';

import { BsZoomIn } from 'react-icons/bs';
import { BsZoomOut } from 'react-icons/bs';
import { TbZoomReset } from 'react-icons/tb';

const playButton = <FaRegCirclePlay fontSize="1rem" />;
const pauseButton = <FaRegCirclePause fontSize="1rem" />;
const backTenButton = <FaArrowRotateLeft fontSize="1rem" />;
const skipTenButton = <FaArrowRotateRight fontSize="1rem" />;
const skipStartButton = <BsSkipBackwardCircle fontSize="1rem" />;

import { formatTime } from '../../lib/dawUtils';

const SimpleDawControlsBottom = ({
  waveSurfer,
  playbackSpeed,
  speedSetter,
}) => {
  if (!waveSurfer) return '';

  const [zoomLevel, setZoomLevel] = useState(15);

  const onSkipTenFwd = useCallback(() => {
    waveSurfer.skip(10);
  });

  const onSkipTenBkwd = useCallback(() => {
    waveSurfer.skip(-10);
  });

  const onPlayPause = useCallback(() => {
    waveSurfer && waveSurfer.playPause();
  }, [waveSurfer]);

  const onStopSeekZero = useCallback(() => {
    waveSurfer.seekTo(0);
    waveSurfer.isPlaying() && waveSurfer.pause();
  });

  return (
    <div className="d-flex w-100 ml-auto mr-auto prog-bar align-items-center flex-between flex gap-0375">
      <div className="d-flex gap-0375 align-items-center">
        <Button onClick={onSkipTenBkwd} className="prog-button pl-2">
          {backTenButton}
        </Button>
        <Button className="prog-button" onClick={onStopSeekZero}>
          {skipStartButton}
        </Button>
        <Button onClick={onPlayPause} className="prog-button">
          {waveSurfer.isPlaying() ? pauseButton : playButton}
        </Button>
        <Button onClick={onSkipTenFwd} className="prog-button">
          {skipTenButton}
        </Button>
        <span
          className="pl-1 pt-0 pb-0 mt-0 mb-0"
          style={{ color: waveSurfer.isPlaying() ? 'aqua' : 'white' }}
        >
          {formatTime(waveSurfer.getCurrentTime())}
        </span>
      </div>

      <div className="d-flex gap-0375 align-items-center">
        <Button
          className="prog-button"
          onClick={() => {
            setZoomLevel(zoomLevel + 25);
            waveSurfer.zoom(zoomLevel);
          }}
        >
          <BsZoomIn fontSize="1rem" />
        </Button>

        <Button
          className="prog-button"
          onClick={() => {
            const zoom = zoomLevel - 25;
            setZoomLevel(zoom < 0 ? 0 : zoom);
            waveSurfer.zoom(zoomLevel);
          }}
        >
          <BsZoomOut fontSize="1rem" />
        </Button>

        <Button className="prog-button">
          <TbZoomReset
            fontSize="1rem"
            onClick={() => {
              setZoomLevel(0);
              waveSurfer.zoom(0);
            }}
          />
        </Button>
        <Dropdown
          className="pr-2"
          drop="up-centered"
          onSelect={(eventKey) => speedSetter(eventKey)}
        >
          <Dropdown.Toggle
            className="prog-button mt-0 mb-0 pt-0 pb-0"
            id="dropdown-basic"
          >
            <BsSpeedometer2 fontSize="1rem" />
          </Dropdown.Toggle>
          <Dropdown.Menu className="bg-daw-toolbars">
            <Dropdown.Item className="text-white" eventKey={2}>
              2x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey={1.75}>
              1.75x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey={1.5}>
              1.5x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey={1.25}>
              1.25x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey={1}>
              1x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey={0.75}>
              0.75x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey={0.5}>
              0.5x
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </div>
  );
};

export default SimpleDawControlsBottom;
