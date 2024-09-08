'use client';

import { Form } from 'react-bootstrap';

const WidgetSlider = (min, max, step, dfault, setter, label) => {
  return (
    <div>
      <input
        min={min}
        max={max}
        step={step}
        type="range"
        orient="vertical"
        className="mlr-auto"
        // defaultValue={dfault}
        {...(dfault === null && { defaultValue: dfault })}
        onInput={(e) => setter(e.target.value)}
      ></input>
      <Form.Label className="d-block text-center mb-0">{label}</Form.Label>
    </div>
  );
};

export default WidgetSlider;
