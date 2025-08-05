'use client';

import { useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardBody, Button, Form } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects, 
  useFFmpeg 
} from '../../../../contexts/DAWProvider';
import { effectChorusReverb } from '../../../../lib/dawUtils';

/**
 * Echo effect component
 * Implements a simple echo/delay effect with feedback (decay)
 */
export default function Echo({ width }) {
  const {
    audioURL,
    setAudioURL,
    audioRef,
    wavesurferRef,
    editList,
    editListIndex,
    setEditListIndex,
    addToEditHistory
  } = useAudio();
  
  const {
    inGain,
    setInGain,
    outGain,
    setOutGain,
    delay,
    setDelay,
    decay,
    setDecay
  } = useEffects();
  
  const { ffmpegRef, loaded: ffmpegLoaded } = useFFmpeg();
  
  const wavesurfer = wavesurferRef?.current;
  
  const applyEcho = useCallback(async () => {
    if (!ffmpegLoaded || !wavesurfer) return;
    
    try {
      await effectChorusReverb(
        ffmpegRef,
        inGain,
        outGain,
        delay,
        decay,
        null, // speedChr
        null, // depthsChr
        audioRef,
        setAudioURL,
        audioURL,
        wavesurfer,
        (newList) => {
          addToEditHistory(newList[newList.length - 1]);
        },
        editList,
        setEditListIndex,
        editListIndex
      );
    } catch (error) {
      console.error('Error applying echo:', error);
    }
  }, [
    ffmpegLoaded,
    wavesurfer,
    ffmpegRef,
    inGain,
    outGain,
    delay,
    decay,
    audioRef,
    setAudioURL,
    audioURL,
    addToEditHistory,
    editList,
    setEditListIndex,
    editListIndex
  ]);
  
  return (
    <Card id="echo" style={{ width: `${width}%` }}>
      <CardHeader className="text-center text-white pt-1 pb-1 bg-daw-toolbars">
        <CardTitle className="pt-0 pb-0 mt-0 mb-0">Echo</CardTitle>
      </CardHeader>
      <CardBody className="bg-dawcontrol text-white plr-0 pt-2 pb-0 w-100">
        <div className="flex-even gap-0 mlr-a w-100 plr-0">
          {/* Input/Output Gain */}
          <div className="mb-0 pb-0">
            <div className="d-flex gap-025">
              <div>
                <input
                  min={0}
                  max={1}
                  step={0.001}
                  type="range"
                  orient="vertical"
                  className="mlr-auto"
                  defaultValue={0}
                  onInput={(e) => setInGain(parseFloat(e.target.value))}
                />
                <Form.Label className="d-block text-center mb-0">Input</Form.Label>
              </div>
              <div>
                <input
                  min={0}
                  max={1}
                  step={0.001}
                  type="range"
                  orient="vertical"
                  className="mlr-auto"
                  defaultValue={0}
                  onInput={(e) => setOutGain(parseFloat(e.target.value))}
                />
                <Form.Label className="d-block text-center mb-0">Output</Form.Label>
              </div>
            </div>
            <p className="text-center mt-0 mb-0">
              <strong>Gain</strong>
            </p>
          </div>
          
          {/* Delay Time / Feedback */}
          <div className="mb-0 pb-0">
            <div className="d-flex gap-025">
              <div>
                <input
                  min={0.1}
                  max={90000.0}
                  step={1}
                  type="range"
                  orient="vertical"
                  className="mlr-auto"
                  defaultValue={1000}
                  onInput={(e) => setDelay(parseFloat(e.target.value))}
                />
                <Form.Label className="d-block text-center mb-0">Time</Form.Label>
              </div>
              <div>
                <input
                  min={0.1}
                  max={1}
                  step={0.001}
                  type="range"
                  orient="vertical"
                  className="mlr-auto"
                  defaultValue={0.1}
                  onInput={(e) => setDecay(parseFloat(e.target.value))}
                />
                <Form.Label className="d-block text-center mb-0">Feedback</Form.Label>
              </div>
            </div>
            <p className="text-center mt-0 mb-0">
              <strong>Echo</strong>
            </p>
          </div>
        </div>
        
        <div className="d-flex justify-content-end">
          <Button
            size="sm"
            className="mb-0 mr-2 mt-1"
            onClick={applyEcho}
            disabled={!ffmpegLoaded}
          >
            Apply
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}