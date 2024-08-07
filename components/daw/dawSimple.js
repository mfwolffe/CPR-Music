import * as React from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import Zoom from 'wavesurfer.js/dist/plugins/zoom.esm.js';
import Hover from 'wavesurfer.js/dist/plugins/hover.esm.js';
import Minimap from 'wavesurfer.js/dist/plugins/minimap.esm.js';
import Timeline from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import { Card, CardBody, CardHeader, CardTitle } from 'react-bootstrap';

import SimpleDawControlsTop from '../../components/daw/simpleControlsTop';
import SimpleDawControlsBottom from '../../components/daw/simpleControlsBottom';

const { useMemo, useState, useCallback, useRef } = React;

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

export default function DawSimple() {
  const dawRef = useRef(null);

  const [mapPresent, setMapPrsnt] = useState(false);

  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    height: 196,
    url: '/sample_audio/uncso-bruckner4-1.mp3',
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

  let zoom, hover, minimap, timeline;

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
  });

  console.log('plugins:', wavesurfer?.getActivePlugins());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Digital Audio Workstation</CardTitle>
      </CardHeader>
      <CardBody>
        <div id="waveform-container">
          <SimpleDawControlsTop
            waveSurfer={wavesurfer}
            mapPresent={mapPresent}
            mapSetter={setMapPrsnt}
          />
          <div
            ref={dawRef}
            id="waveform"
            className="w-100 ml-auto mr-auto mb-0 mt-0"
          />
          {MinimapContainer(!mapPresent)}
          <SimpleDawControlsBottom waveSurfer={wavesurfer} />
        </div>
      </CardBody>
    </Card>
  );
}
