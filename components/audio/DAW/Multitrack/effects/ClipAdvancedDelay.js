import { useState, useCallback } from 'react';
import { Container, Row, Col, Form } from 'react-bootstrap';
import Knob from '../../../../Knob';

export default function ClipAdvancedDelay({ parameters, onParametersChange }) {
  const [time, setTime] = useState(parameters?.time ?? 500);
  const [feedback, setFeedback] = useState(parameters?.feedback ?? 0.5);
  const [mix, setMix] = useState(parameters?.mix ?? 0.5);
  const [pingPong, setPingPong] = useState(parameters?.pingPong ?? false);
  const [filterType, setFilterType] = useState(parameters?.filterType ?? 'lowpass');
  const [filterFreq, setFilterFreq] = useState(parameters?.filterFreq ?? 2000);

  const updateParameter = useCallback((name, value) => {
    const newParams = { time, feedback, mix, pingPong, filterType, filterFreq, [name]: value };
    onParametersChange(newParams);
  }, [time, feedback, mix, pingPong, filterType, filterFreq, onParametersChange]);

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
            color="#1976D2"
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
            color="#1E88E5"
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
      <Row>
        <Col>
          <Form.Group>
            <Form.Check
              type="checkbox"
              label="Ping Pong"
              checked={pingPong}
              onChange={(e) => {
                setPingPong(e.target.checked);
                updateParameter('pingPong', e.target.checked);
              }}
            />
          </Form.Group>
        </Col>
      </Row>
      <Row>
        <Col>
          <Form.Group>
            <Form.Label>Filter Type</Form.Label>
            <Form.Select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                updateParameter('filterType', e.target.value);
              }}
            >
              <option value="lowpass">Lowpass</option>
              <option value="highpass">Highpass</option>
              <option value="bandpass">Bandpass</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col>
          <Knob
            label="Filter Freq"
            value={filterFreq}
            onChange={(val) => {
              setFilterFreq(val);
              updateParameter('filterFreq', val);
            }}
            min={20}
            max={20000}
            color="#42A5F5"
            displayValue={`${Math.round(filterFreq)}Hz`}
          />
        </Col>
      </Row>
    </Container>
  );
}
