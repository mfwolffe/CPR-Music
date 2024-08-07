import { useState, useCallback } from 'react';
import Button from 'react-bootstrap/Button';

import { BsZoomIn } from 'react-icons/bs';
import { BsZoomOut } from 'react-icons/bs';
import { TbZoomReset } from 'react-icons/tb';
import { MdOutlineWaves } from 'react-icons/md';

const SimpleDawControlsTop = ({ waveSurfer, mapPresent, mapSetter }) => {
  if (!waveSurfer) return '';

  const [hvr, setHvr] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(15);

  const handleMinimap = useCallback(() => {
    mapSetter(!mapPresent);
  });

  return (
    <>
      <div className="d-flex w-100 ml-auto mr-auto pl-2 toolbar align-items-center flex-row gap-0375">
        <Button className="prog-button" onClick={handleMinimap}>
          <MdOutlineWaves
            fontSize="1rem"
            onPointerEnter={() => setHvr(true)}
            onPointerLeave={() => setHvr(false)}
            style={{ color: mapPresent || hvr ? 'aqua' : 'white' }}
          />
        </Button>
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
      </div>
    </>
  );
};

export default SimpleDawControlsTop;
