import { useState, useCallback } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import Knob from '../../../../Knob';

export default function ClipChorus({ parameters, onParametersChange }) {
  const [rate, setRate] = useState(parameters?.rate ?? 1);
  const [depth, setDepth] = useState(parameters?.depth ?? 0.5);
  const [mix, setMix] = useState(parameters?.mix ?? 0.5);

  const updateParameter = useCallback((name, value) => {
    const newParams = { rate, depth, mix, [name]: value };
    onParametersChange(newParams);
  }, [rate, depth, mix, onParametersChange]);

  return (
    <Container>
      <Row>
        <Col>
          <Knob
            label="Rate"
            value={rate}
            onChange={(val) => {
              setRate(val);
              updateParameter('rate', val);
            }}
            min={0.1}
            max={10}
            step={0.1}
            color="#9C27B0"
            displayValue={`${rate.toFixed(1)}Hz`}
          />
        </Col>
        <Col>
          <Knob
            label="Depth"
            value={depth}
            onChange={(val) => {
              setDepth(val);
              updateParameter('depth', val);
            }}
            min={0}
            max={1}
            step={0.01}
            color="#E91E63"
            displayValue={`${Math.round(depth * 100)}%`}
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
            color="#00BCD4"
            displayValue={`${Math.round(mix * 100)}%`}
          />
        </Col>
      </Row>
    </Container>
  );
}
