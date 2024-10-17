// with thanks to https://medium.com/front-end-weekly/recording-audio-in-mp3-using-reactjs-under-5-minutes-5e960defaf10

import HelpAccordion from './audio/daw/dawHelp';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { GrHelpBook } from "react-icons/gr";
import { useWavesurfer } from '@wavesurfer/react';
import Zoom from 'wavesurfer.js/dist/plugins/zoom.esm.js';
import Hover from 'wavesurfer.js/dist/plugins/hover.esm.js';
import Minimap from 'wavesurfer.js/dist/plugins/minimap.esm.js';
import Timeline from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import MicRecorder from 'mic-recorder-to-mp3';
import { WidgetSlider, ReverbChorusWidget, EQSliders } from './audio/daw/control';
import { useCallback, useMemo, useState, useRef, useEffect } from 'react';

import {
  FaMicrophone,
  FaStop,
  FaCloudUploadAlt,
  FaSpinner,
  FaTimesCircle,
  FaCheck,
  FaPlay,
  FaPause,
  FaVolumeOff,
  FaVolumeMute,
  FaVolumeDown,
  FaVolumeUp,
  FaRegTrashAlt,
  FaDownload,
} from 'react-icons/fa';
import { useDispatch, useSelector } from 'react-redux';
import ListGroup from 'react-bootstrap/ListGroup';
import ListGroupItem from 'react-bootstrap/ListGroupItem';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import { useRouter } from 'next/router';
import WaveSurfer from 'wavesurfer.js';
import { UploadStatusEnum } from '../types';
import StatusIndicator from './statusIndicator';
import styles from '../styles/recorder.module.css';

// @mfwolffe
import { loadFfmpeg, formatTime, formatTimeMilli, setupAudioContext, effectChorusReverb } from '../lib/dawUtils';
import { Button, Card, CardBody, CardHeader, CardTitle, Modal, Spinner } from 'react-bootstrap';
import { DawControlsBottom, DawControlsTop, MinimapContainer  } from '../components/audio/daw/common';

const EQWIDTH = 28;
const RVBWIDTH = 13;
const CHRWIDTH = 18;

