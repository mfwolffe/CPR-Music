import { useState, useCallback } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import Knob from '../../../../Knob';

export default function ClipDistortion({ parameters, onParametersChange }) {
  const [amount, setAmount] = useState(parameters?.amount ?? 50);
  const [outputGain, setOutputGain] = useState(parameters?.outputGain ?? 0.7);

  const updateParameter = useCallback((name, value) => {
    const newParams = { amount, outputGain, [name]: value };
    onParametersChange(newParams);
  }, [amount, outputGain, onParametersChange]);

  return (
    <Container>
      <Row>
        <Col>
          <Knob
            label="Amount"
            value={amount}
            onChange={(val) => {
              setAmount(val);
              updateParameter('amount', val);
            }}
            min={0}
            max={100}
            color="#F44336"
            displayValue={`${Math.round(amount)}%`}
          />
        </Col>
        <Col>
          <Knob
            label="Output Gain"
            value={outputGain}
            onChange={(val) => {
              setOutputGain(val);
              updateParameter('outputGain', val);
            }}
            min={0}
            max={2}
            step={0.01}
            color="#FF5722"
            displayValue={`${Math.round(outputGain * 100)}%`}
          />
        </Col>
      </Row>
    </Container>
  );
}
