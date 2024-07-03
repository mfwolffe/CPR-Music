import * as React from 'react';
import { Card } from 'react-bootstrap';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Layout from '../../components/layout';
import { useWavesurfer } from '@wavesurfer/react';
import Zoom from 'wavesurfer.js/dist/plugins/zoom.esm.js';
import Hover from 'wavesurfer.js/dist/plugins/hover.esm.js';
import Timeline from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import Envelope from 'wavesurfer.js/dist/plugins/envelope.esm.js';

// import { FaClockRotateLeft } from 'react-icons/fa6';
// import { FaArrowRotateRight } from 'react-icons/fa6';

// import { FaRegCircleStop } from 'react-icons/fa6';
import { FaRegCirclePlay } from 'react-icons/fa6';
import { FaRegCircleLeft } from 'react-icons/fa6';
import { FaRegCircleRight } from 'react-icons/fa6';
import { FaRegCirclePause } from 'react-icons/fa6';

// import { FaPlay } from 'react-icons/fa6';
// import { FaPause } from 'react-icons/fa6';
// import { FaVolumeOff } from 'react-icons/fa6';
// import { FaVolumeLow } from 'react-icons/fa6';
// import { FaVolumeHigh } from 'react-icons/fa6';
// import { FaVolumeXmark } from 'react-icons/fa6';

/* BIGTODO @mfwolffe
 * 1. on daw page refresh, you get a reference error for 'document'
 * 2. Basically using more than one plugin at the moment breaks everything
 *    which is unfortunate because some of these plugins are very useful given
 *    our goals. I'll take a look in the AM b/c it is 4:30AM ...
 *     => FIXED (I think - commit 4eb8199 has changes)
 * 3. Switches should dynamically register (and `destroy()` ?) plugins
 *
 * 4. WebAudio API integration
 * 5. useMemo() for persisting envelope points?
 *
 */

/* SEEME @mfwolffe while the following approaches do allow for loading
 *                 of local media within media elements, it causes
 *                 an absurd number of problems, and basically
 *                 precludes use of plugins
 */
// const [audio, setAudio] = useState(null);
// useEffect(() => {
//   setAudio(new Audio('/audio/UNCSO-forza-snip.mp3'));
// }, []);
//
// OR:
// const audio = new Audio('/audio/UNCSO-forza-snip.mp3');
//
// then set 'media' prop in useWavesurfer hook to variable 'audio

const { useMemo, useState, useCallback, useRef, useEffect } = React;

const formatTime = (seconds) =>
  [seconds / 60, seconds % 60]
    .map((v) => `0${Math.floor(v)}`.slice(-2))
    .join(':');

const audioUrls = [
  '/audio/uncso-bruckner4-1.mp3',
  '/audio/uncso-bruckner4-2.mp3',
  '/audio/uncso-bruckner4-3.mp3',
  '/audio/uncso-bruckner4-4.mp3',
  '/audio/uncso-bruckner4-5.mp3',
  '/audio/uncso-bruckner4-6.mp3',
  '/audio/uncso-bruckner4-7.mp3',
  '/audio/uncso-verdi-forza.mp3',
];

const songList = () => {
  const selectOptions = [];

  audioUrls.forEach((url, i) => {
    selectOptions.push(<option value={i}>{url}</option>);
  });

  return selectOptions;
};

