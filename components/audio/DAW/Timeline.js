'use client';

import { useCallback, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { MdOutlineWaves, MdGroups } from 'react-icons/md';
import { RiSoundModuleFill, RiEqualizerLine } from 'react-icons/ri';
import { BiWater } from 'react-icons/bi';
import { IoArrowUndo, IoTrashOutline, IoArrowRedo, IoCutOutline } from 'react-icons/io5';
import { 
  useAudio, 
  useEffects, 
  useFFmpeg, 
  useUI 
} from '../../../contexts/DAWProvider';
import { effectSliceRegions } from '../../../lib/dawUtils';

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
    addToEditHistory,
    undo,
    redo,
    canUndo,
    canRedo
  } = useAudio();
  
  const {
    eqPresent,
    toggleEQ,
    rvbPresent,
    toggleReverb,
    reverbPresent,
    toggleReverbNew,
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
  
  // Add reverb hover state
  const [reverbHvr, setReverbHvr] = useState(false);
  
  const wavesurfer = wavesurferRef?.current;
  
  // Handle region slicing
  const sliceRegion = useCallback(async (keep) => {
    if (!cutRegion || !ffmpegLoaded || !wavesurfer) return;
    
    try {
      // Get the current audio URL from wavesurfer's media element
      const currentAudioURL = wavesurfer.getMediaElement()?.currentSrc || audioURL;
      
      // Create a wrapper for addToEditHistory that matches the old setEditList signature
      const setEditListWrapper = (newList) => {
        if (newList && newList.length > 0) {
          const newURL = newList[newList.length - 1];
          addToEditHistory(newURL, keep ? 'Cut Region' : 'Delete Region', {
            regionStart: cutRegion.start,
            regionEnd: cutRegion.end,
            keep: keep
          });
        }
      };
      
      await effectSliceRegions(
        cutRegion,
        ffmpegRef,
        setAudioURL,
        wavesurfer,
        setEditListWrapper,
        [], // editList - not used but kept for compatibility
        () => {}, // setEditListIndex - not used
        0, // editListIndex - not used
        audioRef,
        currentAudioURL, // Use the current URL from wavesurfer
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
    audioRef,
    audioURL,
    setCutRegion
  ]);
  
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
        
        {/* Echo toggle */}
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
        
        {/* Reverb toggle (new Web Audio reverb) */}
        <Button className="prog-button" onClick={toggleReverbNew}>
          <BiWater
            fontSize={icoSize}
            onPointerEnter={() => setReverbHvr(true)}
            onPointerLeave={() => setReverbHvr(false)}
            style={{ color: reverbPresent || reverbHvr ? 'aqua' : 'white' }}
          />
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
        <Button 
          className="prog-button pr-2" 
          onClick={undo}
          disabled={!canUndo}
        >
          <IoArrowUndo fontSize={icoSize} />
        </Button>
        <Button 
          className="prog-button pr-2" 
          onClick={redo}
          disabled={!canRedo}
        >
          <IoArrowRedo fontSize={icoSize} />
        </Button>
      </div>
    </div>
  );
}