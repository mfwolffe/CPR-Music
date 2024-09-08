'use client';

import { useState, useCallback } from 'react';
import Button from 'react-bootstrap/Button';
import { Spinner } from 'react-bootstrap';

import { MdGroups } from 'react-icons/md';
import { IoArrowUndo } from 'react-icons/io5';
import { IoArrowRedo } from 'react-icons/io5';
import { IoCutOutline } from 'react-icons/io5';
import { MdOutlineWaves } from 'react-icons/md';
import { RiEqualizerLine } from 'react-icons/ri';
import { IoTrashOutline } from 'react-icons/io5';
import { RiSoundModuleFill } from 'react-icons/ri';

import { effectSliceRegions, restoreState } from '../../lib/dawUtils';

const icoSize = "1.25rem";
const dawSpinner = <Spinner animation="grow" size="sm" />;

const SimpleDawControlsTop = ({
  wavesurfer,
  mapPresent,
  mapSetter,
  eqPresent,
  eqSetter,
  rvbPresent,
  rvbSetter,
  cutRegion,
  ffmpegLoaded,
  chrPresent,
  chrSetter,
  editListIndex,
  editList,
  setEditList,
  setEditListIndex,
  setAudioURL,
  audioRef,
  ffmpegRef,
  audioURL,
}) => {
  if (!wavesurfer) return '';

  const [eqHvr, setEqHvr] = useState(false);
  const [mapHvr, setMapHvr] = useState(false);
  const [rvbHvr, setRvbHvr] = useState(false);
  const [chrHvr, setChrHvr] = useState(false);

  const handleMinimap = useCallback(() => {
    mapSetter(!mapPresent);
  });

  const toggleEQ = useCallback(() => {
    eqSetter(!eqPresent);
  });

  const toggleRvb = useCallback(() => {
    rvbSetter(!rvbPresent);
  });

  const toggleChorus = useCallback(() => {
    chrSetter(!chrPresent);
  });

  const sliceRegion = (keep) => {
    effectSliceRegions(
      cutRegion,
      ffmpegRef,
      setAudioURL,
      wavesurfer,
      setEditList,
      editList,
      setEditListIndex,
      editListIndex,
      audioRef,
      audioURL,
      keep
    );
  };

  return (
    <>
      <div className="d-flex w-100 ml-auto mr-auto pl-2 toolbar align-items-center flex-row flex-between gap-0375">
        <div className="d-flex gap-05 align-items-center">
          <Button className="prog-button" onClick={handleMinimap}>
            <MdOutlineWaves
              fontSize={icoSize}
              onPointerEnter={() => setMapHvr(true)}
              onPointerLeave={() => setMapHvr(false)}
              style={{ color: mapPresent || mapHvr ? 'aqua' : 'white' }}
            />
          </Button>
          <Button className="prog-button" onClick={toggleEQ}>
            <RiEqualizerLine
              fontSize={icoSize}
              onPointerEnter={() => setEqHvr(true)}
              onPointerLeave={() => setEqHvr(false)}
              style={{ color: eqPresent || eqHvr ? 'aqua' : 'white' }}
            />
          </Button>
          <Button className="prog-button" onClick={toggleRvb}>
            {ffmpegLoaded ? (
              <RiSoundModuleFill
                fontSize={icoSize}
                onPointerEnter={() => setRvbHvr(true)}
                onPointerLeave={() => setRvbHvr(false)}
                style={{ color: rvbPresent || rvbHvr ? 'aqua' : 'white' }}
              />
            ) : (
              dawSpinner
            )}
          </Button>
          <Button className="prog-button" onClick={toggleChorus}>
            {ffmpegLoaded ? (
              <MdGroups
                onPointerEnter={() => setChrHvr(true)}
                onPointerLeave={() => setChrHvr(false)}
                style={{ color: chrPresent || chrHvr ? 'aqua' : 'white' }}
                fontSize={icoSize}
              />
            ) : (
              dawSpinner
            )}
          </Button>
          <Button className="prog-button">
            {ffmpegLoaded ? (
              <IoCutOutline fontSize={icoSize} onClick={() => sliceRegion(true)} />
            ) : (
              dawSpinner
            )}
          </Button>
          <Button className="prog-button">
            {ffmpegLoaded ? (
              <IoTrashOutline
                fontSize={icoSize}
                onClick={() => sliceRegion(false)}
              />
            ) : (
              dawSpinner
            )}
          </Button>
        </div>
        <div className="d-flex align-items-center">
          <Button
            className="prog-button pr-2"
            onClick={() =>
              restoreState(
                editListIndex - 1,
                editList,
                setEditListIndex,
                wavesurfer
              )
            }
          >
            <IoArrowUndo fontSize={icoSize} />
          </Button>
          <Button
            className="prog-button pr-2"
            onClick={() =>
              restoreState(
                editListIndex + 1,
                editList,
                setEditListIndex,
                wavesurfer
              )
            }
          >
            <IoArrowRedo fontSize={icoSize} />
          </Button>
        </div>
      </div>
    </>
  );
};

export default SimpleDawControlsTop;