// TODO: @mfwolffe would be nice if timeline properties
//                 were responsive to properties of the
//                 media being played, e.g., if user selects
//                 a track that is particularly long, then
//                 it doesn't really make sense to have the
//                 timeline have 10 second ticks
// TODO: @mfwolffe container for timeline specifically, i.e.,
//                 timeline not *inside* of waveform container
//                 but closer to the ProTools look, etc. Can simulate
//                 with styling but I'm not sure I like it.
const timelineOptions = {
  // insertPosition: 'afterend', // the default presumably
  // insertPosition: 'afterbegin',  // breaks timeline (just hides?)
  // insertPosition: 'beforeend',   // also "breaks"  the timeline - css?
  height: 24, // also affects typeface for numeric labels; default is 20 supposedly - imo too small
  insertPosition: 'beforebegin', // top of waveform container, within it
  // primaryLabelSpacing: 5, // TODO: @mfwolffe see how the two LabelSpacing props play together
  // primaryLabelSpacing: 1, // ^ see that todo lol
  // secondaryLabelInterval: 5,
  // secondaryLabelSpacing: 1,    // TODO @mfwolffe figure these out
  // secondaryLabelOpacity: 0.25,
  // style: 'color: #e6dfdc',
  style: 'color: #e6dfdc; background-color: var(--daw-timeline-bg)',
};

const envelopeOptions = {
  volume: 0.8,
  lineWidth: 3.5,
  dragLine: true,
  dragPointSize: 20,
  lineColor: 'rgba(219, 13, 13, 0.9)',
  dragPointStroke: 'rgba(0, 0, 0, 0.5)',
  dragPointFill: 'rgba(0, 255, 255, 0.8)',
  points: [],
};

const hoverOptions = {
  // labelBackground: 'blue',  // SEEME @mfwolffe having a bg on scrub may be helpful
  lineWidth: 2,
  labelSize: 12,
  labelColor: '#fff',
  formatTimeCallback: formatTime,
  lineColor: 'var(--daw-timeline-bg)',
};

const zoomOptions = {
  deltaThreshold: 5, // set to zero for fluid scroll - high cpu cost though // TODO @mfwolffe make it optional?
  maxZoom: 150,
  scale: 0.125, // amount to zoom per scroll wheel turn
};

