import { useState, useCallback } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import Knob from '../../../../Knob';

export default function ClipFlanger({ parameters, onParametersChange }) {
  const [rate, setRate] = useState(parameters?.rate ?? 0.5);
  const [depth, setDepth] = useState(parameters?.depth ?? 0.002);
  const [feedback, setFeedback] = useState(parameters?.feedback ?? 0.5);
  const [delay, setDelay] = useState(parameters?.delay ?? 0.005);
  const [mix, setMix] = useState(parameters?.mix ?? 0.5);

  const updateParameter = useCallback((name, value) => {
    const newParams = { rate, depth, feedback, delay, mix, [name]: value };
    onParametersChange(newParams);
  }, [rate, depth, feedback, delay, mix, onParametersChange]);

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
            color="#AB47BC"
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
            max={0.01}
            step={0.0001}
            color="#BA68C8"
            displayValue={`${(depth * 1000).toFixed(1)}ms`}
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
            color="#CE93D8"
            displayValue={`${Math.round(feedback * 100)}%`}
          />
        </Col>
      </Row>
      <Row>
        <Col>
          <Knob
            label="Delay"
            value={delay}
            onChange={(val) => {
              setDelay(val);
              updateParameter('delay', val);
            }}
            min={0.001}
            max={0.02}
            step={0.001}
            color="#E1BEE7"
            displayValue={`${(delay * 1000).toFixed(1)}ms`}
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
            color="#F3E5F5"
            displayValue={`${Math.round(mix * 100)}%`}
          />
        </Col>
      </Row>
    </Container>
  );
}
