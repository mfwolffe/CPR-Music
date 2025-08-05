'use client';

import { Container, Row, Col, Form } from 'react-bootstrap';
import { useEffects } from '../../../../contexts/DAWProvider';

/**
 * Equalizer component with frequency band controls
 */
export default function EQ({ width }) {
  const { filters } = useEffects();
  
  return (
    <Container fluid className="p-3">
      <Row>
        {filters.map((filter, i) => {
          const frqVal = filter.frequency.value;
          const freqLabel = frqVal >= 1000 ? `${(frqVal/1000).toFixed(1)}k` : frqVal;
          
          return (
            <Col key={`${frqVal} Hz`} xs={6} sm={4} md={3} lg={2} className="mb-3">
              <div className="text-center">
                <Form.Range
                  min={-26}
                  max={26}
                  step={0.1}
                  defaultValue={0}
                  className="eq-slider"
                  onInput={(e) => {
                    filter.gain.value = parseFloat(e.target.value);
                  }}
                  style={{ width: '100%' }}
                />
                <small className="text-white d-block mt-1">{freqLabel}Hz</small>
              </div>
            </Col>
          );
        })}
      </Row>
    </Container>
  );
}