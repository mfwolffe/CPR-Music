import { useState, useCallback } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import Knob from '../../../../Knob';

export default function ClipGate({ parameters, onParametersChange }) {
  const [threshold, setThreshold] = useState(parameters?.threshold ?? -40);

  const updateParameter = useCallback((name, value) => {
    const newParams = { threshold, [name]: value };
    onParametersChange(newParams);
  }, [threshold, onParametersChange]);

  return (
    <Container>
      <Row>
        <Col>
          <Knob
            label="Threshold"
            value={threshold}
            onChange={(val) => {
              setThreshold(val);
              updateParameter('threshold', val);
            }}
            min={-80}
            max={0}
            color="#607D8B"
            displayValue={`${Math.round(threshold)}dB`}
          />
        </Col>
      </Row>
    </Container>
  );
}