const BasicDaw = () => {
  const containerRef = useRef(null);
  // SEEME a pure CSS approach will be taken if duotone icons are annoying to try to include
  const [progBtnHvr, setHvr] = useState(false);
  // const [envPoints, setEnvPoints] = useState;
  const [urlIndex, setUrlIndex] = useState(0);
  // SEEME I'm not sure memoization is the right way to go
  // SEEME ^^ I think Envelope needs useMemo or some other hook
  //          otherwise infinite render
  // const hover = useMemo(() => [Hover.create(hoverOptions)], []);
  const envelope = useMemo(
    () => [Envelope.create(envelopeOptions)],
    [urlIndex]
  );
  // const timeline = useMemo(() => [Timeline.create(timelineOptions)], []);

  // TODO @mfwolffe tooltips
  // TODO @mfwolffe ask dr. stewart about import of duotone for fun hover effect
  // const playButton = (
  //   <FaRegCirclePlay
  //     fontSize="1rem"
  //     onMouseEnter={() => setHvr(true)}
  //     onMouseLeave={() => setHvr(false)}
  //     style={{ color: progBtnHvr ? 'aqua' : 'white' }}
  //   />
  // );
  const skipNext = <FaRegCircleRight fontSize="1rem" />;
  const skipPrev = <FaRegCircleLeft fontSize="1rem" />;
  const playButton = <FaRegCirclePlay fontSize="1rem" />;
  const pauseButton = <FaRegCirclePause fontSize="1rem" className="hoho" />;

  // SEEME @mfwolffe this approach in tandem w/ the poorly-named
  //                 doShit() function seem to resolve the problem
  //                 of >= 2 plugins breaking everything
  // TODO  @mfwolffe But what about the lack of memoization? Determine
  //                 if that'll brick or break later/what exactly we lose
  //                 in foregoing. Which plugin should get the hook though,
  //                 knowing that, i.e., which has the biggest perf hit from
  //                 not memoizing?
  //
  // const envelope = Envelope.create(envelopeOptions);
  const zoom = Zoom.create(zoomOptions);
  const hover = Hover.create(hoverOptions);
  const timeline = Timeline.create(timelineOptions);
  // const envelope = Envelope.create(envelopeOptions);

  // TODO @mfwolffe allow users to modify style to their liking?
  //                allow users to save "profiles" that they make?
  //                premade profiles user can select from?
  //
  //      If so, Things to consider:
  //                colors of course (wave, prog, cursor)
  //                background (bg images? css 'designs'?)
  //                show/hide scrollbar
  //                zoom level
  //                overall style - e.g., ProTools style or 'bar' style?
  //                scaling factor (height)
  let { wavesurfer, isReady, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    height: 212, // container, not waveform
    waveColor: '#4B9CD3', // carolina blue
    progressColor: '#450084', // jmu poiple
    cursorColor: '#CBB677', // jmu gold
    cursorWidth: 3,
    url: audioUrls[urlIndex], // SEEME @mfwolffe in testing so far, use urls instead of media prop. disastrous
    dragToSeek: true, // as it sounds - drag cursor with mouse hold instead of single click
    // normalize: true,   // TODO @ mfwolffe look into this prop. Feels like more than just vert-stretch
    // plugins: timeline,
    plugins: envelope,
    autoplay: false, // why would you ever want this true?
    autoScroll: true,
    barHeight: 0.78, // doesn't have to be in 'bar mode'
    minPxPerSec: 1, // rudimentary "zoom"
    // mediaControls: true, // actually not bad with respect to placement on the ref; pretty ugly though...
    // backend: 'WebAudio', // if 'WebAudio', it is incompatible with `mediaControls: true`
    hideScrollbar: false, // even if false, scrollbar only appears for overflow
    // interact: false, // disallows scrubbing with mouse, click to jump, etc., but audio still playable
    // peaks: , // SEEME @mfwolffe this may be useful when implementing Web Audio tools? - it's precomputed audio data
    // renderFunction: , // SEEME @mfwolffe also check out once tinkering with Web Audio starts
    // splitChannels: , // SEEME @mfwolffe figure out proper syntax and usage for spliting of channels
  });

  const onUrlChange = useCallback((e) => {
    console.log('target (select) val: ', e.target.value);
    setUrlIndex(e.target.value);
    console.log('length: ', envelope.length);
  }, []);

  const onPlayPause = useCallback(() => {
    wavesurfer && wavesurfer.playPause();
  }, [wavesurfer]);

  const onSkipTrackFwd = useCallback(() => {
    setUrlIndex((index) => (index + 1) % audioUrls.length);
  }, []);

  const onSkipTrackBkwd = useCallback(() => {
    const len = audioUrls.length;
    // console.log('triggered');
    // const newIndex = ((urlIndex % len) + len) % len;
    // console.log(((urlIndex % len) + len) % len);

    // TODO @mfwolffe for some reason modulo w/ neg not working in
    //                the useCallback but fine if using ternary as below
    setUrlIndex((index) => (index == 0 ? len - 1 : index - 1));
  }, []);

  // TODO @mfwolffe   envelope in this implementation
  //                  renders but appears to have some
  //                  kind of bad interaction (crackly
  //                  playback and envelope appears to
  //                  do nada)
  // SEEME @mfwolffe  probably not a fix, but after converting
  //                  to .wav ... maybe?? maybe try those files???
  function addPlugWrapper(surfer, plg) {
    console.log('The daw is prêt');
    console.log(surfer.getDuration());
    surfer.registerPlugin(plg);
  }

  // isReady && addPlugWrapper(wavesurfer, hover);

  // SEEME @mfwolffe and playing check seems to resolve issue of recomputing (there was no noticeable effect though)
  //                 and I'm not sure if there will be side effects to adding the additional condition
  if (isReady && !isPlaying) {
    // initEnvelopePoints(wavesurfer, envelope);
    const duration = wavesurfer.getDuration();
    const halfPoint = duration / 2;

    // SEEME @mfwolffe - figure out what useMemo does, ie, if
    //                   memoized results are put into this array
    // TODO @mfwolffe    fix me
    const pointArray = [
      {
        time: 0.0,
        volume: 0.5,
      },
      {
        time: halfPoint,
        volume: 0.8,
      },
      {
        time: duration,
        volume: 0.5,
      },
    ];

    envelope[0].setPoints(pointArray);

    // envelope[0].setPoints(pointArray);

    addPlugWrapper(wavesurfer, zoom);
    addPlugWrapper(wavesurfer, hover);
    addPlugWrapper(wavesurfer, timeline);
    // addPlugWrapper(wavesurfer, envelope);
  }

  // envelope.on('points-change', (points) => {
  //   console.log('points updated', points);
  // });

  console.log('last check', envelope.length);

  return (
    <Layout>
      <h1>DAWly Parton</h1>
      <Card className="ml-auto mr-auto w-90" id="daw-card">
        <Card.Body>
          <Card.Title>
            <strong>I am Sitting in a Room</strong>{' '}
            <a href="https://en.wikipedia.org/wiki/I_Am_Sitting_in_a_Room">
              (?)
            </a>
          </Card.Title>
          <Card.Subtitle>
            <em>
              Is it symbolic that the waveform is carolina blue and the progress
              bar is jmu purple? ...you tell me...
            </em>{' '}
            🤷
          </Card.Subtitle>
          <div
            ref={containerRef}
            id="waveform"
            className="w-95 ml-auto mr-auto mb-0"
          />

          <div className="d-flex w-95 ml-auto mr-auto prog-bar align-items-center flex-row gap-025">
            <Button onClick={onSkipTrackBkwd} className="prog-button pl-2">
              {skipPrev}
            </Button>
            <Button onClick={onPlayPause} className="prog-button">
              {isPlaying ? pauseButton : playButton}
            </Button>
            <Button onClick={onSkipTrackFwd} className="prog-button">
              {skipNext}
            </Button>
            <span className="pl-1 text-white">{formatTime(currentTime)}</span>
          </div>

          <div className="d-flex justify-content-between">
            <div>
              <p>
                Current audio: {audioUrls[urlIndex]}
                <br />
                Performed by the UNC Symphony Orchestra, featuring yours truly
                (I'm the lowest sounding brass 'voice').
              </p>
              {/* <p>Current time: {formatTime(currentTime)}</p> */}
            </div>
            <Card className="bg-dawcontrol text-white control-card mt-2">
              {/* SEEME @mfwolffe allow teacher to select plugins they want and populate from that selection? */}
              <Card.Body>
                <Card.Title className="text-center">DAW Options</Card.Title>
                <Form className="pl-1 pr-1">
                  <div className="d-flex gap-3">
                    <div className="pl-2">
                      {/* TODO @mfwolffe have switch bg color be carolina blue to match daw wf */}
                      <Form.Check type="switch" id="record" label="Record" />
                      <Form.Check type="switch" id="minimap" label="Minimap" />
                      <Form.Check
                        type="switch"
                        id="envelope"
                        label="Envelope"
                      />
                    </div>
                    <div className="pr-2">
                      <Form.Check type="switch" id="select" label="Regions" />
                      <Form.Check
                        type="switch"
                        id="spectrogram"
                        label="Spectrogram"
                      />
                      <Form.Check
                        type="switch"
                        id="cursor-hover"
                        label="Cursor Hover"
                      />
                    </div>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </div>

          <div style={{ margin: '1em 0', display: 'flex', gap: '1em' }}>
            {/* <button onClick={onUrlChange}>Change audio</button> */}
            <Form>
              <div className="d-flex gap-3">
                <Form.Select aria-label="track-select" onChange={onUrlChange}>
                  <option default value="">
                    Select Track (or try arrows in the DAW)
                  </option>
                  {songList()}
                </Form.Select>
              </div>
            </Form>
          </div>
        </Card.Body>
      </Card>
    </Layout>
  );
};

export default BasicDaw;
