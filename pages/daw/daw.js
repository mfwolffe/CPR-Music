'use client';

import * as React from 'react';
const { useCallback, useState, useRef } = React;

import Layout from '../../components/layout';
import DawSimple from '../../components/daw/dawSimple';
import { setupAudioContext } from '../../lib/dawUtils';
// import { ErrorBoundary } from 'react-error-boundary';

// TODO @mfwolffe honestly a flag in DawSimple for creative
//                may be better than a distinct component
//                considering redundancies; what should it switch?
//                  - daw title
//                  - incl. spotify API for track import/export + track select/skip?
//                    - one issue w/ this is minimap doubling
//                    - also wth to do wrt undo/redo stack - should a sample import 
//                      count as an 'edit' or should each sample/track have its own undo/redo stack?
//                  - Spectrogram?
//                  - Gain Envelope?
//                    - as it stands the envelope implementation only has an effect on playback, 
//                      NOT the audio file
//
const DawEditorSimple = () => {
  //
  // SEEME @mfwolffe useCallback() does not affect potential race on Audio
  //
  // const setupAudioContext = (src) => {
  //   console.log("passed as src:", src);
  //   const audio = new Audio();
  //   audio.controls = false;
  //   audio.src = src;

  //   const audioContext = new AudioContext();
  //   const eqBands = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

  //   const filters = eqBands.map((band) => {
  //     const filter = audioContext.createBiquadFilter();
  //     filter.type =
  //       band <= 32 ? 'lowshelf' : band >= 16000 ? 'highshelf' : 'peaking';
  //     filter.gain.value = 0;
  //     filter.Q.value = 1; // resonance
  //     filter.frequency.value = band; // cut-off frequency
  //     return filter;
  //   });

  //   audio.addEventListener(
  //     'canplay',
  //     () => {
  //       const mediaNode = audioContext.createMediaElementSource(audio);
  //       const equalizer = filters.reduce((prev, curr) => {
  //         prev.connect(curr);
  //         return curr;
  //       }, mediaNode);
  //       equalizer.connect(audioContext.destination);
  //     },
  //     { once: true }
  //   );

  //   console.log('audio context established');

  //   return {
  //     audio: audio,
  //     audioContext: audioContext,
  //     filters: filters,
  //   };
  // };

  const [url, setURL] = useState("/sample_audio/uncso-bruckner4-1.mp3");
  const { audio, filters } = setupAudioContext(url);
  const audioRef = useRef(audio);

  console.log("audio ref src in dawjs", audioRef.current.src);

  return (
    <Layout>
      <DawSimple takeURL={url} audio={audio} setAudioURL={setURL} filters={filters} />
    </Layout>
  );
}

export default DawEditorSimple;
