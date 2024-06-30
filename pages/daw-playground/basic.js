import * as React from 'react';
import Form from 'react-bootstrap/Form';
import { Card } from 'react-bootstrap';
import Button from 'react-bootstrap/Button';
import Layout from '../../components/layout';
import { useWavesurfer } from '@wavesurfer/react';
import Hover from 'wavesurfer.js/dist/plugins/hover.esm.js';
import Timeline from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import Envelope from 'wavesurfer.js/dist/plugins/envelope.esm.js';

/* BIGTODO @mfwolffe
 * 1. on daw page refresh, you get a reference error for 'document'
 * 2. Basically using more than one plugin at the moment breaks everything
 *    which is unfortunate because some of these plugins are very useful given
 *    our goals. I'll take a look in the AM b/c it is 4:30AM ...
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
  height: 22, // also affects typeface for numeric labels; default is 20 supposedly - imo too small
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
  // lineColor: 'rgba(219, 86, 33, 0.9)',

  dragPointStroke: 'rgba(0, 0, 0, 0.5)',
  dragPointFill: 'rgba(0, 255, 255, 0.8)',

  points: [
    { time: 0, volume: 0.05 },
    { time: 5, volume: 0.6 },
  ],
};

const hoverOptions = {
  formatTimeCallback: formatTime,
  // labelBackground:
  labelColor: 'yellow',
  labelSize: 3,
  lineColor: 'var(--jmu-gold)',
  lineWidth: 3,
};

const BasicDaw = () => {
  const containerRef = useRef(null);
  const [urlIndex, setUrlIndex] = useState(0);
  const timeline = useMemo(() => [Timeline.create(timelineOptions)], []);
  const envelope = useMemo(() => [Envelope.create(envelopeOptions)], []);
  // const hover = useMemo(() => [Hover.create(hoverOptions)], []);

  // const envelope = Envelope.create(envelopeOptions);
  const hover = Hover.create(hoverOptions);

  // const pluginsTest = [timeline, hover];
  // const envelope = useMemo(() => [EnvelopePlugin.create(envelopeOptions)], []); // SEEME @mfwolffe basically this import is bogus

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

  const onUrlChange = useCallback(() => {
    setUrlIndex((index) => (index + 1) % audioUrls.length);
  }, []);

  const onPlayPause = useCallback(() => {
    wavesurfer && wavesurfer.playPause();
  }, [wavesurfer]);

  // TODO @mfwolffe   envelope in this implementation
  //                  renders but appears to have some
  //                  kind of bad interaction (crackly
  //                  playback and envelope appears to
  //                  do nada)
  // SEEME @mfwolffe  probably not a fix, but after converting
  //                  to .wav ... maybe?? maybe try those files???
  function doShit(surfer, plg) {
    console.log('MATT. the daw. is.... prêt');
    console.log(surfer.getDuration());
    surfer.registerPlugin(plg);
  }

  isReady && doShit(wavesurfer, hover);

  // SEEME @mfwolffe basically try this within that
  //                 functiuon in the short circuit
  // const envelope = wavesurfer.registerPlugin(
  //   EnvelopePlugin.create({
  //     volume: 0.8,
  //     lineWidth: 3.5,
  //     dragLine: true,
  //     dragPointSize: 20,
  //     lineColor: 'rgba(219, 13, 13, 0.9)',
  //     // lineColor: 'rgba(219, 86, 33, 0.9)',

  //     dragPointStroke: 'rgba(0, 0, 0, 0.5)',
  //     dragPointFill: 'rgba(0, 255, 255, 0.8)',

  //     points: [
  //       { time: 0.0, volume: 0.2 },
  //       { time: 3, volume: 0.9 },
  //       { time: 4, volume: 0.1 },
  //       { time: 5, volume: 0.7 },
  //     ],
  //   })
  // );

  // envelope.on('points-change', (points) => {
  //   console.log('Envelope points changed', points);
  // });

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
            className="w-95 ml-auto mr-auto"
          />

          <div className="d-flex justify-content-between">
            <div>
              <p>
                Current audio: {audioUrls[urlIndex]}, performed by the UNC
                Symphony Orchestra, featuring yours truly (I'm the lowest
                sounding brass 'voice').
              </p>
              <p>Current time: {formatTime(currentTime)}</p>
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
            <button onClick={onUrlChange}>Change audio</button>

            <button onClick={onPlayPause} style={{ minWidth: '5em' }}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>
        </Card.Body>
      </Card>
    </Layout>
  );
};

export default BasicDaw;
