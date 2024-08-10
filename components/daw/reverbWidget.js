import { Button, Card, CardBody, CardHeader, CardTitle } from 'react-bootstrap';

const SliderGroup = ({ slider1, slider2, showGain }) => {
  return (
    <div className="mb-0 pb-0">
      <div className="d-flex gap-025">
        {slider1}
        {slider2 ?? ''}
      </div>
      {showGain && (
        <p className="text-center mt-0 mb-0">
          <strong>Gain</strong>
        </p>
      )}
    </div>
  );
};

const ReverbChorusWidget = ({
  hide,
  width,
  sliders,
  handler,
  title,
  hasButton,
  ffmpegRef,
  inGainChr,
  outGainChr,
  delayChr,
  decayChr,
  speedChr,
  depthsChr,
  audioRef,
  setAudioURL,
  audioURL,
  wavesurfer,
  setEditList,
  editList,
  setEditListIndex,
  editListIndex,
}) => {
  const hidden = hide;
  const sliderGroups = [];

  console.log('sliders:', sliders);

  for (let i = 0; i < sliders.length; i += 2) {
    sliderGroups.push(
      <SliderGroup
        slider1={sliders[i]}
        slider2={i + 1 < sliders.length ? sliders[i + 1] : null}
        showGain={i < 1 ? true : false}
      />
    );
  }

  console.log('groups', sliderGroups);

  return (
    <Card
      id={`${title.toLowerCase()}`}
      hidden={hidden}
      style={{ width: `${width}%` }}
    >
      <CardHeader className="text-center text-white pt-1 pb-1 bg-daw-toolbars">
        <CardTitle className="pt-0 pb-0 mt-0 mb-0">{title}</CardTitle>
      </CardHeader>
      <CardBody className="bg-dawcontrol text-white plr-0 pt-2 pb-0 w-100">
        <div className="flex-even gap-0 mlr-a w-100 plr-0">{sliderGroups}</div>
        {hasButton && (
          <div className="d-flex justify-content-end">
            <Button
              size="sm"
              className="mb-0 mr-2 mt-1"
              onClick={() =>
                handler(
                  ffmpegRef,
                  inGainChr,
                  outGainChr,
                  delayChr,
                  decayChr,
                  speedChr,
                  depthsChr,
                  audioRef,
                  setAudioURL,
                  audioURL,
                  wavesurfer,
                  setEditList,
                  editList,
                  setEditListIndex,
                  editListIndex
                )
              }
            >
              Apply
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default ReverbChorusWidget;
