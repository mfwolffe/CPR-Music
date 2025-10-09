'use client';

import { useCallback, useEffect } from 'react';
import { Button } from 'react-bootstrap';
import { useSingleTrack, useAudio, useEffects, useUI } from '../../../../contexts/DAWProvider';
import { effectSliceRegionsWebAudio } from '../../../../lib/dawUtils';
import { RiEqualizerLine } from 'react-icons/ri';
import { IoArrowUndo, IoTrashOutline, IoArrowRedo, IoCutOutline } from 'react-icons/io5';
import { MdOutlineWaves } from 'react-icons/md';

const icoSize = "1.25rem";

export default function SingleTrackTimeline() {
  const {
    region,
    setRegion,
    audioURL,
    audioElementRef,
    addToEditHistory: singleAddToEditHistory,
  } = useSingleTrack();

  const {
    setAudioURL,
    audioRef,
    undo,
    redo,
    canUndo,
    canRedo
  } = useAudio();

  const {
    setCutRegion
  } = useEffects();

  const {
    setShowEffectsModal,
    mapPresent,
    toggleMinimap
  } = useUI();

  // Sync region to effects context when it changes
  // Effects expect a region with start/end properties
  useEffect(() => {
    if (region) {
      // Create a compatible region object with remove method
      const compatibleRegion = {
        start: region.start,
        end: region.end,
        remove: () => setRegion(null) // Allow effects to clear the region
      };
      setCutRegion(compatibleRegion);
    } else {
      setCutRegion(null);
    }
  }, [region, setCutRegion, setRegion]);

  // Handle region slicing using Web Audio API
  const sliceRegion = useCallback(async (keep) => {
    if (!region) return;

    try {
      // Create a wrapper for addToEditHistory
      const setEditListWrapper = (newList) => {
        if (newList && newList.length > 0) {
          const newURL = newList[newList.length - 1];
          singleAddToEditHistory(newURL, keep ? 'Cut Region' : 'Delete Region', {
            regionStart: region.start,
            regionEnd: region.end,
            keep: keep
          });
        }
      };

      // Create compatible region for splice function
      const compatibleRegion = {
        start: region.start,
        end: region.end,
        remove: () => setRegion(null)
      };

      // Use Web Audio API implementation (no FFmpeg needed!)
      // Note: effectSliceRegionsWebAudio expects wavesurfer, but we'll adapt
      await effectSliceRegionsWebAudio(
        compatibleRegion,
        setAudioURL,
        null, // wavesurfer - not needed for direct processing
        setEditListWrapper,
        audioRef,
        audioURL,
        keep
      );

      setRegion(null);
    } catch (error) {
      console.error('Error slicing region:', error);
    }
  }, [
    region,
    setAudioURL,
    singleAddToEditHistory,
    audioRef,
    audioURL,
    setRegion
  ]);

  return (
    <div className="d-flex w-100 ml-auto mr-auto pl-2 toolbar align-items-center flex-row flex-between gap-0375">
      <div className="d-flex gap-05 align-items-center">
        {/* Effects Modal toggle */}
        <Button className="prog-button" onClick={() => setShowEffectsModal(true)}>
          <RiEqualizerLine fontSize={icoSize} style={{ color: 'white' }} />
        </Button>

        {/* Minimap toggle */}
        <Button
          className={`prog-button ${mapPresent ? 'active' : ''}`}
          onClick={toggleMinimap}
          title="Toggle minimap"
        >
          <MdOutlineWaves fontSize={icoSize} />
        </Button>

        {/* Cut/Delete region buttons */}
        <Button
          className="prog-button"
          onClick={() => sliceRegion(true)}
          disabled={!region}
          title="Excise - Keep selection, delete rest"
        >
          <IoCutOutline fontSize={icoSize} />
        </Button>
        <Button
          className="prog-button"
          onClick={() => sliceRegion(false)}
          disabled={!region}
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
