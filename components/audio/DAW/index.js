'use client';

import { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader, CardTitle, CardFooter, Button, ButtonGroup } from 'react-bootstrap';
import { useAudio, useEffects, useFFmpeg, useUI, useMultitrack } from '../../../contexts/DAWProvider';
import Waveform from './Waveform';
import Transport from './Transport';
import Timeline from './Timeline';
import EffectsRack from './Effects/EffectsRack';
import MultitrackDAW from './Multitrack/MultitrackDAW';
import HelpModal from '../daw-old/dawHelp';
import { GrHelpBook } from 'react-icons/gr';
import { PiWarningDuotone } from 'react-icons/pi';
import { MdLayers, MdLayersClear } from 'react-icons/md';

/**
 * Main DAW component that can switch between single-track and multitrack modes
 */
export default function DAW({ 
  onSubmit, 
  showSubmitButton = false,
  silenceWarning = false,
  defaultMode = 'single' // 'single' or 'multi'
}) {
  const { audioURL, wavesurferRef } = useAudio();
  const { loadFFmpeg, loaded: ffmpegLoaded } = useFFmpeg();
  const { showDAW, showHelp, setShowHelp, mapPresent, useEffectsRack } = useUI();
  const { tracks } = useMultitrack();
  
  // Track editing mode
  const [mode, setMode] = useState(defaultMode);
  
  // Initialize FFmpeg when component mounts
  useEffect(() => {
    if (!ffmpegLoaded) {
      loadFFmpeg();
    }
  }, [ffmpegLoaded, loadFFmpeg]);
  
  // Auto-switch to multitrack if tracks have audio
  useEffect(() => {
    if (tracks.length > 0 && tracks.some(t => t.audioURL)) {
      setMode('multi');
    }
  }, [tracks]);
  
  if (!showDAW) return null;
  
  // Render multitrack mode
  if (mode === 'multi') {
    return (
      <MultitrackDAW 
        onSubmit={onSubmit}
        showSubmitButton={showSubmitButton}
        onModeSwitch={setMode}
      />
    );
  }
  
  // Render single-track mode
  return (
    <>
      <HelpModal setFn={setShowHelp} shown={showHelp} />
      
      <Card className="mt-2 mb-2" id="daw-card">
        <CardHeader className="pt-1 pb-1 flex-between dawHeaderFooter align-items-center">
          <div className="d-flex align-items-center gap-2">
            <CardTitle className="pt-0 pb-0 mt-0 mb-0">
              Audio Editor
            </CardTitle>
            
            {/* Mode switcher */}
            <ButtonGroup size="sm">
              <Button
                variant="primary"
                title="Single track mode"
                disabled
              >
                <MdLayersClear fontSize="1rem" />
              </Button>
              <Button
                variant="secondary"
                onClick={() => setMode('multi')}
                title="Multitrack mode"
              >
                <MdLayers fontSize="1rem" />
              </Button>
            </ButtonGroup>
          </div>
          
          <div className="d-flex gap-2">
            {mapPresent && (
              <Button
                className="help-button"
                variant="none"
                size="sm"
              >
                <GrHelpBook fontSize="1.25rem" />
              </Button>
            )}
            
            {silenceWarning && (
              <Button
                className="prog-button"
                size="sm"
                variant="none"
              >
                <PiWarningDuotone className="progIco help-ico" fontSize="1.5rem" />
              </Button>
            )}
            
            <Button
              className="help-button"
              size="sm"
              onClick={() => setShowHelp(true)}
            >
              <GrHelpBook fontSize="1.25rem" />
            </Button>
          </div>
        </CardHeader>
        
        <CardBody>
          {audioURL && (
            <>
              <Timeline />
              <div id="waveform-container">
                <Waveform />
              </div>
              <Transport />
            </>
          )}
          
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
              onClick={() => {
                if (onSubmit) {
                  onSubmit(audioURL);
                }
              }}
            >
              Submit Edited Audio
            </Button>
          </CardFooter>
        )}
      </Card>
    </>
  );
}