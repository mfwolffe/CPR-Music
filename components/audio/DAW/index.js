'use client';

import { useEffect } from 'react';
import { Card, CardBody, CardHeader, CardTitle, CardFooter, Button } from 'react-bootstrap';
import { useAudio, useEffects, useFFmpeg, useUI } from '../../../contexts/DAWProvider';
import Waveform from './Waveform';
import Transport from './Transport';
import Timeline from './Timeline';
import Effects from './Effects';
import HelpModal from '../daw-old/dawHelp';
import { GrHelpBook } from 'react-icons/gr';
import { PiWarningDuotone } from 'react-icons/pi';

// Width calculations for effects panels
const EQWIDTH = 28;
const ECHOWIDTH = 13;
const REVERBWIDTH = 15;
const CHRWIDTH = 18;

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
  const { eqPresent, rvbPresent, reverbPresent, chrPresent } = useEffects();
  const { loadFFmpeg, loaded: ffmpegLoaded } = useFFmpeg();
  const { showDAW, showHelp, setShowHelp, mapPresent } = useUI();
  
  // Initialize FFmpeg when component mounts
  useEffect(() => {
    if (!ffmpegLoaded) {
      loadFFmpeg();
    }
  }, [ffmpegLoaded, loadFFmpeg]);
  
  // Calculate waveform container width based on visible effects
  const waveformWidth = 100 - 
    (rvbPresent || eqPresent || reverbPresent || chrPresent ? 1.5 : 0) -
    (eqPresent ? EQWIDTH : 0) -
    (rvbPresent ? ECHOWIDTH : 0) -
    (reverbPresent ? REVERBWIDTH : 0) -
    (chrPresent ? CHRWIDTH : 0);
  
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
          <div className="d-flex w-100 gap-2p">
            <div
              id="waveform-container"
              style={{ width: `${waveformWidth}%` }}
            >
              <Timeline />
              <Waveform />
              <Transport />
            </div>
            
            <Effects />
          </div>
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