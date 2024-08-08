import * as React from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import Zoom from 'wavesurfer.js/dist/plugins/zoom.esm.js';
import Hover from 'wavesurfer.js/dist/plugins/hover.esm.js';
import Minimap from 'wavesurfer.js/dist/plugins/minimap.esm.js';
import Timeline from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Form,
} from 'react-bootstrap';

import SimpleDawControlsTop from '../../components/daw/simpleControlsTop';
import SimpleDawControlsBottom from '../../components/daw/simpleControlsBottom';

const { useMemo, useState, useCallback, useRef } = React;

const EQCAP = 26;
const EQWIDTH = 28;
const RVBWIDTH = 16;

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
          <Form.Label style={{ width: '40%' }}>{frqVal} MHz</Form.Label>
          <Form.Range
            min={-EQCAP}
            max={EQCAP}
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
      <Card id="equalizer" hidden={hidden} style={{ width: `${EQWIDTH}%` }}>
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

const ReverbTool = (hide) => {
  const hidden = hide;

  const gain = (
    <div className="mb-0 pb-0">
      <div className="d-flex gap-2">
        <div className="d-block">
          <input type="range" orient="vertical" className="mlr-auto"></input>
          <Form.Label className="d-block text-center mb-0">Input</Form.Label>
        </div>
        <div className="d-block">
          <input type="range" orient="vertical" className="mlr-auto"></input>
          <Form.Label className="d-block text-center mb-0">Output</Form.Label>
        </div>
      </div>
      <p className="text-center mt-0 mb-0">
        <strong>Gain</strong>
      </p>
    </div>
  );

  const decayDelay = (
    <div className="mb-0 pb-0">
      <div className="d-flex gap-2">
        <div>
          <input type="range" orient="vertical" className="mlr-auto"></input>
          <Form.Label className="d-block text-center mb-0">Delay</Form.Label>
        </div>
        <div>
          <input type="range" orient="vertical" className="mlr-a"></input>
          <Form.Label className="d-block text-center mb-0">Decay</Form.Label>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Card id="reverb" hidden={hidden} style={{ width: `${RVBWIDTH}%` }}>
        <CardHeader className="text-center text-white pt-1 pb-1 bg-daw-toolbars">
          <CardTitle className="pt-0 pb-0 mt-0 mb-0">Reverb</CardTitle>
        </CardHeader>
        <CardBody className="bg-dawcontrol text-white pl-0 pr-0 pt-2 pb-0">
          <div className="d-flex gap-2 mlr-a w-fc">
            {gain}
            {decayDelay}
          </div>
          <div className="d-flex justify-content-end">
            <Button size="sm" className="mb-1 mr-1">
              Apply
            </Button>
          </div>
        </CardBody>
      </Card>
    </>
  );
};

export default function DawSimple() {
  let disableRegionCreate;
  let zoom, hover, minimap, timeline, regions;

  const dawRef = useRef(null);
  const [audioURL, setAudioURL] = useState(
    '/sample_audio/uncso-bruckner4-1.mp3'
  );
  const audioRef = useRef(audio);
  const ffmpegRef = useRef(new FFmpeg());

  const [loaded, setLoaded] = useState(false);
  const [cutRegion, setCutRegion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [eqPresent, setEqPresent] = useState(false);
  const [mapPresent, setMapPrsnt] = useState(false);
  const [rvbPresent, setRvbPresent] = useState(false);

  const load = async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    const ffmpeg = ffmpegRef.current;

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        'application/wasm'
      ),
      // workerURL: await toBlobURL(
      //   `${baseURL}/ffmpeg-core.worker.js`,
      //   'text/javascript'
      // ),
    });
    setLoaded(true);
    setIsLoading(false);
    console.log('loaded');
  };

  const transcode = async (region) => {
    if (!region) {
      console.log('bad region');
      return;
    }

    const start = region.start;
    const ffmpeg = ffmpegRef.current;
    const duration = region.end - start;

    console.log('start, end', start);
    // const audioURL = '/sample_audio/uncso-bruckner4-1.mp3';

    await ffmpeg.writeFile('input.mp3', await fetchFile(audioURL));
    await ffmpeg.exec([
      '-ss',
      `${start}`,
      '-i',
      'input.mp3',
      '-t',
      `${duration}`,
      'output.mp3',
    ]);

    const data = await ffmpeg.readFile('output.mp3');
    if (audioRef.current) {
      audioRef.current.src = URL.createObjectURL(
        new Blob([data.buffer], { type: 'video/mp4' })
      );
    }

    setAudioURL(audioRef.current.src);
    console.log('transcode done', audioRef.current.src);
    wavesurfer.load(audioRef.current.src);
  };

  const destroyRegion = async (region) => {
    if (!region) {
      console.log('bad region');
      return;
    }

    const end = region.end;
    const start = region.start;
    const ffmpeg = ffmpegRef.current;

    await ffmpeg.writeFile('input.mp3', await fetchFile(audioURL));
    await ffmpeg.exec([
      '-i',
      'input.mp3',
      '-filter_complex',
      `[0]atrim=duration=${start}[a];[0]atrim=start=${end}[b];[a][b]concat=n=2:v=0:a=1`,
      'output.mp3',
    ]);
    const data = await ffmpeg.readFile('output.mp3');
    if (audioRef.current) {
      audioRef.current.src = URL.createObjectURL(
        new Blob([data.buffer], { type: 'video/mp4' })
      );
    }

    setAudioURL(audioRef.current.src);
    console.log('deletion done', audioRef.current.src);
    wavesurfer.load(audioRef.current.src);
  };

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
    if (wavesurfer.getActivePlugins().length === 0) {
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
      regions?.on('region-created', (region) => {
        disableRegionCreate();
        setCutRegion(region);
      });
      regions?.on('region-double-clicked', (region) => {
        region.remove();
        disableRegionCreate = regions.enableDragSelection();
      });
    }

    if (!loaded) load();
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
            // className="w-100"
            style={{
              width: `${
                100 -
                (rvbPresent || eqPresent ? 1.5 : 0) -
                (eqPresent ? EQWIDTH : 0) -
                (rvbPresent ? RVBWIDTH : 0)
              }%`,
            }}
          >
            <SimpleDawControlsTop
              waveSurfer={wavesurfer}
              mapPresent={mapPresent}
              mapSetter={setMapPrsnt}
              eqSetter={setEqPresent}
              eqPresent={eqPresent}
              cutRegion={cutRegion}
              transcoder={transcode}
              destroyRegion={destroyRegion}
              ffmpegLoaded={loaded}
              rvbPresent={rvbPresent}
              rvbSetter={setRvbPresent}
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
          {ReverbTool(!rvbPresent)}
        </div>
      </CardBody>
    </Card>
  );
}
