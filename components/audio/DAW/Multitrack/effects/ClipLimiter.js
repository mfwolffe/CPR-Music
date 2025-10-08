import { useState, useCallback } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import Knob from '../../../../Knob';

export default function ClipLimiter({ parameters, onParametersChange }) {
  const [threshold, setThreshold] = useState(parameters?.threshold ?? -3);
  const [release, setRelease] = useState(parameters?.release ?? 0.05);

  const updateParameter = useCallback((name, value) => {
    const newParams = { threshold, release, [name]: value };
    onParametersChange(newParams);
  }, [threshold, release, onParametersChange]);

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
            min={-12}
            max={0}
            color="#455A64"
            displayValue={`${Math.round(threshold)}dB`}
          />
        </Col>
        <Col>
          <Knob
            label="Release"
            value={release}
            onChange={(val) => {
              setRelease(val);
              updateParameter('release', val);
            }}
            min={0.01}
            max={1}
            step={0.01}
            color="#78909C"
            displayValue={`${release.toFixed(2)}s`}
          />
        </Col>
      </Row>
    </Container>
  );
}
