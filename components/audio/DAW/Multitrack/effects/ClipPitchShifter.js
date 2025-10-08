import { useState, useCallback } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import Knob from '../../../../Knob';

export default function ClipPitchShifter({ parameters, onParametersChange }) {
  const [shift, setShift] = useState(parameters?.shift ?? 0);

  const updateParameter = useCallback((name, value) => {
    const newParams = { shift, [name]: value };
    onParametersChange(newParams);
  }, [shift, onParametersChange]);

  return (
    <Container>
      <Row>
        <Col>
          <Knob
            label="Shift"
            value={shift}
            onChange={(val) => {
              setShift(val);
              updateParameter('shift', val);
            }}
            min={-24}
            max={24}
            step={1}
            color="#FF5722"
            displayValue={`${shift > 0 ? '+' : ''}${shift} st`}
          />
        </Col>
      </Row>
    </Container>
  );
}
