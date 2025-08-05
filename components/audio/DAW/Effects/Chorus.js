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
 * Chorus effect component
 */
export default function Chorus({ width }) {
  const {
    audioURL,
    setAudioURL,
    audioRef,
    wavesurferRef,
    editList,
    editListIndex,
    addToEditHistory,
    setEditListIndex
  } = useAudio();
  
  const {
    inGainChr,
    setInGainChr,
    outGainChr,
    setOutGainChr,
    delayChr,
    setDelayChr,
    decayChr,
    setDecayChr,
    speedChr,
    setSpeedChr,
    depthsChr,
    setDepthsChr
  } = useEffects();
  
  const { ffmpegRef, loaded: ffmpegLoaded } = useFFmpeg();
  
  const wavesurfer = wavesurferRef?.current;
  
  const applyChorus = useCallback(async () => {
    if (!ffmpegLoaded || !wavesurfer) return;
    
    try {
      await effectChorusReverb(
        ffmpegRef,
        inGainChr,
        outGainChr,
        delayChr,
        decayChr,
        speedChr,
        depthsChr,
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
      console.error('Error applying chorus:', error);
    }
  }, [
    ffmpegLoaded,
    wavesurfer,
    ffmpegRef,
    inGainChr,
    outGainChr,
    delayChr,
    decayChr,
    speedChr,
    depthsChr,
    audioRef,
    setAudioURL,
    audioURL,
    addToEditHistory,
    editList,
    setEditListIndex,
    editListIndex
  ]);
  
  return (
    <Card id="chorus" style={{ width: `${width}%` }}>
      <CardHeader className="text-center text-white pt-1 pb-1 bg-daw-toolbars">
        <CardTitle className="pt-0 pb-0 mt-0 mb-0">Chorus</CardTitle>
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
                  onInput={(e) => setInGainChr(parseFloat(e.target.value))}
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
                  onInput={(e) => setOutGainChr(parseFloat(e.target.value))}
                />
                <Form.Label className="d-block text-center mb-0">Output</Form.Label>
              </div>
            </div>
            <p className="text-center mt-0 mb-0">
              <strong>Gain</strong>
            </p>
          </div>
          
          {/* Delay/Decay */}
          <div className="mb-0 pb-0">
            <div className="d-flex gap-025">
              <div>
                <input
                  min={0}
                  max={70}
                  step={0.1}
                  type="range"
                  orient="vertical"
                  className="mlr-auto"
                  defaultValue={0}
                  onInput={(e) => setDelayChr(parseFloat(e.target.value))}
                />
                <Form.Label className="d-block text-center mb-0">Delay</Form.Label>
              </div>
              <div>
                <input
                  min={0.01}
                  max={1}
                  step={0.001}
                  type="range"
                  orient="vertical"
                  className="mlr-auto"
                  defaultValue={0.01}
                  onInput={(e) => setDecayChr(parseFloat(e.target.value))}
                />
                <Form.Label className="d-block text-center mb-0">Decay</Form.Label>
              </div>
            </div>
          </div>
          
          {/* Speed/Depth */}
          <div className="mb-0 pb-0">
            <div className="d-flex gap-025">
              <div>
                <input
                  min={0.1}
                  max={90000.0}
                  step={0.1}
                  type="range"
                  orient="vertical"
                  className="mlr-auto"
                  defaultValue={1000}
                  onInput={(e) => setSpeedChr(parseFloat(e.target.value))}
                />
                <Form.Label className="d-block text-center mb-0">Speed</Form.Label>
              </div>
              <div>
                <input
                  min={0.01}
                  max={4}
                  step={0.001}
                  type="range"
                  orient="vertical"
                  className="mlr-auto"
                  defaultValue={1}
                  onInput={(e) => setDepthsChr(parseFloat(e.target.value))}
                />
                <Form.Label className="d-block text-center mb-0">Depth</Form.Label>
              </div>
            </div>
          </div>
        </div>
        
        <div className="d-flex justify-content-end">
          <Button
            size="sm"
            className="mb-0 mr-2 mt-1"
            onClick={applyChorus}
            disabled={!ffmpegLoaded}
          >
            Apply
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}