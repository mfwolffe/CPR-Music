'use client';

import React, { useCallback, useState } from 'react';
import { Button, ButtonGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { MdOutlineWaves } from 'react-icons/md';
import { RiEqualizerLine } from 'react-icons/ri';
import { IoArrowUndo, IoTrashOutline, IoArrowRedo, IoCutOutline } from 'react-icons/io5';
import { useWaveform } from '../../../../contexts/WaveformContext';
import { useUI, useEffects, useAudio } from '../../../../contexts/DAWProvider';
import { cutRegionFromBuffer, spliceRegionFromBuffer } from '../../../../lib/effects/cutSpliceHelper';

export default function CustomTimeline() {
  const {
    activeRegion,
    clearRegions,
    audioBuffer,
    applyProcessedAudio,
    audioContext
  } = useWaveform();

  const {
    audioURL,
    wavesurferRef,
    addToEditHistory,
    undo,
    redo,
    canUndo,
    canRedo
  } = useAudio();

  const {
    setShowEffectsModal,
    mapPresent,
    setMapPresent,
    toggleMinimap
  } = useUI();

  const { setCutRegion } = useEffects();

  const [isProcessing, setIsProcessing] = useState(false);
  const [mapHvr, setMapHvr] = useState(false);
  const [effectsHvr, setEffectsHvr] = useState(false);

  const icoSize = "1.25rem";

  // Handle effects modal - only available when region exists
  const handleEffects = useCallback(() => {
    if (!activeRegion) {
      return; // Button will be disabled, so this shouldn't happen
    }
    // Set the cutRegion so effects know what region to apply to
    setCutRegion(activeRegion);
    setShowEffectsModal(true);
  }, [activeRegion, setShowEffectsModal, setCutRegion]);

  // Handle splice (excise) region - keep only the selected region
  const handleSplice = useCallback(async () => {
    if (!activeRegion || !audioBuffer) {
      alert('Please select a region first');
      return;
    }

    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // Keep only the selected region
      const splicedBuffer = spliceRegionFromBuffer(
        audioBuffer,
        activeRegion.start,
        activeRegion.end,
        audioContext
      );

      // Apply the spliced audio
      await applyProcessedAudio(splicedBuffer);

    } catch (error) {
      console.error('Error splicing region:', error);
      alert('Failed to splice region');
    } finally {
      setIsProcessing(false);
    }
  }, [activeRegion, audioBuffer, applyProcessedAudio, audioContext, isProcessing]);

  // Handle cut (delete) region - remove the selected region
  const handleCut = useCallback(async () => {
    if (!activeRegion || !audioBuffer) {
      alert('Please select a region first');
      return;
    }

    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // Remove the selected region
      const cutBuffer = cutRegionFromBuffer(
        audioBuffer,
        activeRegion.start,
        activeRegion.end,
        audioContext
      );

      // Apply the cut audio
      await applyProcessedAudio(cutBuffer);

    } catch (error) {
      console.error('Error cutting region:', error);
      alert('Failed to cut region');
    } finally {
      setIsProcessing(false);
    }
  }, [activeRegion, audioBuffer, applyProcessedAudio, audioContext, isProcessing]);

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

        {/* Effects Modal toggle - only enabled when region exists */}
        <Button
          className="prog-button"
          onClick={handleEffects}
          disabled={!activeRegion}
          title={!activeRegion ? "Select a region first" : "Open effects"}
        >
          <RiEqualizerLine
            fontSize={icoSize}
            onPointerEnter={() => setEffectsHvr(true)}
            onPointerLeave={() => setEffectsHvr(false)}
            style={{ color: effectsHvr ? 'aqua' : 'white' }}
          />
        </Button>

        {/* Cut/Delete region buttons */}
        <Button
          className="prog-button"
          onClick={handleSplice}
          disabled={!activeRegion || isProcessing}
          title="Excise - Keep selection, delete rest"
        >
          <IoCutOutline fontSize={icoSize} />
        </Button>
        <Button
          className="prog-button"
          onClick={handleCut}
          disabled={!activeRegion || isProcessing}
          title="Delete - Remove selection, splice ends"
        >
          <IoTrashOutline fontSize={icoSize} />
        </Button>
      </div>

      {/* Undo/Redo moved to right side */}
      <div className="d-flex align-items-center">
        <Button
          className="prog-button pr-2"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <IoArrowUndo fontSize={icoSize} />
        </Button>
        <Button
          className="prog-button pr-2"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <IoArrowRedo fontSize={icoSize} />
        </Button>
      </div>
    </div>
  );
}