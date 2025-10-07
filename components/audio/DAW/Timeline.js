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
  useUI
} from '../../../contexts/DAWProvider';
import { effectSliceRegionsWebAudio } from '../../../lib/dawUtils';

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
    cutRegion,
    setCutRegion
  } = useEffects();

  const {
    mapPresent,
    toggleMinimap,
    mapHvr,
    setMapHvr,
    useEffectsRack,
    setUseEffectsRack,
    setShowEffectsModal
  } = useUI();

  // Add state for effects button hover
  const [effectsHvr, setEffectsHvr] = useState(false);
  
  const wavesurfer = wavesurferRef?.current;
  
  // Handle region slicing using Web Audio API
  const sliceRegion = useCallback(async (keep) => {
    if (!cutRegion || !wavesurfer) return;

    try {
      // Get the current audio URL from wavesurfer's media element
      const currentAudioURL = wavesurfer.getMediaElement()?.currentSrc || audioURL;

      // Create a wrapper for addToEditHistory
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

      // Use Web Audio API implementation (no FFmpeg needed!)
      await effectSliceRegionsWebAudio(
        cutRegion,
        setAudioURL,
        wavesurfer,
        setEditListWrapper,
        audioRef,
        currentAudioURL,
        keep
      );

      cutRegion.remove();
      setCutRegion(null);
    } catch (error) {
      console.error('Error slicing region:', error);
    }
  }, [
    cutRegion,
    wavesurfer,
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
        
        {/* Effects Modal toggle - single button */}
        <Button className="prog-button" onClick={() => setShowEffectsModal(true)}>
          <RiEqualizerLine
            fontSize={icoSize}
            onPointerEnter={() => setEffectsHvr(true)}
            onPointerLeave={() => setEffectsHvr(false)}
            style={{ color: effectsHvr ? 'aqua' : 'white' }}
          />
        </Button>
        
        {/* Cut/Delete region buttons - now using Web Audio API */}
        <Button
          className="prog-button"
          onClick={() => sliceRegion(true)}
          disabled={!cutRegion}
          title="Excise - Keep selection, delete rest"
        >
          <IoCutOutline fontSize={icoSize} />
        </Button>
        <Button
          className="prog-button"
          onClick={() => sliceRegion(false)}
          disabled={!cutRegion}
          title="Delete - Remove selection, splice ends"
        >
          <IoTrashOutline fontSize={icoSize} />
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