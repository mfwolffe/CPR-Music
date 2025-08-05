'use client';

import { useCallback } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { MdOutlineWaves, MdGroups } from 'react-icons/md';
import { RiSoundModuleFill, RiEqualizerLine } from 'react-icons/ri';
import { IoArrowUndo, IoTrashOutline, IoArrowRedo, IoCutOutline } from 'react-icons/io5';
import { 
  useAudio, 
  useEffects, 
  useFFmpeg, 
  useUI 
} from '../../../contexts/DAWProvider';
import { effectSliceRegions, restoreState } from '../../../lib/dawUtils';

const icoSize = "1.25rem";
const dawSpinner = <Spinner animation="grow" size="sm" />;

/**
 * Timeline toolbar with effects toggles and edit controls
 */
export default function Timeline() {
  const { 
    wavesurferRef,
    audioURL,
    setAudioURL,
    audioRef,
    editList,
    editListIndex,
    setEditListIndex,
    addToEditHistory,
    restoreFromHistory
  } = useAudio();
  
  const {
    eqPresent,
    toggleEQ,
    rvbPresent,
    toggleReverb,
    chrPresent,
    toggleChorus,
    cutRegion,
    setCutRegion
  } = useEffects();
  
  const { ffmpegRef, loaded: ffmpegLoaded } = useFFmpeg();
  
  const {
    mapPresent,
    toggleMinimap,
    eqHvr,
    setEqHvr,
    mapHvr,
    setMapHvr,
    rvbHvr,
    setRvbHvr,
    chrHvr,
    setChrHvr
  } = useUI();
  
  const wavesurfer = wavesurferRef?.current;
  
  // Handle region slicing
  const sliceRegion = useCallback(async (keep) => {
    if (!cutRegion || !ffmpegLoaded || !wavesurfer) return;
    
    try {
      await effectSliceRegions(
        cutRegion,
        ffmpegRef,
        setAudioURL,
        wavesurfer,
        addToEditHistory,
        editList,
        setEditListIndex,
        editListIndex,
        audioRef,
        audioURL,
        keep
      );
      
      cutRegion.remove();
      setCutRegion(null);
    } catch (error) {
      console.error('Error slicing region:', error);
    }
  }, [
    cutRegion, 
    ffmpegLoaded, 
    wavesurfer, 
    ffmpegRef, 
    setAudioURL, 
    addToEditHistory,
    editList,
    setEditListIndex,
    editListIndex,
    audioRef,
    audioURL,
    setCutRegion
  ]);
  
  // Handle undo/redo
  const handleUndo = useCallback(() => {
    const url = restoreFromHistory(editListIndex - 1);
    if (url && wavesurfer) {
      wavesurfer.load(url);
    }
  }, [editListIndex, restoreFromHistory, wavesurfer]);
  
  const handleRedo = useCallback(() => {
    const url = restoreFromHistory(editListIndex + 1);
    if (url && wavesurfer) {
      wavesurfer.load(url);
    }
  }, [editListIndex, restoreFromHistory, wavesurfer]);
  
  if (!wavesurfer) return null;
  
  return (
    <div className="d-flex w-100 ml-auto mr-auto pl-2 toolbar align-items-center flex-row flex-between gap-0375">
      <div className="d-flex gap-05 align-items-center">
        {/* Minimap toggle */}
        <Button className="prog-button" onClick={toggleMinimap}>
          <MdOutlineWaves
            fontSize={icoSize}
            onPointerEnter={() => setMapHvr(true)}
            onPointerLeave={() => setMapHvr(false)}
            style={{ color: mapPresent || mapHvr ? 'aqua' : 'white' }}
          />
        </Button>
        
        {/* EQ toggle */}
        <Button className="prog-button" onClick={toggleEQ}>
          <RiEqualizerLine
            fontSize={icoSize}
            onPointerEnter={() => setEqHvr(true)}
            onPointerLeave={() => setEqHvr(false)}
            style={{ color: eqPresent || eqHvr ? 'aqua' : 'white' }}
          />
        </Button>
        
        {/* Reverb toggle */}
        <Button className="prog-button" onClick={toggleReverb}>
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
        
        {/* Chorus toggle */}
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
        
        {/* Cut/Delete region buttons */}
        <Button className="prog-button" onClick={() => sliceRegion(true)}>
          {ffmpegLoaded ? (
            <IoCutOutline fontSize={icoSize} />
          ) : (
            dawSpinner
          )}
        </Button>
        <Button className="prog-button" onClick={() => sliceRegion(false)}>
          {ffmpegLoaded ? (
            <IoTrashOutline fontSize={icoSize} />
          ) : (
            dawSpinner
          )}
        </Button>
      </div>
      
      {/* Undo/Redo */}
      <div className="d-flex align-items-center">
        <Button className="prog-button pr-2" onClick={handleUndo}>
          <IoArrowUndo fontSize={icoSize} />
        </Button>
        <Button className="prog-button pr-2" onClick={handleRedo}>
          <IoArrowRedo fontSize={icoSize} />
        </Button>
      </div>
    </div>
  );
}