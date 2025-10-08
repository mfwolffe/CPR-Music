/**
 * Clip Compressor Effect
 */

'use client';

import { useState, useCallback } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import Knob from '../../../../Knob';

export default function ClipCompressor({ parameters, onParametersChange }) {
  const [threshold, setThreshold] = useState(parameters.threshold || -24);
  const [ratio, setRatio] = useState(parameters.ratio || 4);
  const [attack, setAttack] = useState(parameters.attack || 0.003);
  const [release, setRelease] = useState(parameters.release || 0.1);
  const [knee, setKnee] = useState(parameters.knee || 30);
  const [makeup, setMakeup] = useState(parameters.makeup || 0);

  const updateParameter = useCallback((key, value) => {
    const newParams = { ...parameters, [key]: value };
    onParametersChange(newParams);
  }, [parameters, onParametersChange]);

  return (
    <Container fluid className="p-3">
      <Row>
        <Col xs={6} md={4}>
          <div className="text-center">
            <Knob value={threshold} onChange={(val) => { setThreshold(val); updateParameter('threshold', val); }}
              min={-60} max={0} step={1} label="Threshold" displayValue={`${threshold}dB`} size={70} color="#e75b5c" />
          </div>
        </Col>
        <Col xs={6} md={4}>
          <div className="text-center">
            <Knob value={ratio} onChange={(val) => { setRatio(val); updateParameter('ratio', val); }}
              min={1} max={20} step={0.1} label="Ratio" displayValue={`${ratio.toFixed(1)}:1`} size={70} color="#7bafd4" />
          </div>
        </Col>
        <Col xs={6} md={4}>
          <div className="text-center">
            <Knob value={attack} onChange={(val) => { setAttack(val); updateParameter('attack', val); }}
              min={0.0001} max={1} step={0.0001} label="Attack" displayValue={`${(attack * 1000).toFixed(1)}ms`} size={70} color="#92ce84" />
          </div>
        </Col>
        <Col xs={6} md={4}>
          <div className="text-center">
            <Knob value={release} onChange={(val) => { setRelease(val); updateParameter('release', val); }}
              min={0.01} max={2} step={0.01} label="Release" displayValue={`${(release * 1000).toFixed(0)}ms`} size={70} color="#ffd700" />
          </div>
        </Col>
        <Col xs={6} md={4}>
          <div className="text-center">
            <Knob value={knee} onChange={(val) => { setKnee(val); updateParameter('knee', val); }}
              min={0} max={40} step={1} label="Knee" displayValue={`${knee}dB`} size={70} color="#9b59b6" />
          </div>
        </Col>
        <Col xs={6} md={4}>
          <div className="text-center">
            <Knob value={makeup} onChange={(val) => { setMakeup(val); updateParameter('makeup', val); }}
              min={0} max={24} step={0.5} label="Makeup" displayValue={`${makeup}dB`} size={70} color="#e67e22" />
          </div>
        </Col>
      </Row>
    </Container>
  );
}
