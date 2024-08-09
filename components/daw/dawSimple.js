import * as React from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import Zoom from 'wavesurfer.js/dist/plugins/zoom.esm.js';
import Hover from 'wavesurfer.js/dist/plugins/hover.esm.js';
import Minimap from 'wavesurfer.js/dist/plugins/minimap.esm.js';
import Timeline from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { Card, CardBody, CardHeader, CardTitle, Form } from 'react-bootstrap';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

import EQSliders from './equalizer';
import { MinimapContainer } from './common';
import WidgetSlider from './widgetSliderVertical';
import SliderWidgetVertical from './reverbWidget';
import { formatTime, restoreState } from '../../lib/dawUtils';
import SimpleDawControlsTop from '../../components/daw/simpleControlsTop';
import SimpleDawControlsBottom from '../../components/daw/simpleControlsBottom';

import { loadFfmpeg } from '../../lib/dawUtils';
import { setupAudioContext } from '../../lib/dawUtils';

const { useMemo, useState, useCallback, useRef, useEffect } = React;

const EQWIDTH = 28;
const RVBWIDTH = 16;
const CHRWIDTH = 24;
const ORIGURL = '/sample_audio/uncso-bruckner4-1.mp3';
const { audio, audioContext, filters } = setupAudioContext();

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

  const chorusSliders = [
    WidgetSlider(0, 1, 0.001, 0, setInGainChr, 'Input'),
    WidgetSlider(0, 1, 0.001, 0, setOutGainChr, 'Output'),
    WidgetSlider(0, 70, 0.1, 0, setDelayChr, 'Delay'),
    WidgetSlider(0.01, 1, 0.001, 0.01, setDecayChr, 'Decay'),
    WidgetSlider(0.1, 90000.0, 0.1, 1000, setSpeedChr, 'Speed'),
    WidgetSlider(0.01, 4, 0.001, 1, setDepthsChr, 'Depth'),
  ];

  const reverbSliders = [
    WidgetSlider(0, 1, 0.001, 0, setInGain, 'Input'),
    WidgetSlider(0, 1, 0.001, 0, setOutGain, 'Output'),
    WidgetSlider(0.1, 90000.0, 1, 1000, setDelay, 'Delay'),
    WidgetSlider(0.1, 1, 0.001, 0.1, setDecay, 'Decay'),
  ];

  const applyReverb = async () => {
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

    if (!loaded) loadFfmpeg(ffmpegRef, setLoaded, setIsLoading);
  });

  useEffect(() => {
    async function updatePlaybackSpeed() {
      const ffmpeg = ffmpegRef.current;
      await ffmpeg.writeFile('input.mp3', await fetchFile(ORIGURL));
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
              // transcoder={transcoder}
              // destroyRegion={destroyRegion}
              ffmpegRef={ffmpegRef}
              ffmpegLoaded={loaded}
              rvbPresent={rvbPresent}
              rvbSetter={setRvbPresent}
              chrPresent={chrPresent}
              chrSetter={setChrPresent}
              editIndex={editListIndex}
              indexSetter={setEditListIndex}
              editList={editList}
              listSetter={setEditList}
              restoreState={restoreState}
              urlSetter={setAudioURL}
              audioRef={audioRef}
              audioURL={audioURL}
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
          {EQSliders(!eqPresent, filters, EQWIDTH)}
          {/* {ReverbTool(!rvbPresent)} */}
          <SliderWidgetVertical
            hide={!rvbPresent}
            width={RVBWIDTH}
            sliders={reverbSliders}
            handler={applyReverb}
            title={'Reverb'}
            hasButton={true}
          />
          {/* {chorusToggle(!chrPresent)} */}
          <SliderWidgetVertical
            hide={!chrPresent}
            width={CHRWIDTH}
            sliders={chorusSliders}
            handler={applyChorus}
            title={'Chorus'}
            hasButton={true}
          />
        </div>
      </CardBody>
    </Card>
  );
}
