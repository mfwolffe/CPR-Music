import { useState, useCallback } from 'react';
import Button from 'react-bootstrap/Button';
import { Spinner } from 'react-bootstrap';

import { MdGroups } from 'react-icons/md';
import { IoCutOutline } from 'react-icons/io5';
import { MdOutlineWaves } from 'react-icons/md';
import { RiEqualizerLine } from 'react-icons/ri';
import { IoTrashOutline } from 'react-icons/io5';
import { RiSoundModuleFill } from 'react-icons/ri';

const SimpleDawControlsTop = ({
  waveSurfer,
  mapPresent,
  mapSetter,
  eqPresent,
  eqSetter,
  rvbPresent,
  rvbSetter,
  transcoder,
  cutRegion,
  destroyRegion,
  ffmpegLoaded,
  chrPresent,
  chrSetter,
}) => {
  if (!waveSurfer) return '';

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

  const dawSpinner = <Spinner animation="grow" size="sm" />;

  return (
    <>
      <div className="d-flex w-100 ml-auto mr-auto pl-2 toolbar align-items-center flex-row gap-0375">
        <Button className="prog-button" onClick={handleMinimap}>
          <MdOutlineWaves
            fontSize="1rem"
            onPointerEnter={() => setMapHvr(true)}
            onPointerLeave={() => setMapHvr(false)}
            style={{ color: mapPresent || mapHvr ? 'aqua' : 'white' }}
          />
        </Button>

        <Button className="prog-button" onClick={toggleEQ}>
          <RiEqualizerLine
            fontSize="1rem"
            onPointerEnter={() => setEqHvr(true)}
            onPointerLeave={() => setEqHvr(false)}
            style={{ color: eqPresent || eqHvr ? 'aqua' : 'white' }}
          />
        </Button>

        <Button className="prog-button" onClick={toggleRvb}>
          {ffmpegLoaded ? (
            <RiSoundModuleFill
              fontSize="1rem"
              onPointerEnter={() => setRvbHvr(true)}
              onPointerLeave={() => setRvbHvr(false)}
              style={{ color: rvbPresent || rvbHvr ? 'aqua' : 'white' }}
            />
          ) : (
            dawSpinner
          )}
        </Button>

        <Button className="prog-button" onClick={() => toggleChorus(cutRegion)}>
          {ffmpegLoaded ? (
            <MdGroups
              onPointerEnter={() => setChrHvr(true)}
              onPointerLeave={() => setChrHvr(false)}
              style={{ color: chrPresent || chrHvr ? 'aqua' : 'white' }}
              fontSize="1rem"
            />
          ) : (
            dawSpinner
          )}
        </Button>

        <Button className="prog-button">
          {ffmpegLoaded ? (
            <IoCutOutline
              fontSize="1rem"
              onClick={() => transcoder(cutRegion)}
            />
          ) : (
            dawSpinner
          )}
        </Button>

        <Button className="prog-button">
          {ffmpegLoaded ? (
            <IoTrashOutline
              fontSize="1rem"
              onClick={() => destroyRegion(cutRegion)}
            />
          ) : (
            dawSpinner
          )}
        </Button>
      </div>
    </>
  );
};

export default SimpleDawControlsTop;
