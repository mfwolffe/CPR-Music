'use client';

import { useEffect } from 'react';
import { Card, CardBody, CardHeader, CardTitle, CardFooter, Button } from 'react-bootstrap';
import { useAudio, useEffects, useFFmpeg, useUI } from '../../../contexts/DAWProvider';
import Waveform from './Waveform';
import Transport from './Transport';
import Timeline from './Timeline';
import EffectsRack from './Effects/EffectsRack';
import HelpModal from '../daw-old/dawHelp';
import { GrHelpBook } from 'react-icons/gr';
import { PiWarningDuotone } from 'react-icons/pi';

/**
 * Main DAW component that orchestrates all the audio editing functionality
 * This is a unified component that can be used standalone or within the recorder
 */
export default function DAW({ 
  onSubmit, 
  showSubmitButton = false,
  silenceWarning = false 
}) {
  const { audioURL, wavesurferRef } = useAudio();
  const { loadFFmpeg, loaded: ffmpegLoaded } = useFFmpeg();
  const { showDAW, showHelp, setShowHelp, mapPresent, useEffectsRack } = useUI();
  
  // Initialize FFmpeg when component mounts
  useEffect(() => {
    if (!ffmpegLoaded) {
      loadFFmpeg();
    }
  }, [ffmpegLoaded, loadFFmpeg]);
  
  if (!showDAW) return null;
  
  return (
    <>
      <HelpModal setFn={setShowHelp} shown={showHelp} />
      
      <Card className="mt-2 mb-2" id="daw-card">
        <CardHeader className="pt-1 pb-1 flex-between dawHeaderFooter align-items-center">
          <CardTitle className="pt-0 pb-0 mt-0 mb-0">
            Audio Editor
          </CardTitle>
          <Button
            className="help-button daw-help align-center"
            onClick={() => setShowHelp(true)}
          >
            <GrHelpBook className="help-ico" fontSize="1.5rem" />
          </Button>
        </CardHeader>
        
        <CardBody style={{ background: 'lightsteelblue' }}>
          {/* Main waveform area - full width */}
          <div id="waveform-container" style={{ width: '100%' }}>
            <Timeline />
            <Waveform />
            <Transport />
          </div>
          
          {/* Effects rack below waveform when toggled */}
          {useEffectsRack && (
            <div className="mt-3">
              <EffectsRack width={100} />
            </div>
          )}
        </CardBody>
        
        {showSubmitButton && (
          <CardFooter className="dawHeaderFooter">
            <Button
              style={{ float: 'right' }}
              onClick={() => onSubmit && onSubmit(audioURL)}
            >
              Submit{' '}
              {silenceWarning && <PiWarningDuotone />}
            </Button>
          </CardFooter>
        )}
      </Card>
    </>
  );
}