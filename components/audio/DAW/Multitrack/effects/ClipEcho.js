import { useState, useCallback } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import Knob from '../../../../Knob';

export default function ClipEcho({ parameters, onParametersChange }) {
  const [time, setTime] = useState(parameters?.time ?? 250);
  const [feedback, setFeedback] = useState(parameters?.feedback ?? 0.5);
  const [mix, setMix] = useState(parameters?.mix ?? 0.5);

  const updateParameter = useCallback((name, value) => {
    const newParams = { time, feedback, mix, [name]: value };
    onParametersChange(newParams);
  }, [time, feedback, mix, onParametersChange]);

  return (
    <Container>
      <Row>
        <Col>
          <Knob
            label="Time"
            value={time}
            onChange={(val) => {
              setTime(val);
              updateParameter('time', val);
            }}
            min={1}
            max={2000}
            color="#4CAF50"
            displayValue={`${Math.round(time)}ms`}
          />
        </Col>
        <Col>
          <Knob
            label="Feedback"
            value={feedback}
            onChange={(val) => {
              setFeedback(val);
              updateParameter('feedback', val);
            }}
            min={0}
            max={0.95}
            step={0.01}
            color="#FF9800"
            displayValue={`${Math.round(feedback * 100)}%`}
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
            color="#2196F3"
            displayValue={`${Math.round(mix * 100)}%`}
          />
        </Col>
      </Row>
    </Container>
  );
}
