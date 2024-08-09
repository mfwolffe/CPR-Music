import { Card, CardHeader, CardTitle, CardBody, Form } from 'react-bootstrap';

const eqBands = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

const EQSliders = (hide, filters, width) => {
  const hidden = hide;
  const sliders = [];

  filters.forEach((filter) => {
    const frqVal = filter.frequency.value;
    const slider = (
      <>
        <div className="d-flex" key={`${frqVal} MHz`}>
          <Form.Label style={{ width: '40%' }}>{frqVal} MHz</Form.Label>
          <Form.Range
            min={-26}
            max={26}
            step={0.1}
            style={{ width: '60%' }}
            onInput={(e) => (filter.gain.value = e.target.value)}
          ></Form.Range>
        </div>
      </>
    );

    sliders.push(slider);
  });

  return (
    <>
      <Card id="equalizer" hidden={hidden} style={{ width: `${width}%` }}>
        <CardHeader className="text-center text-white pt-1 pb-1 bg-daw-toolbars">
          <CardTitle className="pt-0 pb-0 mt-0 mb-0">Equalizer</CardTitle>
        </CardHeader>
        <CardBody className="bg-dawcontrol text-white mlr-a pt-2 pb-2">
          <div className="d-flex gap-2 mlr-a">
            <div>{sliders.slice(0, 5)}</div>
            <div>{sliders.slice(5, 10)}</div>
          </div>
        </CardBody>
      </Card>
    </>
  );
};

export default EQSliders;
