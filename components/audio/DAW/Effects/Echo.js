'use client';

import { useCallback } from 'react';
import { Container, Row, Col, Button, Form } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects, 
  useFFmpeg 
} from '../../../../contexts/DAWProvider';
import { effectChorusReverb } from '../../../../lib/dawUtils';
import Knob from '../../../Knob';

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
    <Container fluid className="p-3">
      <Row className="text-center">
        <Col xs={6} md={3}>
          <Knob
            value={inGain}
            onChange={setInGain}
            min={0}
            max={1}
            label="Input Gain"
            displayValue={inGain.toFixed(2)}
            size={50}
            color="#92ce84"
          />
        </Col>
        
        <Col xs={6} md={3}>
          <Knob
            value={outGain}
            onChange={setOutGain}
            min={0}
            max={1}
            label="Output Gain"
            displayValue={outGain.toFixed(2)}
            size={50}
            color="#92ce84"
          />
        </Col>
        
        <Col xs={6} md={3}>
          <Knob
            value={delay}
            onChange={setDelay}
            min={0.1}
            max={2000}
            step={1}
            label="Delay Time"
            displayValue={`${delay.toFixed(0)}ms`}
            size={50}
            color="#7bafd4"
          />
        </Col>
        
        <Col xs={6} md={3}>
          <Knob
            value={decay}
            onChange={setDecay}
            min={0.1}
            max={1}
            label="Feedback"
            displayValue={`${Math.round(decay * 100)}%`}
            size={50}
            color="#cbb677"
          />
        </Col>
      </Row>
      
      <Row className="mt-3">
        <Col className="text-center">
          <Button
            size="sm"
            onClick={applyEcho}
            disabled={!ffmpegLoaded}
          >
            Apply Echo
          </Button>
        </Col>
      </Row>
    </Container>
  );
}