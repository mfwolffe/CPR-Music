import { useState, useCallback } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import Knob from '../../../../Knob';

export default function ClipStereoWidener({ parameters, onParametersChange }) {
  const [width, setWidth] = useState(parameters?.width ?? 1.5);

  const updateParameter = useCallback((name, value) => {
    const newParams = { width, [name]: value };
    onParametersChange(newParams);
  }, [width, onParametersChange]);

  return (
    <Container>
      <Row>
        <Col>
          <Knob
            label="Width"
            value={width}
            onChange={(val) => {
              setWidth(val);
              updateParameter('width', val);
            }}
            min={0}
            max={3}
            step={0.1}
            color="#3F51B5"
            displayValue={`${width.toFixed(1)}`}
          />
        </Col>
      </Row>
    </Container>
  );
}
