// with thanks to https://medium.com/front-end-weekly/recording-audio-in-mp3-using-reactjs-under-5-minutes-5e960defaf10

import {
  FaEdit,
  FaStop,
  FaPlay,
  FaPause,
  FaVolumeUp,
  FaVolumeOff,
  FaMicrophone,
  FaRegTrashAlt,
  FaVolumeDown,
  FaVolumeMute,
  FaCloudUploadAlt,
} from 'react-icons/fa';
import {
  Card,
  Modal,
  Button,
  Spinner,
  CardBody,
  CardTitle,
  CardHeader,
  CardFooter,
} from 'react-bootstrap';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { useRouter } from 'next/router';
import { fetchFile } from '@ffmpeg/util';
import { useDispatch } from 'react-redux';
import { GrHelpBook } from 'react-icons/gr';
import MicRecorder from 'mic-recorder-to-mp3';
import { useWavesurfer } from '@wavesurfer/react';
import ListGroup from 'react-bootstrap/ListGroup';
/* eslint-disable import/extensions */
import Zoom from 'wavesurfer.js/dist/plugins/zoom.esm.js';
import ListGroupItem from 'react-bootstrap/ListGroupItem';
import Hover from 'wavesurfer.js/dist/plugins/hover.esm.js';
import Minimap from 'wavesurfer.js/dist/plugins/minimap.esm.js';
import Timeline from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
/* eslint-enable import/extensions */
import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import styles from '../styles/recorder.module.css';
import StatusIndicator from './statusIndicator';
import HelpModal from './audio/daw/dawHelp';

import {
  loadFfmpeg,
  formatTime,
  formatTimeMilli,
  setupAudioContext,
  effectChorusReverb,
} from '../lib/dawUtils';
import {
  DawControlsBottom,
  DawControlsTop,
  MinimapContainer,
} from './audio/daw/common';
import {
  WidgetSlider,
  ReverbChorusWidget,
  EQSliders,
} from './audio/daw/control';

// TODO @mfwolffe don't do the width calculations like this
const EQWIDTH = 28;
const RVBWIDTH = 13;
const CHRWIDTH = 18;

const scratchURL = '/sample_audio/uncso-bruckner4-1.mp3';
const { audio, audioContext, filters } = setupAudioContext(scratchURL);

