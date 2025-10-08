import { useState, useCallback } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import Knob from '../../../../Knob';

export default function ClipRingModulator({ parameters, onParametersChange }) {
  const [frequency, setFrequency] = useState(parameters?.frequency ?? 440);
  const [mix, setMix] = useState(parameters?.mix ?? 0.5);

  const updateParameter = useCallback((name, value) => {
    const newParams = { frequency, mix, [name]: value };
    onParametersChange(newParams);
  }, [frequency, mix, onParametersChange]);

  return (
    <Container>
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
            max={5000}
            color="#FF6F00"
            displayValue={`${Math.round(frequency)}Hz`}
          />
        </Col>
        <Col>
          <Knob
            label="Mix"
            value={mix}
            onChange={(val) => {
              setMix(val);
              updateParameter('mix', val);
            }}
            min={0}
            max={1}
            step={0.01}
            color="#FFA726"
            displayValue={`${Math.round(mix * 100)}%`}
          />
        </Col>
      </Row>
    </Container>
  );
}
