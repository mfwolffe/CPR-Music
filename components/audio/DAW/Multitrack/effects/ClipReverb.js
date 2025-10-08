/**
 * Clip Reverb Effect
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Form } from 'react-bootstrap';
import Knob from '../../../../Knob';

const REVERB_PRESETS = {
  smallRoom: 'Small Room',
  mediumRoom: 'Medium Room',
  largeRoom: 'Large Room',
  smallHall: 'Small Hall',
  mediumHall: 'Medium Hall',
  largeHall: 'Large Hall',
  plate: 'Plate',
  chamber: 'Chamber'
};

export default function ClipReverb({ parameters, onParametersChange }) {
  const [preset, setPreset] = useState(parameters.preset || 'mediumHall');
  const [mix, setMix] = useState(parameters.mix !== undefined ? parameters.mix : 0.3);
  const [preDelay, setPreDelay] = useState(parameters.preDelay || 0);

  const updateParameter = useCallback((key, value) => {
    const newParams = { ...parameters, [key]: value };
    onParametersChange(newParams);
  }, [parameters, onParametersChange]);

  return (
    <Container fluid className="p-3">
      <Row className="mb-4">
        <Col xs={12} md={6}>
          <Form.Label className="text-white">Reverb Type</Form.Label>
          <Form.Select
            value={preset}
            onChange={(e) => {
              setPreset(e.target.value);
              updateParameter('preset', e.target.value);
            }}
            className="bg-secondary text-white border-0"
          >
            {Object.entries(REVERB_PRESETS).map(([key, name]) => (
              <option key={key} value={key}>{name}</option>
            ))}
          </Form.Select>
        </Col>
      </Row>

      <Row>
        <Col xs={12} md={4}>
          <div className="text-center">
            <Knob
              value={mix}
              onChange={(val) => {
                setMix(val);
                updateParameter('mix', val);
              }}
              min={0}
              max={1}
              step={0.01}
              label="Mix"
              displayValue={`${Math.round(mix * 100)}%`}
              size={80}
              color="#7bafd4"
            />
          </div>
        </Col>
        <Col xs={12} md={4}>
          <div className="text-center">
            <Knob
              value={preDelay}
              onChange={(val) => {
                setPreDelay(val);
                updateParameter('preDelay', val);
              }}
              min={0}
              max={200}
              step={1}
              label="Pre-Delay"
              displayValue={`${Math.round(preDelay)}ms`}
              size={80}
              color="#92ce84"
            />
          </div>
        </Col>
      </Row>
    </Container>
  );
}