// @mfwolffe
const HelpModal = ({ setFn, shown }) => {
  return (
    <>
      <Modal size='lg' show={shown} onHide={() => setFn(false)} style={{maxHeight: "96%"}}>
        <Modal.Header style={{background: "var(--daw-timeline-bg)", color: "white" }}>
          <Modal.Title>DAW Help</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{overflow: "scroll", backgroundColor: "var(--daw-grey"}}>
          <HelpAccordion />
        </Modal.Body>
        <Modal.Footer style={{backgroundColor: "var(--daw-timeline-bg"}}>
          <Button variant="primary" onClick={() => setFn(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}


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
  let zoom, hover, minimap, timeline, regions;
  let disableRegionCreate;

  const [filters, setFilters] = useState([]);

  let audio;

  const dawRef = useRef(null);
  const audioRef = useRef(null);

  const ffmpegRef = useRef(new FFmpeg());

  const [isRecording, setIsRecording] = useState(false);
  const [blobURL, setBlobURL] = useState('');
  const [blobData, setBlobData] = useState();
  const [blobInfo, setBlobInfo] = useState([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [mimeType, setMimeType] = useState(null);
  const chunksRef = useRef([]);
  const dispatch = useDispatch();

  const getSupportedMimeType = () => {
    const types = [
      'audio/ogg;codecs=opus',
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/mpeg',
    ];
    return types.find((type) => MediaRecorder.isTypeSupported(type)) || null;
  };
  const [min, setMinute] = useState(0);
  const [sec, setSecond] = useState(0);

  // @mfwolffe | effects
  const [decay, setDecay] = useState(0);
  const [delay, setDelay] = useState(0);
  const [inGain, setInGain] = useState(0);
  const [outGain, setOutGain] = useState(0);
  const [speedChr, setSpeedChr] = useState(0);
  const [delayChr, setDelayChr] = useState(0);
  const [decayChr, setDecayChr] = useState(0);

  // @mfwolffe 
  const [audioURL, setAudioURL] = useState("");
  
  // @mfwolffe
  const [loaded, setLoaded] = useState(false);
  const [depthsChr, setDepthsChr] = useState(0);
  const [inGainChr, setInGainChr] = useState(0);
  const [cutRegion, setCutRegion] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [outGainChr, setOutGainChr] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [eqPresent, setEqPresent] = useState(false);
  const [mapPresent, setMapPrsnt] = useState(false);
  const [editList, setEditList] = useState([]);
  const [rvbPresent, setRvbPresent] = useState(false);
  const [chrPresent, setChrPresent] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [editListIndex, setEditListIndex] = useState(0);

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

  useEffect(() => {
    console.log('blobs', editList);
  }, [editList]);

  // @mfwolffe
  const [showDAW, setShowDAW] = useState(false);
  // const [audio, setAudio] = useState(null);
  // SEEME @mfwolffe try useEffect on dawURL then setupAudioContext if no dice.

  useEffect(() => {
    if (audioURL === "") return;
    console.log("daudio", audioURL);
    let tempAudioObj = setupAudioContext(audioURL);

    audio = tempAudioObj.audio;
    setFilters([...tempAudioObj.filters]);

    audioRef.current = audio;
    audioRef.current.src = audioURL;
  }, [audioURL]);


  useEffect(() => {
    if (!filters || !filters.length) return;
    setShowDAW(true);
  }, [filters])

  // @mfwolffe
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

  // @mfwolffe
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

  const params = {
    audioRef: audioRef,
    setAudioURL: setAudioURL,
    audioURL: audioURL,
    wavesurfer: wavesurfer,
    setEditList: setEditList,
    editList: editList,
    setEditListIndex: setEditListIndex,
    editListIndex: editListIndex,
    hasButton: true,
    ffmpegRef: ffmpegRef,
    ffmpegLoaded: loaded,
    handler: effectChorusReverb,
  };

  const handleHelp = useCallback(() => {
    setShowHelp(true)
  });
  
  const accompanimentRef = useRef(null);

  const router = useRouter();
  const { slug, piece, actCategory, partType } = router.query;

  useEffect(() => {
    setBlobInfo([]);
    setBlobURL('');
    setBlobData();
  }, [partType]);

  const startRecording = () => {
    if (isBlocked) {
      console.error('cannot record, microphone permissions are blocked');
      return;
    }

    accompanimentRef.current.play();
    chunksRef.current = [];
    mediaRecorder.start();
    setIsRecording(true);
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
    const extension = mimeType.includes('webm')
      ? 'webm'
      : mimeType.includes('ogg')
        ? 'ogg'
        : mimeType.includes('mp4')
          ? 'm4a'
          : 'wav';
    const formData = new FormData(); // TODO: make filename reflect assignment
    formData.append(
      'file',
      new File([blobInfo[i].data], `student-recording-${i}.${extension}`, {
        type: mimeType,
      }),
    );
    // dispatch(submit({ audio: formData }));
    submit({ audio: formData, submissionId });
  };

  function deleteTake(index) {
    const newInfo = blobInfo.slice();
    newInfo.splice(index, 1);
    setBlobInfo(newInfo);
  }

  // check for recording permissions
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      navigator?.mediaDevices?.getUserMedia
    ) {
      navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1,
            sampleRate: 48000,
            latency: 0,
          },
        })
        .then((stream) => {
          const supportedType = getSupportedMimeType();
          if (!supportedType) {
            console.error('No supported audio MIME type found');
            setIsBlocked(true);
            return;
          }
          setMimeType(supportedType);

          const recorder = new MediaRecorder(stream, {
            mimeType: supportedType,
          });

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunksRef.current.push(e.data);
            }
          };

          recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: supportedType });
            setBlobData(blob);
            const url = URL.createObjectURL(blob);
            setBlobURL(url);
            setBlobInfo((prevInfo) => [
              ...prevInfo,
              {
                url,
                data: blob,
              },
            ]);
            setIsRecording(false);
            chunksRef.current = [];
          };

          setMediaRecorder(recorder);
          setIsBlocked(false);
        })
        .catch((err) => {
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
            <>
            <ListGroup as="ol" numbered>
              {blobInfo.map((take, i) => (
                <ListGroupItem
                  key={take.url}
                  as="li"
                  className="d-flex justify-content-between align-items-start"
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
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button
                        onClick={() =>
                          submitRecording(i, `recording-take-${i}`)
                        }
                      >
                        <FaCloudUploadAlt />
                      </Button>
                      <Button onClick={() => downloadRecording(i)}>
                        <FaDownload />
                      </Button>
                      <Button onClick={() => deleteTake(i)}>
                        <FaRegTrashAlt />
                      </Button>
                    </div>
                  </div>
                  <div className="minWidth">
                    <StatusIndicator statusId={`recording-take-${i}`} />
                  </div>
                  <div>
                    <Button variant='primary' onClick={ () => { setAudioURL(take.url); } }>Edit Take</Button>
                  </div>
                </ListGroupItem>
              ))}
            </ListGroup>
            </>
          )}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          {/* { showDAW == true ? ( <DawStd takeURL={blobURL}></DawStd> ) : ( <></> ) } */}
          <audio src={blobURL} />

      <HelpModal setFn={setShowHelp} shown={showHelp} />

      <Card className="mt-2 mb-2">
        <CardHeader className="pt-1 pb-1 flex-between">
          <CardTitle className="pt-0 pb-0 mt-0 mb-0">Audio Editor</CardTitle>
          <Button className='help-button daw-help align-center' onClick={() => handleHelp()}>
            <GrHelpBook className="help-ico" fontSize="1.5rem" />
          </Button>
        </CardHeader>
        <CardBody>


          { showDAW ? 
          
          <div className="d-flex w-100 gap-2p">
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

            <EQSliders hide={!eqPresent} filters={filters} width={EQWIDTH} />

            <ReverbChorusWidget
              hide={!rvbPresent}
              width={RVBWIDTH}
              sliders={reverbSliders}
              title={'Reverb'}
              inGainChr={inGain}
              outGainChr={outGain}
              delayChr={delay}
              decayChr={decay}
              speedChr={null}
              depthsChr={null}
              {...params}
            />
            <ReverbChorusWidget
              hide={!chrPresent}
              width={CHRWIDTH}
              sliders={chorusSliders}
              title={'Chorus'}
              inGainChr={inGainChr}
              outGainChr={outGainChr}
              delayChr={delayChr}
              decayChr={decayChr}
              speedChr={speedChr}
              depthsChr={depthsChr}
              {...params}
            />
          </div> : <Spinner /> }

        </CardBody>
      </Card>
        </Col>
      </Row>
    </>
  );
}