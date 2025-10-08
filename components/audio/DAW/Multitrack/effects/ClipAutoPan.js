import { useState, useCallback } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import Knob from '../../../../Knob';

export default function ClipAutoPan({ parameters, onParametersChange }) {
  const [rate, setRate] = useState(parameters?.rate ?? 1);
  const [depth, setDepth] = useState(parameters?.depth ?? 0.8);

  const updateParameter = useCallback((name, value) => {
    const newParams = { rate, depth, [name]: value };
    onParametersChange(newParams);
  }, [rate, depth, onParametersChange]);

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
            color="#00BCD4"
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
            color="#009688"
            displayValue={`${Math.round(depth * 100)}%`}
          />
        </Col>
      </Row>
    </Container>
  );
}
