import * as React from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import Zoom from 'wavesurfer.js/dist/plugins/zoom.esm.js';
import Hover from 'wavesurfer.js/dist/plugins/hover.esm.js';
import Minimap from 'wavesurfer.js/dist/plugins/minimap.esm.js';
import Timeline from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Form,
} from 'react-bootstrap';

import SimpleDawControlsTop from '../../components/daw/simpleControlsTop';
import SimpleDawControlsBottom from '../../components/daw/simpleControlsBottom';

const { useMemo, useState, useCallback, useRef } = React;

const EQCAP = 26;
const EQWIDTH = 38;

addEventListener('dataavailable', (event) => {
  console.log('event', event);
});

const formatTime = (seconds) =>
  [seconds / 60, seconds % 60]
    .map((v) => `0${Math.floor(v)}`.slice(-2))
    .join(':');

const MinimapContainer = function (hide) {
  const hidden = hide;

  return (
    <div
      className="w-100 ml-auto mr-auto mmap-container"
      id="mmap"
      hidden={hidden}
    />
  );
};

const audio = new Audio();
audio.controls = false;
audio.src = '/sample_audio/uncso-bruckner4-1.mp3';

const audioContext = new AudioContext();
const eqBands = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

const filters = eqBands.map((band) => {
  const filter = audioContext.createBiquadFilter();
  filter.type =
    band <= 32 ? 'lowshelf' : band >= 16000 ? 'highshelf' : 'peaking';
  filter.gain.value = 0;
  filter.Q.value = 1; // resonance
  filter.frequency.value = band; // cut-off frequency
  return filter;
});

audio.addEventListener(
  'canplay',
  () => {
    const mediaNode = audioContext.createMediaElementSource(audio);

    const equalizer = filters.reduce((prev, curr) => {
      prev.connect(curr);
      return curr;
    }, mediaNode);

    equalizer.connect(audioContext.destination);
  },
  { once: true }
);

const EQSliders = (hide) => {
  const hidden = hide;
  const sliders = [];

  filters.forEach((filter) => {
    const frqVal = filter.frequency.value;
    const slider = (
      <>
        <div className="d-flex" key={`${frqVal} MHz`}>
          <Form.Label style={{ width: '6rem' }}>{frqVal} MHz</Form.Label>
          <Form.Range
            min={-EQCAP}
            max={EQCAP}
            step={0.1}
            style={{ width: '10rem' }}
            onInput={(e) => (filter.gain.value = e.target.value)}
          ></Form.Range>
        </div>
      </>
    );
    sliders.push(slider);
  });

  return (
    <>
      <Card id="equalizer" hidden={hidden} style={{ width: `${EQWIDTH}%` }}>
        <CardHeader className="text-center text-white pt-1 pb-1 bg-daw-toolbars">
          <CardTitle className="pt-0 pb-0 mt-0 mb-0">Equalizer</CardTitle>
        </CardHeader>
        <CardBody className="bg-dawcontrol text-white pl-3 pr-3 pt-2 pb-2">
          <div className="d-flex gap-2">
            <div>{sliders.slice(0, 5)}</div>
            <div>{sliders.slice(5, 10)}</div>
          </div>
        </CardBody>
      </Card>
    </>
  );
};

const trimAudio = function (offset) {
  const source = audioContext.createBufferSource();
  const dest = audioContext.createMediaStreamDestination();
  const mediaRecorder = new MediaRecorder(dest.stream);

  const request = new XMLHttpRequest();
  request.open('GET', '/sample_audio/uncso-bruckner4-1.mp3', true);
  request.responseType = 'arraybuffer';

  request.onload = function () {
    const audioData = request.response;
    audioContext.decodeAudioData(
      audioData,
      function (buffer) {
        source.buffer = buffer;
        source.connect(dest);
        mediaRecorder.start();
        source.start(audioContext.currentTime, 3);
        mediaRecorder.stop();
        source.disconnect(dest);
      },
      function (e) {
        console.log('Error during audio decode: ', e.err);
      }
    );
  };
  console.log('bout to send');
  request.send();
};

export default function DawSimple() {
  let disableRegionCreate;
  let zoom, hover, minimap, timeline, regions;

  const dawRef = useRef(null);
  const [eqPresent, setEqPresent] = useState(false);
  const [mapPresent, setMapPrsnt] = useState(false);

  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    height: 196,
    media: audio,
    barHeight: 0.8,
    cursorWidth: 2,
    autoScroll: true,
    dragToSeek: true,
    container: dawRef,
    waveColor: '#7bafd4',
    cursorColor: 'var(--jmu-gold)',
    hideScrollbar: false,
    progressColor: '#92ce84',
    plugins: useMemo(() => [], []),
  });

  wavesurfer?.once('ready', () => {
    zoom = wavesurfer?.registerPlugin(
      Zoom.create({
        deltaThreshold: 5,
        maxZoom: 150,
        scale: 0.125,
      })
    );

    hover = wavesurfer?.registerPlugin(
      Hover.create({
        lineWidth: 2,
        labelSize: 12,
        labelColor: '#fff',
        formatTimeCallback: formatTime,
        lineColor: 'var(--jmu-gold)',
      })
    );

    minimap = wavesurfer?.registerPlugin(
      Minimap.create({
        height: 35,
        dragToSeek: true,
        container: '#mmap',
        waveColor: '#b999aa',
        cursorColor: 'var(--jmu-gold)',
        progressColor: '#92ceaa',
        cursorWidth: 2,
      })
    );

    timeline = wavesurfer?.registerPlugin(
      Timeline.create({
        height: 24,
        insertPosition: 'beforebegin',
        style: 'color: #e6dfdc; background-color: var(--daw-timeline-bg)',
      })
    );

    regions = wavesurfer?.registerPlugin(RegionsPlugin.create());
    disableRegionCreate = regions?.enableDragSelection({
      color: 'rgba(155, 115, 215, 0.4)', // FIXME @mfwolffe color param has no effect
    });
    regions?.on('region-created', () => disableRegionCreate());
    regions?.on('region-double-clicked', (region, e) => {
      region.remove();
      disableRegionCreate = regions.enableDragSelection();
    });
  });

  console.log('plugins:', wavesurfer?.getActivePlugins());

  return (
    <Card className="mt-2 mb-2">
      <CardHeader className="pt-1 pb-1">
        <CardTitle className="pt-0 pb-0 mt-0 mb-0">Audio Editor</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="d-flex w-100 gap-2p">
          <div
            id="waveform-container"
            className="w-100"
            style={{ width: eqPresent ? `${100 - 1.5 - EQWIDTH}%` : '100%' }}
          >
            <SimpleDawControlsTop
              waveSurfer={wavesurfer}
              mapPresent={mapPresent}
              mapSetter={setMapPrsnt}
              eqSetter={setEqPresent}
              eqPresent={eqPresent}
            />
            <div
              ref={dawRef}
              id="waveform"
              className="ml-auto mr-auto mb-0 mt-0"
            />
            {MinimapContainer(!mapPresent)}
            <SimpleDawControlsBottom waveSurfer={wavesurfer} />
          </div>
          {EQSliders(!eqPresent)}
        </div>
      </CardBody>
      <Button onClick={trimAudio}>trimmy</Button>
    </Card>
  );
}
