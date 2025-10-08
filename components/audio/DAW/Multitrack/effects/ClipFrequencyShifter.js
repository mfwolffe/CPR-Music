import { useState, useCallback } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import Knob from '../../../../Knob';

export default function ClipFrequencyShifter({ parameters, onParametersChange }) {
  const [shift, setShift] = useState(parameters?.shift ?? 100);

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
            min={-1000}
            max={1000}
            step={10}
            color="#FF9800"
            displayValue={`${shift > 0 ? '+' : ''}${shift}Hz`}
          />
        </Col>
      </Row>
    </Container>
  );
}
