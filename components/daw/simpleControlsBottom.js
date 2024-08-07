import { useCallback } from 'react';
import { Button } from 'react-bootstrap';
import { FaRegCircleStop } from 'react-icons/fa6';
import { FaRegCirclePlay } from 'react-icons/fa6';
import { FaRegCirclePause } from 'react-icons/fa6';
import { FaArrowRotateLeft } from 'react-icons/fa6';
import { FaArrowRotateRight } from 'react-icons/fa6';

const stopButton = <FaRegCircleStop fontSize="1rem" />;
const playButton = <FaRegCirclePlay fontSize="1rem" />;
const pauseButton = <FaRegCirclePause fontSize="1rem" />;
const backTenButton = <FaArrowRotateLeft fontSize="1rem" />;
const skipTenButton = <FaArrowRotateRight fontSize="1rem" />;

const formatTime = (seconds) =>
  [seconds / 60, seconds % 60]
    .map((v) => `0${Math.floor(v)}`.slice(-2))
    .join(':');

const SimpleDawControlsBottom = ({ waveSurfer }) => {
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
      <Button onClick={onSkipTenBkwd} className="pl-2 prog-button">
        {backTenButton}
      </Button>

      <Button className="prog-button" onClick={onStopSeekZero}>
        {stopButton}
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