function AudioViewer({ src }) {
  const containerW = useRef(null);
  const waveSurf = useRef(null);
  const volume = useRef(null);
  let vMute;
  let vOff;
  let vDown;
  let vUp;
  const play = <FaPlay style={{ paddingLeft: '2px' }} />;
  const pause = <FaPause />;
  const [playing, setPlay] = useState(play);
  const [volumeIndex, changeVolume] = useState(null);

  const toggleVolume = useCallback(() => {
    if (volume.current) {
      const volumeValue = parseFloat(volume.current.value);
      if (volumeValue !== 0) {
        volume.current.value = 0;
        waveSurf.current.setVolume(volume.current.value);
        volume.current.style.setProperty('--volumePercent', `${0}%`);
        changeVolume(vMute);
      } else {
        volume.current.value = 1;
        waveSurf.current.setVolume(volume.current.value);
        volume.current.style.setProperty('--volumePercent', `${100}%`);
        changeVolume(vUp);
      }
    }
  }, []);

  const playPause = useCallback(() => {
    if (waveSurf.current.isPlaying()) {
      setPlay(play);
      waveSurf.current.pause();
    } else {
      setPlay(pause);
      waveSurf.current.play();
    }
  }, []);

  function handleVolumeChange() {
    waveSurf.current.setVolume(volume.current.value);
    const volumeNum = volume.current.value * 100;
    volume.current.style.setProperty('--volumePercent', `${volumeNum}%`);
    if (volume.current.value === 0) {
      changeVolume(vMute);
    } else if (volume.current.value < 0.25) {
      changeVolume(vOff);
    } else if (volume.current.value < 0.5) {
      changeVolume(vDown);
    } else if (volume.current.value < 0.75) {
      changeVolume(vUp);
    }
  }

  vMute = (
    <FaVolumeMute
      style={{
        width: '1.05em',
        height: '1.05em',
        cursor: 'pointer',
        color: 'red',
        paddingLeft: '2px',
      }}
      onClick={toggleVolume}
    />
  );
  vOff = (
    <FaVolumeOff
      style={{ cursor: 'pointer', paddingRight: '9px' }}
      onClick={toggleVolume}
    />
  );
  vDown = (
    <FaVolumeDown
      style={{ cursor: 'pointer', paddingRight: '3px' }}
      onClick={toggleVolume}
    />
  );
  vUp = (
    <FaVolumeUp
      style={{
        width: '1.23em',
        height: '1.23em',
        cursor: 'pointer',
        paddingLeft: '3px',
      }}
      onClick={toggleVolume}
    />
  );

  useEffect(() => {
    changeVolume(vUp);
    if (containerW.current && !waveSurf.current) {
      waveSurf.current = WaveSurfer.create({
        container: containerW.current,
        waveColor: 'blue',
        progressColor: 'purple',
        barWidth: 3,
        barHeight: 0.5,
        barRadius: 3,
        cursorWidth: 3,
        height: 200,
        barGap: 3,
        dragToSeek: true,
        // plugins:[
        //   WaveSurferRegions.create({maxLength: 60}),
        //   WaveSurferTimeLinePlugin.create({container: containerT.current})
        // ]
      });
      if (waveSurf.current) {
        waveSurf.current.load(src);
      }
      if (volume.current && waveSurf.current) {
        waveSurf.current.setVolume(volume.current.value);
        volume.current.addEventListener('input', handleVolumeChange);
      }
    }
  }, []);

  if (waveSurf.current) {
    waveSurf.current.on('finish', () => {
      setPlay(play);
    });
  }

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '0 1rem 0 1rem',
      }}
    >
      <div
        className={styles.waveContainer}
        ref={containerW}
        style={{ width: '100%' }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Button
          style={{
            marginRight: '1rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            padding: '0',
          }}
          onClick={playPause}
        >
          {playing}
        </Button>
        <input
          className={styles.slider}
          style={{ marginRight: '1.5rem' }}
          ref={volume}
          type="range"
          min="0"
          max="1"
          step="0.01"
          defaultValue="1"
        />
        {volumeIndex}
      </div>
    </div>
  );
}

