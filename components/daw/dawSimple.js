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
  CardHeader,
  CardTitle,
  Form,
} from 'react-bootstrap';

import { formatTime } from '../../lib/dawUtils';

import SimpleDawControlsTop from '../../components/daw/simpleControlsTop';
import SimpleDawControlsBottom from '../../components/daw/simpleControlsBottom';

const { useMemo, useState, useCallback, useRef, useEffect } = React;

const EQWIDTH = 28;
const RVBWIDTH = 16;
const CHRWIDTH = 24;

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

const audio = new Audio();
audio.controls = false;
audio.src = '/sample_audio/uncso-bruckner4-1.mp3';
const origAudioURL = '/sample_audio/uncso-bruckner4-1.mp3';

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

export default function DawSimple() {
  let disableRegionCreate;
  let zoom, hover, minimap, timeline, regions;

  const dawRef = useRef(null);
  const audioRef = useRef(audio);
  const ffmpegRef = useRef(new FFmpeg());

  const [decay, setDecay] = useState(0);
  const [delay, setDelay] = useState(0);
  const [inGain, setInGain] = useState(0);
  const [outGain, setOutGain] = useState(0);
  const [speedChr, setSpeedChr] = useState(0);
  const [delayChr, setDelayChr] = useState(0);
  const [decayChr, setDecayChr] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [depthsChr, setDepthsChr] = useState(0);
  const [inGainChr, setInGainChr] = useState(0);
  const [cutRegion, setCutRegion] = useState('');
  const [outGainChr, setOutGainChr] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [eqPresent, setEqPresent] = useState(false);
  const [mapPresent, setMapPrsnt] = useState(false);
  const [rvbPresent, setRvbPresent] = useState(false);
  const [chrPresent, setChrPresent] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [editListIndex, setEditListIndex] = useState(0);
  const [editList, setEditList] = useState([
    '/sample_audio/uncso-bruckner4-1.mp3',
  ]);
  const [audioURL, setAudioURL] = useState(
    '/sample_audio/uncso-bruckner4-1.mp3'
  );

  const ReverbTool = (hide) => {
    const hidden = hide;

    return (
      <>
        <Card id="reverb" hidden={hidden} style={{ width: `${RVBWIDTH}%` }}>
          <CardHeader className="text-center text-white pt-1 pb-1 bg-daw-toolbars">
            <CardTitle className="pt-0 pb-0 mt-0 mb-0">Reverb</CardTitle>
          </CardHeader>
          <CardBody className="bg-dawcontrol text-white pl-0 pr-0 pt-2 pb-0">
            <div className="d-flex gap-2 mlr-a w-fc">
              <div className="mb-0 pb-0">
                <div className="d-flex gap-2">
                  {WidgetSlider(0, 1, 0.001, 0, setInGain, 'Input')}
                  {WidgetSlider(0, 1, 0.001, 0, setOutGain, 'Output')}
                </div>
                <p className="text-center mt-0 mb-0">
                  <strong>Gain</strong>
                </p>
              </div>
              <div className="mb-0 pb-0">
                <div className="d-flex gap-2">
                  {WidgetSlider(0.1, 90000.0, 1, 1000, setDelay, 'Delay')}
                  {WidgetSlider(0.1, 1, 0.001, 0.1, setDecay, 'Decay')}
                </div>
              </div>
            </div>
            <div className="d-flex justify-content-end">
              <Button size="sm" className="mb-1 mr-1" onClick={updateReverb}>
                Apply
              </Button>
            </div>
          </CardBody>
        </Card>
      </>
    );
  };

  const chorusToggle = (hide) => {
    const hidden = hide;

    return (
      <>
        <Card id="chorus" hidden={hidden} style={{ width: `${CHRWIDTH}%` }}>
          <CardHeader className="text-center text-white pt-1 pb-1 bg-daw-toolbars">
            <CardTitle className="pt-0 pb-0 mt-0 mb-0">Chorus</CardTitle>
          </CardHeader>
          <CardBody className="bg-dawcontrol text-white pl-0 pr-0 pt-2 pb-0">
            <div className="d-flex gap-2 mlr-a w-fc">
              <div className="mb-0 pb-0">
                <div className="d-flex gap-2">
                  {WidgetSlider(0, 1, 0.001, 0, setInGainChr, 'Input')}
                  {WidgetSlider(0, 1, 0.001, 0, setOutGainChr, 'Output')}
                </div>
                <p className="text-center mt-0 mb-0">
                  <strong>Gain</strong>
                </p>
              </div>
              <div className="mb-0 pb-0">
                <div className="d-flex gap-2">
                  {WidgetSlider(0, 70, 0.1, 0, setDelayChr, 'Delay')}
                  {WidgetSlider(0.01, 1, 0.001, 0.01, setDecayChr, 'Decay')}
                </div>
              </div>
              <div className="mb-0 pb-0">
                <div className="d-flex gap-2">
                  {WidgetSlider(0.1, 90000.0, 0.1, 1000, setSpeedChr, 'Speed')}
                  {WidgetSlider(0.01, 4, 0.001, 1, setDepthsChr, 'Depth')}
                </div>
              </div>
            </div>
            <div className="d-flex justify-content-end">
              <Button size="sm" className="mb-1 mr-1" onClick={applyChorus}>
                Apply
              </Button>
            </div>
          </CardBody>
        </Card>
      </>
    );
  };

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
        new Blob([data.buffer], { type: 'audio/mp3' })
      );
    }

    setAudioURL(audioRef.current.src);
    console.log('transcode done', audioRef.current.src);
    wavesurfer.load(audioRef.current.src);
    setEditList([...editList, audioRef.current.src]);
    setEditListIndex(editListIndex + 1);
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
        new Blob([data.buffer], { type: 'audio/mp3' })
      );
    }

    setAudioURL(audioRef.current.src);
    console.log('deletion done', audioRef.current.src);
    wavesurfer.load(audioRef.current.src);
    setEditList([...editList, audioRef.current.src]);
    setEditListIndex(editListIndex + 1);
  };

  const updateReverb = async () => {
    console.log('values:');
    console.log(inGain, outGain, delay, decay);
    const ffmpeg = ffmpegRef.current;

    await ffmpeg.writeFile('input.mp3', await fetchFile(audioURL));
    await ffmpeg.exec([
      '-i',
      'input.mp3',
      '-map',
      '0',
      '-af',
      `aecho=${inGain}:${outGain}:${delay}:${decay}`,
      'output.mp3',
    ]);

    const data = await ffmpeg.readFile('output.mp3');
    if (audioRef.current) {
      audioRef.current.src = URL.createObjectURL(
        new Blob([data.buffer], { type: 'audio/mp3' })
      );
    }

    setAudioURL(audioRef.current.src);
    console.log('reverb updated', audioRef.current.src);
    wavesurfer.load(audioRef.current.src);
    setEditList([...editList, audioRef.current.src]);
    setEditListIndex(editListIndex + 1);
  };

  const applyChorus = async () => {
    const ffmpeg = ffmpegRef.current;
    await ffmpeg.writeFile('input.mp3', await fetchFile(audioURL));
    await ffmpeg.exec([
      '-i',
      'input.mp3',
      '-af',
      `chorus=${inGainChr}:${outGainChr}:${delayChr}:${decayChr}:${speedChr}:${depthsChr}`,
      'output.mp3',
    ]);

    const data = await ffmpeg.readFile('output.mp3');
    if (audioRef.current) {
      audioRef.current.src = URL.createObjectURL(
        new Blob([data.buffer], { type: 'audio/mp3' })
      );
    }

    setAudioURL(audioRef.current.src);
    console.log('chorus updated', audioRef.current.src);
    wavesurfer.load(audioRef.current.src);
    setEditList([...editList, audioRef.current.src]);
    setEditListIndex(editListIndex + 1);
  };

  useEffect(() => {
    console.log('blobs', editList);
  }, [editList]);

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

  useEffect(() => {
    async function updatePlaybackSpeed() {
      const ffmpeg = ffmpegRef.current;
      await ffmpeg.writeFile('input.mp3', await fetchFile(origAudioURL));
      await ffmpeg.exec([
        '-i',
        'input.mp3',
        '-af',
        `atempo=${playbackSpeed}`,
        'output.mp3',
      ]);

      const data = await ffmpeg.readFile('output.mp3');
      if (audioRef.current) {
        audioRef.current.src = URL.createObjectURL(
          new Blob([data.buffer], { type: 'audio/mp3' })
        );
      }

      setAudioURL(audioRef.current.src);
      console.log('speed adjust done', audioRef.current.src);
      wavesurfer.load(audioRef.current.src);
    }

    if (ffmpegRef.current.loaded) updatePlaybackSpeed();
  }, [playbackSpeed]);

  const restoreState = (index) => {
    if (index < 0 || index >= editList.length) return;

    console.log('current list', editList);
    console.log('restoring to index', index);
    wavesurfer.load(editList[index]);
    setEditListIndex(index);
  };

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
                (rvbPresent || eqPresent || chrPresent ? 1.5 : 0) -
                (eqPresent ? EQWIDTH : 0) -
                (rvbPresent ? RVBWIDTH : 0) -
                (chrPresent ? CHRWIDTH : 0)
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
              chrPresent={chrPresent}
              chrSetter={setChrPresent}
              editIndex={editListIndex}
              editList={editList}
              restoreState={restoreState}
            />
            <div
              ref={dawRef}
              id="waveform"
              className="ml-auto mr-auto mb-0 mt-0"
            />
            {MinimapContainer(!mapPresent)}
            <SimpleDawControlsBottom
              waveSurfer={wavesurfer}
              playbackSpeed={playbackSpeed}
              speedSetter={setPlaybackSpeed}
            />
          </div>
          {EQSliders(!eqPresent)}
          {ReverbTool(!rvbPresent)}
          {chorusToggle(!chrPresent)}
        </div>
      </CardBody>
    </Card>
  );
}
