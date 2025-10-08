import { useState, useCallback } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import Knob from '../../../../Knob';

export default function ClipAutoWah({ parameters, onParametersChange }) {
  const [sensitivity, setSensitivity] = useState(parameters?.sensitivity ?? 0.5);
  const [frequency, setFrequency] = useState(parameters?.frequency ?? 1000);
  const [resonance, setResonance] = useState(parameters?.resonance ?? 5);

  const updateParameter = useCallback((name, value) => {
    const newParams = { sensitivity, frequency, resonance, [name]: value };
    onParametersChange(newParams);
  }, [sensitivity, frequency, resonance, onParametersChange]);

  return (
    <Container>
      <Row>
        <Col>
          <Knob
            label="Sensitivity"
            value={sensitivity}
            onChange={(val) => {
              setSensitivity(val);
              updateParameter('sensitivity', val);
            }}
            min={0}
            max={1}
            step={0.01}
            color="#FF6F00"
            displayValue={`${Math.round(sensitivity * 100)}%`}
          />
        </Col>
        <Col>
          <Knob
            label="Frequency"
            value={frequency}
            onChange={(val) => {
              setFrequency(val);
              updateParameter('frequency', val);
            }}
            min={100}
            max={5000}
            color="#FFA000"
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
            min={1}
            max={20}
            step={0.1}
            color="#FFB300"
            displayValue={`${resonance.toFixed(1)}`}
          />
        </Col>
      </Row>
    </Container>
  );
}
