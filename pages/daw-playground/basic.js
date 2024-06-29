import * as React from 'react';
import Button from 'react-bootstrap/Button';
import { Card } from 'react-bootstrap';
import Layout from '../../components/layout';
import { useWavesurfer } from '@wavesurfer/react';
// import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
// import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline';
// import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';

const { useMemo, useState, useCallback, useRef, useEffect } = React;

const formatTime = (seconds) =>
  [seconds / 60, seconds % 60]
    .map((v) => `0${Math.floor(v)}`.slice(-2))
    .join(':');

export default function BasicDaw() {
  const containerRef = useRef(null);
  const [audio, setAudio] = useState(null);

  useEffect(() => {
    setAudio(new Audio('/audio/UNCSO-forza-snip.mp3'));
  }, []);

  // const regions = RegionsPlugin.create();

  // const aPlugin = [
  //   {
  //     plugin: RegionsPlugin,
  //     key: 'regions',
  //     options: { dragSelection: true },
  //   },
  // ];

  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    height: 164,
    waveColor: '#7BAFD4', // carolina blue
    progressColor: '#450084', // jmu poiple
    cursorColor: '#CBB677', // jmu gold
    cursorWidth: 3,
    minPxPerSec: 2, // SEEME @mfwolffe - rudimentary zoom?!?!?!
    // plugins: useMemo(() => [Timeline.create()], []),
    media: audio,
    // plugins: [regions],
    // plugins: aPlugin,
  });

  const onPlayPause = useCallback(() => {
    wavesurfer && wavesurfer.playPause();
  }, [wavesurfer]);

  /* ++++++++++++++++++++ VANILLA JS VERSION ; MAY NEED IF REACT PLUGINS DO NOT PAN OUT +++++++++++++++++++ */
  // const wavesurfer = WaveSurfer.create({
  //   container: document.body,
  //   waveColor: 'rgb(200, 0, 200)',
  //   progressColor: 'rgb(100, 0, 100)',
  //   media: audio, // <- this is the important part
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
          <p>
            Playing a snippet of the UNC Symphony Orchestra doing the overture
            of Verdi's <em>La forza del destino</em>, featuring yours truly
          </p>
          <p>Current time: {formatTime(currentTime)}</p>
          <div style={{ margin: '1em 0', display: 'flex', gap: '1em' }}>
            <Button
              variant="secondary"
              onClick={onPlayPause}
              style={{ minWidth: '5em' }}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
          </div>
        </Card.Body>
      </Card>
    </Layout>
  );
}
