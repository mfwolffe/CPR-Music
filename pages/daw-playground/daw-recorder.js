import * as React from 'react';
import { Card } from 'react-bootstrap';
import Button from 'react-bootstrap/Button';
import Layout from '../../components/layout';
import { useWavesurfer } from '@wavesurfer/react';
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js';

import { BsRecordCircle } from 'react-icons/bs';
import { FaRegCircleStop } from 'react-icons/fa6';
import { FaRegCirclePlay } from 'react-icons/fa6';
import { FaRegCirclePause } from 'react-icons/fa6';
import { FaArrowRotateLeft } from 'react-icons/fa6';
import { FaArrowRotateRight } from 'react-icons/fa6';

const stopButton = <FaRegCircleStop fontSize="1rem" />;
const playButton = <FaRegCirclePlay fontSize="1rem" />;
const pauseButton = <FaRegCirclePause fontSize="1rem" />;
const backTenButton = <FaArrowRotateLeft fontSize="1rem" />;
const skipTenButton = <FaArrowRotateRight fontSize="1rem" />;
const { useMemo, useState, useCallback, useRef, useEffect } = React;

export default function DawRecorder() {
  const dawRef = useRef(null);
  const [isRecord, setIsRecord] = useState(false);
  const [audioURL, setAudioURL] = useState(''); // SEEME @mfwolffe working w/out audio file loaded

  const { wavesurfer, isPlaying, currentTime, isRecording } = useWavesurfer({
    container: dawRef,
    height: 196,
    waveColor: 'violet',
    progressColor: 'aqua',
    url: audioURL,
    plugins: useMemo(() => [], []),
  });

  const record = wavesurfer?.registerPlugin(RecordPlugin.create({ scrollingWaveform: false, renderRecordedAudio: false }));

  record?.on('record-end', (blob) => {
    console.log("stopped recording");
    const url = URL.createObjectURL(blob);
    setAudioURL(url);
    console.log("url", url);
  });

  // const onReady = (surfer) => {
  //   console.log("prêt-ty");
  //   setWavesurfer(surfer);
  //   setIsPlaying(false);

  //   if (!recAdded) {
  //     // surfer.empty();
  //     surfer.registerPlugin(record);
  //     setRecAdded(true);
  //     console.log("recorder added");
  //   }

  //   console.log(surfer.getActivePlugins());
  // };

  // const onInit = (surfer) => {
  //   console.log("inittt");
  //   setWavesurfer(surfer);
  //   setIsPlaying(false);
  //   if (!recAdded) {
  //     // surfer.empty();
  //     surfer.registerPlugin(record);
  //     setRecAdded(true);
  //     console.log("recorder added");
  //   }
  //   console.log(surfer.getActivePlugins());

  // }

  const onPlayPause = useCallback(() => {
    wavesurfer && wavesurfer.playPause()
  }, [wavesurfer])
  
  const onSkipTenFwd = useCallback(() => {
    wavesurfer.skip(10);
  });
  
  const onSkipTenBkwd = useCallback(() => {
    wavesurfer.skip(-10);
  });

  const onStopSeekZero = useCallback((e) => {
    wavesurfer.seekTo(0);
    wavesurfer.isPlaying() && wavesurfer.pause();
  });

  useEffect(() => {
    if (!isRecord && (record?.isRecording() || record?.isPaused())) {
      console.log("stopping record");
      record.stopRecording();
      console.log(wavesurfer.getActivePlugins());
      return;
    }

    const micID = RecordPlugin.getAvailableAudioDevices().then((devices) => devices[0].deviceId);
    
    if (!record?.isRecording() && isRecord) {
      record?.startRecording({ micID }).then(() => {
        console.log("recording");
      });
    }

  }, [isRecord]);


  const handleRecordStart = useCallback(() => {
    setIsRecord(true);
  });

  const handleRecordStop = useCallback(() => {
    setIsRecord(false);
  });

  return (
    <Layout>
      <h1>DAW + Recording</h1>
      <Card className="ml-auto mr-auto w-90" id="daw-card">
        <Card.Body>
          <Card.Title>
            <strong>Ceci n'est pas une daw</strong>
          </Card.Title>
          <div className="d-flex w-95 ml-auto mr-auto mt-2 toolbar align-items-center flex-row gap-0375">
            <Button className="prog-button pl-2" onClick={handleRecordStart}>
              <BsRecordCircle fontSize="1rem" />
            </Button>
            <Button className='prog-button' onClick={handleRecordStop}>
              <FaRegCircleStop fontSize="1rem" />
            </Button>
          </div>

          <div
            ref={dawRef}
            id="waveform"
            className="w-95 ml-auto mr-auto mb-0 mt-0"
          />

          {/* SEEME @mfwolffe this approach may be 
            *                 fruitful for the editor version
            */}
          {/* <div className='w-95 ml-auto mr-auto mb-0 mt-0 bg-dawgrey'>
            <WavesurferPlayer url="" waveColor="#4B9CD3" progressColor="#450084" onInit={onInit} height={186} />
          </div> */}

          <div className="d-flex w-95 ml-auto mr-auto prog-bar align-items-center flex-row gap-0375">
            <Button onClick={onSkipTenBkwd} className="prog-button pl-1">
              {backTenButton}
            </Button>
            <Button className="prog-button" onClick={onStopSeekZero}>
              {stopButton}
            </Button>
            <Button onClick={onPlayPause} className="prog-button">
              {isPlaying ? pauseButton : playButton}
            </Button>
            <Button onClick={onSkipTenFwd} className="prog-button">
              {skipTenButton}
            </Button>

            {/* TODO @mfwolffe - show live duration 
              */}
            {/* <span
              className="pl-1 pt-0 pb-0"
              style={{ color: isPlaying ? 'aqua' : 'white' }}
            >
              {formatTime(currentTime)}
            </span> */}

          </div>
        </Card.Body>
      </Card>
    </Layout>
  );
}
