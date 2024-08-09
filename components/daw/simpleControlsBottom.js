import { useCallback } from 'react';

import { BsSpeedometer2 } from 'react-icons/bs';
import { FaRegCirclePlay } from 'react-icons/fa6';
import { FaRegCirclePause } from 'react-icons/fa6';
import { Button, Dropdown } from 'react-bootstrap';
import { FaArrowRotateLeft } from 'react-icons/fa6';
import { FaArrowRotateRight } from 'react-icons/fa6';
import { BsSkipBackwardCircle } from 'react-icons/bs';

const playButton = <FaRegCirclePlay fontSize="1rem" />;
const pauseButton = <FaRegCirclePause fontSize="1rem" />;
const backTenButton = <FaArrowRotateLeft fontSize="1rem" />;
const skipTenButton = <FaArrowRotateRight fontSize="1rem" />;
const skipStartButton = <BsSkipBackwardCircle fontSize="1rem" />;

const formatTime = (seconds) =>
  [seconds / 60, seconds % 60]
    .map((v) => `0${Math.floor(v)}`.slice(-2))
    .join(':');

const SimpleDawControlsBottom = ({
  waveSurfer,
  playbackSpeed,
  speedSetter,
}) => {
  if (!waveSurfer) return '';

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
    <div className="d-flex w-100 ml-auto mr-auto prog-bar align-items-center flex-row gap-0375">
      <Dropdown
        className="pl-2"
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

      <Button onClick={onSkipTenBkwd} className="prog-button">
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
  );
};

export default SimpleDawControlsBottom;
