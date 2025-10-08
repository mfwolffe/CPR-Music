import { useState, useCallback } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import Knob from '../../../../Knob';

export default function ClipTremolo({ parameters, onParametersChange }) {
  const [rate, setRate] = useState(parameters?.rate ?? 5);
  const [depth, setDepth] = useState(parameters?.depth ?? 0.5);

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
            max={20}
            step={0.1}
            color="#8BC34A"
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
            color="#CDDC39"
            displayValue={`${Math.round(depth * 100)}%`}
          />
        </Col>
      </Row>
    </Container>
  );
}