export default function Recorder({ submit, accompaniment }) {
  let zoom;
  let hover;
  let minimap;
  let regions;
  let timeline;
  let disableRegionCreate;

  const dawRef = useRef(null);
  const audioRef = useRef(audio);
  const ffmpegRef = useRef(new FFmpeg());

  // TODO @mfwolffe SURELY many of these do not need state
  //                (I'm like 96% certain though actually; I've had iterations w/out)
  const [decay, setDecay] = useState(0);
  const [delay, setDelay] = useState(0);
  const [inGain, setInGain] = useState(0);
  const [outGain, setOutGain] = useState(0);
  const [speedChr, setSpeedChr] = useState(0);
  const [delayChr, setDelayChr] = useState(0);
  const [decayChr, setDecayChr] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [editList, setEditList] = useState([]);
  const [showDAW, setShowDAW] = useState(false);
  const [depthsChr, setDepthsChr] = useState(0);
  const [inGainChr, setInGainChr] = useState(0);
  const [cutRegion, setCutRegion] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [outGainChr, setOutGainChr] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [eqPresent, setEqPresent] = useState(false);
  const [mapPresent, setMapPrsnt] = useState(false);
  const [rvbPresent, setRvbPresent] = useState(false);
  const [chrPresent, setChrPresent] = useState(false);
  const [audioURL, setAudioURL] = useState(scratchURL);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [editListIndex, setEditListIndex] = useState(0);

  // vertical slider controls for the chorus widget
  const chorusSliders = [
    WidgetSlider(0, 1, 0.001, 0, setInGainChr, 'Input'),
    WidgetSlider(0, 1, 0.001, 0, setOutGainChr, 'Output'),
    WidgetSlider(0, 70, 0.1, 0, setDelayChr, 'Delay'),
    WidgetSlider(0.01, 1, 0.001, 0.01, setDecayChr, 'Decay'),
    WidgetSlider(0.1, 90000.0, 0.1, 1000, setSpeedChr, 'Speed'),
    WidgetSlider(0.01, 4, 0.001, 1, setDepthsChr, 'Depth'),
  ];

  // vertical slider controls for the 'reverb' widget
  // TODO @mfwolffe write the real reverb functionality
  //                (this is really just echo)
  const reverbSliders = [
    WidgetSlider(0, 1, 0.001, 0, setInGain, 'Input'),
    WidgetSlider(0, 1, 0.001, 0, setOutGain, 'Output'),
    WidgetSlider(0.1, 90000.0, 1, 1000, setDelay, 'Delay'),
    WidgetSlider(0.1, 1, 0.001, 0.1, setDecay, 'Decay'),
  ];

  // const Mp3Recorder = new MicRecorder({ bitRate: 128 }); // 128 is default already
  const [isRecording, setIsRecording] = useState(false);
  const [blobURL, setBlobURL] = useState('');
  const [blobData, setBlobData] = useState();
  const [blobInfo, setBlobInfo] = useState([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [recorder, setRecorder] = useState(new MicRecorder());
  const dispatch = useDispatch();
  const [min, setMinute] = useState(0);
  const [sec, setSecond] = useState(0);

  const [takeNo, setTakeNo] = useState(-1);

  // @mfwolffe wavesurfer initialization
  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    height: 208,
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

  // @mfwolffe only attempt to register plugins once
  //           surfer is ready
  //           Also there is superfluous opt chaining
  //           below
  wavesurfer?.once('ready', () => {
    // only add them once, and when you do, add them all at once.
    if (wavesurfer.getActivePlugins().length === 0) {
      zoom = wavesurfer?.registerPlugin(
        Zoom.create({
          deltaThreshold: 5,
          maxZoom: 150,
          scale: 0.125,
        }),
      );

      hover = wavesurfer?.registerPlugin(
        Hover.create({
          lineWidth: 2,
          labelSize: 12,
          labelColor: '#fff',
          formatTimeCallback: formatTime,
          lineColor: 'var(--jmu-gold)',
        }),
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
        }),
      );

      // TODO @mfwolffe get timeline detached ref working
      timeline = wavesurfer?.registerPlugin(
        Timeline.create({
          height: 24,
          insertPosition: 'beforebegin',
          style: 'color: #e6dfdc; background-color: var(--daw-timeline-bg)',
        }),
      );

      regions = wavesurfer?.registerPlugin(RegionsPlugin.create());

      // FIXME @mfwolffe color param has no effect
      disableRegionCreate = regions?.enableDragSelection({
        color: 'rgba(155, 115, 215, 0.4)',
      });

      // subscribe the plugin to region creation event, and disable
      // creating new regions
      //
      // @hcientist wrt design here, idk if locking regions is right -
      //            I can see an argument for allowing multiple region selection
      //            followed by delete button for fast delete of multiple regions etc
      regions?.on('region-created', (region) => {
        disableRegionCreate();
        setCutRegion(region);
      });

      // subscribe the plugin to the macro (?) I've arbitrarily
      // assigned to region deletion: double-clicking w/ mouse on region
      //
      // @hcientist if you have better ideas for deletion design, let me know
      regions?.on('region-double-clicked', (region) => {
        region.remove();
        disableRegionCreate = regions.enableDragSelection();
      });
    }

    // make sure ffmpeg is ready before trying to use it
    if (!loaded) loadFfmpeg(ffmpegRef, setLoaded, setIsLoading);
  });

  // Essentially whenever a new take is selected we need to
  // refresh the audio ref and consequently the surfer
  useEffect(() => {
    // okay this is cruffed (cruft + scuffed)
    // but it does get the job done
    if (audioURL === '/sample_audio/uncso-bruckner4-1.mp3') return;

    async function loadAudio() {
      if (audioRef.current) {
        audioRef.current.src = audioURL;
      }

      setAudioURL(audioRef.current.src);
      wavesurfer?.load(audioRef.current.src);
    }
    
    loadAudio()
      .then(() => setShowDAW(true))
      .catch(console.error());
  }, [audioURL]);

  // TODO @mfwolffe this really needs rethinking - should students be
  //                able to change speed of piece in the data or just during
  //                playback? @hcientist?
  useEffect(() => {
    async function updatePlaybackSpeed() {
      const ffmpeg = ffmpegRef.current;
      await ffmpeg.writeFile('input.mp3', await fetchFile(audioURL));
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
          new Blob([data.buffer], { type: 'audio/mp3' }),
        );
      }

      setAudioURL(audioRef.current.src);
      wavesurfer.load(audioRef.current.src);
    }

    if (ffmpegRef.current.loaded) updatePlaybackSpeed();
  }, [playbackSpeed]);

  // okay this is also 'cruffed' (see above comment if confused)
  // and I really just need to get some of the things out of state
  const params = {
    audioRef,
    setAudioURL,
    audioURL,
    wavesurfer,
    setEditList,
    editList,
    setEditListIndex,
    editListIndex,
    hasButton: true,
    ffmpegRef,
    ffmpegLoaded: loaded,
    handler: effectChorusReverb,
  };

  const accompanimentRef = useRef(null);

  const router = useRouter();
  const { slug, piece, actCategory, partType } = router.query;

  useEffect(() => {
    setBlobInfo([]);
    setBlobURL('');
    setBlobData();
  }, [partType]);

  const startRecording = (ev) => {
    if (isBlocked) {
      console.error('cannot record, microphone permissions are blocked');
    } else {
      accompanimentRef.current.play();
      recorder
        .start()
        .then(() => {
          setIsRecording(true);
        })
        .catch((err) => console.error('problem starting recording', err));
    }
  };

  const stopRecording = (ev) => {
    accompanimentRef.current.pause();
    accompanimentRef.current.load();

    recorder
      .stop()
      .getMp3()
      .then(([buffer, blob]) => {
        setBlobData(blob);
        const url = URL.createObjectURL(blob);
        setBlobURL(url);
        setBlobInfo([
          ...blobInfo,
          {
            url,
            data: blob,
          },
        ]);
        setIsRecording(false);
      })
      .catch((e) => console.error('error stopping recording', e));
  };

  const submitRecording = (i, submissionId) => {
    const formData = new FormData(); // TODO: make filename reflect assignment
    formData.append(
      'file',
      new File([blobInfo[i].data], 'student-recoding.mp3', {
        mimeType: 'audio/mpeg',
      }),
    );
    // dispatch(submit({ audio: formData }));
    submit({ audio: formData, submissionId });
  };

  // SEEME @hcientist do you want me to just wrap this inside 
  // of your submitRecording or keep separate?
  const submitEditedRecording = async (url) => {
    await fetch(url).then(response => response.blob()).then(blob => {      
      const formData = new FormData();
      formData.append('file', new File([blob], `edited-take-${takeNo}.mp3`, { mimeType: "audio/mpeg" }));
      submit({ audio: formData, formData });
    });
  }

  function deleteTake(index) {
    const newInfo = blobInfo.slice();
    newInfo.splice(index, 1);
    setBlobInfo(newInfo);
  }

  // check for recording permissions
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      navigator &&
      navigator.mediaDevices.getUserMedia
    ) {
      navigator.mediaDevices
        .getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false },
        })
        .then(() => {
          setIsBlocked(false);
        })
        .catch(() => {
          console.log('Permission Denied');
          setIsBlocked(true);
        });
    }
  }, []);

  useEffect(() => {
    let interval = null;
    if (isRecording) {
      interval = setInterval(() => {
        setSecond(sec + 1);
        if (sec === 59) {
          setMinute(min + 1);
          setSecond(0);
        }
        if (min === 99) {
          setMinute(0);
          setSecond(0);
        }
      }, 1000);
    } else if (!isRecording && sec !== 0) {
      setMinute(0);
      setSecond(0);
      clearInterval(interval);
    }
    return () => {
      clearInterval(interval);
    };
  }, [isRecording, sec]);

  return (
    <>
      <Row>
        <Col>
          {isRecording ? (
            <Button onClick={stopRecording}>
              <FaStop /> {String(min).padStart(2, '0')}:
              {String(sec).padStart(2, '0')}
            </Button>
          ) : (
            <Button onClick={startRecording}>
              <FaMicrophone />
            </Button>
          )}
        </Col>
      </Row>
      <Row>
        <Col>
          {/* <StatusIndicator statusId={`recording-take-test`} /> */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio ref={accompanimentRef}>
            <source src={accompaniment} type="audio/mpeg" />
          </audio>
          {blobInfo.length === 0 ? (
            <span>No takes yet. Click the microphone icon to record.</span>
          ) : (
            <ListGroup as="ol" numbered>
              {blobInfo.map((take, i) => (
                <ListGroupItem
                  key={take.url}
                  as="li"
                  className="d-flex justify-content-between align-items-center"
                  style={{ fontSize: '1.5rem' }}
                >
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  {/* <audio
                    style={{ height: '2.25rem' }}
                    src={take.url}
                    controls
                  /> */}
                  {/* <AudioViewer src={take.url} /> */}
                  <div>
                    <Button
                      onClick={() => {
                        setTakeNo(i);
                        setAudioURL(take.url);
                      }}
                    >
                      <FaEdit />
                    </Button>
                    <Button
                      onClick={() => submitRecording(i, `recording-take-${i}`)}
                    >
                      <FaCloudUploadAlt />
                    </Button>
                    <Button onClick={() => deleteTake(i)}>
                      <FaRegTrashAlt />
                    </Button>
                  </div>
                  <div className="minWidth">
                    <StatusIndicator statusId={`recording-take-${i}`} />
                  </div>
                </ListGroupItem>
              ))}
            </ListGroup>
          )}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          {/* <audio src={blobURL} /> */}

          <HelpModal setFn={setShowHelp} shown={showHelp} />

          <Card className="mt-2 mb-2" hidden={!showDAW}>
            <CardHeader className="pt-1 pb-1 flex-between dawHeaderFooter align-items-center">
              <CardTitle className="pt-0 pb-0 mt-0 mb-0">
                Audio Editor
              </CardTitle>
              <Button
                className="help-button daw-help align-center"
                onClick={() => setShowHelp(true)}
              >
                <GrHelpBook className="help-ico" fontSize="1.5rem" />
              </Button>
            </CardHeader>
            <CardBody style={{ background: "lightsteelblue" }}>
              <div className="d-flex w-100 gap-2p">
                {/* TODO @mfwolffe don't do widget width calcs like this */}
                <div
                  id="waveform-container"
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
                  <DawControlsTop
                    mapPresent={mapPresent}
                    mapSetter={setMapPrsnt}
                    eqSetter={setEqPresent}
                    eqPresent={eqPresent}
                    cutRegion={cutRegion}
                    rvbPresent={rvbPresent}
                    rvbSetter={setRvbPresent}
                    chrPresent={chrPresent}
                    chrSetter={setChrPresent}
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...params}
                  />
                  <div
                    ref={dawRef}
                    id="waveform"
                    className="ml-auto mr-auto mb-0 mt-0"
                  />
                  {MinimapContainer(!mapPresent)}
                  <DawControlsBottom
                    wavesurfer={wavesurfer}
                    playbackSpeed={playbackSpeed}
                    speedSetter={setPlaybackSpeed}
                  />
                </div>

                <EQSliders
                  hide={!eqPresent}
                  filters={filters}
                  width={EQWIDTH}
                />

                <ReverbChorusWidget
                  hide={!rvbPresent}
                  width={RVBWIDTH}
                  sliders={reverbSliders}
                  title="Reverb"
                  inGainChr={inGain}
                  outGainChr={outGain}
                  delayChr={delay}
                  decayChr={decay}
                  speedChr={null}
                  depthsChr={null}
                  // eslint-disable-next-line react/jsx-props-no-spreading
                  {...params}
                />
                <ReverbChorusWidget
                  hide={!chrPresent}
                  width={CHRWIDTH}
                  sliders={chorusSliders}
                  title="Chorus"
                  inGainChr={inGainChr}
                  outGainChr={outGainChr}
                  delayChr={delayChr}
                  decayChr={decayChr}
                  speedChr={speedChr}
                  depthsChr={depthsChr}
                  // eslint-disable-next-line react/jsx-props-no-spreading
                  {...params}
                />
              </div>
            </CardBody>
            <CardFooter className='dawHeaderFooter'>
              <Button style={{ float: "right" }} onClick={() => submitEditedRecording(audioURL)}>
                Submit with Edits
              </Button>
            </CardFooter>
          </Card>
        </Col>
      </Row>
    </>
  );
}
