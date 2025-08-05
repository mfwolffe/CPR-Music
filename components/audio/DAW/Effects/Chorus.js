'use client';

import { useCallback } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects, 
  useFFmpeg 
} from '../../../../contexts/DAWProvider';
import { effectChorusReverb } from '../../../../lib/dawUtils';
import Knob from '../../../Knob';

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
    setEditListIndex,
    addToEditHistory
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
    <Container fluid className="p-3">
      <Row className="text-center">
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={inGainChr}
            onChange={setInGainChr}
            min={0}
            max={1}
            label="Input"
            displayValue={inGainChr.toFixed(2)}
            size={50}
            color="#92ce84"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={outGainChr}
            onChange={setOutGainChr}
            min={0}
            max={1}
            label="Output"
            displayValue={outGainChr.toFixed(2)}
            size={50}
            color="#92ce84"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={delayChr}
            onChange={setDelayChr}
            min={0}
            max={70}
            step={0.1}
            label="Delay"
            displayValue={`${delayChr.toFixed(1)}ms`}
            size={50}
            color="#7bafd4"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={decayChr}
            onChange={setDecayChr}
            min={0.01}
            max={1}
            label="Decay"
            displayValue={decayChr.toFixed(2)}
            size={50}
            color="#cbb677"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={speedChr}
            onChange={setSpeedChr}
            min={0.1}
            max={10}
            step={0.1}
            label="Speed"
            displayValue={`${speedChr.toFixed(1)}Hz`}
            size={50}
            color="#e75b5c"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={depthsChr}
            onChange={setDepthsChr}
            min={0.01}
            max={4}
            label="Depth"
            displayValue={depthsChr.toFixed(2)}
            size={50}
            color="#e75b5c"
          />
        </Col>
      </Row>
      
      <Row className="mt-3">
        <Col className="text-center">
          <Button
            size="sm"
            onClick={applyChorus}
            disabled={!ffmpegLoaded}
          >
            Apply Chorus
          </Button>
        </Col>
      </Row>
    </Container>
  );
}