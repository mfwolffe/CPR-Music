'use client';

import { Card, CardHeader, CardTitle, CardBody, Form } from 'react-bootstrap';
import { useEffects } from '../../../../contexts/DAWProvider';

/**
 * Equalizer component with frequency band controls
 */
export default function EQ({ width }) {
  const { filters } = useEffects();
  
  const sliders = filters.map((filter, i) => {
    const frqVal = filter.frequency.value;
    
    return (
      <div className="d-flex" key={`${frqVal} MHz`}>
        <Form.Label style={{ width: '40%' }}>{frqVal} MHz</Form.Label>
        <Form.Range
          min={-26}
          max={26}
          step={0.1}
          defaultValue={0}
          style={{ width: '60%' }}
          onInput={(e) => {
            filter.gain.value = parseFloat(e.target.value);
          }}
        />
      </div>
    );
  });
  
  return (
    <Card id="equalizer" style={{ width: `${width}%` }}>
      <CardHeader className="text-center text-white pt-1 pb-1 bg-daw-toolbars">
        <CardTitle className="pt-0 pb-0 mt-0 mb-0">Equalizer</CardTitle>
      </CardHeader>
      <CardBody className="bg-dawcontrol text-white mlr-a plr-0 pt-2 pb-2 w-100">
        <div className="flex-even gap-2 mlr-a w-100 plr-1">
          <div>{sliders.slice(0, 5)}</div>
          <div>{sliders.slice(5, 10)}</div>
        </div>
      </CardBody>
    </Card>
  );
}