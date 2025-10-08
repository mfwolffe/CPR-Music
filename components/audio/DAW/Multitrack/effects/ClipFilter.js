import { useState, useCallback } from 'react';
import { Container, Row, Col, Form } from 'react-bootstrap';
import Knob from '../../../../Knob';

export default function ClipFilter({ parameters, onParametersChange }) {
  const [type, setType] = useState(parameters?.type ?? 'lowpass');
  const [frequency, setFrequency] = useState(parameters?.frequency ?? 1000);
  const [resonance, setResonance] = useState(parameters?.resonance ?? 1);

  const updateParameter = useCallback((name, value) => {
    const newParams = { type, frequency, resonance, [name]: value };
    onParametersChange(newParams);
  }, [type, frequency, resonance, onParametersChange]);

  return (
    <Container>
      <Row>
        <Col>
          <Form.Group>
            <Form.Label>Type</Form.Label>
            <Form.Select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                updateParameter('type', e.target.value);
              }}
            >
              <option value="lowpass">Lowpass</option>
              <option value="highpass">Highpass</option>
              <option value="bandpass">Bandpass</option>
              <option value="notch">Notch</option>
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>
      <Row>
        <Col>
          <Knob
            label="Frequency"
            value={frequency}
            onChange={(val) => {
              setFrequency(val);
              updateParameter('frequency', val);
            }}
            min={20}
            max={20000}
            color="#4CAF50"
            displayValue={`${Math.round(frequency)}Hz`}
          />
        </Col>
        <Col>
          <Knob
            label="Resonance"
            value={resonance}
            onChange={(val) => {
              setResonance(val);
              updateParameter('resonance', val);
            }}
            min={0.1}
            max={20}
            step={0.1}
            color="#8BC34A"
            displayValue={`${resonance.toFixed(1)}`}
          />
        </Col>
      </Row>
    </Container>
  );
}
