// with thanks to https://medium.com/front-end-weekly/recording-audio-in-mp3-using-reactjs-under-5-minutes-5e960defaf10

'use client';

import {
  FaEdit,
  FaStop,
  FaPlay,
  FaPause,
  FaVolumeUp,
  FaVolumeOff,
  FaMicrophone,
  FaVolumeDown,
  FaDownload,
  FaVolumeMute,
  FaRegTrashAlt,
  // FaCloudUploadAlt,
} from 'react-icons/fa';
import {
  Card,
  Form,
  Button,
  CardBody,
  CardTitle,
  CardHeader,
  CardFooter,
} from 'react-bootstrap';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import WaveSurfer from 'wavesurfer.js';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { useRouter } from 'next/router';
import { fetchFile } from '@ffmpeg/util';
import { BiRename } from "react-icons/bi";
import { useDispatch } from 'react-redux';
import { GrHelpBook } from 'react-icons/gr';
// import MicRecorder from 'mic-recorder-to-mp3';
import { PiWarningDuotone } from 'react-icons/pi';
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

import styles from '../styles/recorder.module.css';

import {
  loadFfmpeg,
  formatTime,
  catchSilence,
  setupAudioContext,
  effectChorusReverb,
  effectSliceRegions,
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
import HelpModal from './audio/daw/dawHelp';
import StatusIndicator from './statusIndicator';
import { AudioDropModal } from './audio/silenceDetect';
import { set } from 'date-fns';

// TODO @mfwolffe don't do the width calculations like this
const EQWIDTH = 28;
const RVBWIDTH = 13;
const CHRWIDTH = 18;

// Create a silent audio buffer as scratch audio to initialize wavesurfer
// SEEME: this is a workaround to avoid issues with wavesurfer loading. One solution was to 
//        house a scratch audio file in the public folder, but this is more dynamic.
const createSilentAudio = () => {
  if (typeof window === 'undefined') return '';
  
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate); // 0.1 second of silence
    const arrayBuffer = new ArrayBuffer(44 + buffer.length * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + buffer.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, audioContext.sampleRate, true);
    view.setUint32(28, audioContext.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, buffer.length * 2, true);
    
    // Convert buffer to 16-bit PCM
    const channelData = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
    
    const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error('Error creating silent audio:', e);
    return '';
  }
};

const scratchURL = createSilentAudio();

export default function Recorder({ submit, accompaniment }) {
  // Initialize audio context and filters
  const [filters, setFilters] = useState([]);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Only initialize audio context after user interaction for EQ filters
      const initAudioContext = () => {
        if (filters.length === 0) {
          const result = setupAudioContext();
          setFilters(result.filters);
        }
      };
      
      // Add event listener for first user interaction
      const handleUserGesture = () => {
        initAudioContext();
        // Remove listener after first interaction
        document.removeEventListener('click', handleUserGesture);
        document.removeEventListener('touchstart', handleUserGesture);
      };
      
      document.addEventListener('click', handleUserGesture);
      document.addEventListener('touchstart', handleUserGesture);
      
      return () => {
        document.removeEventListener('click', handleUserGesture);
        document.removeEventListener('touchstart', handleUserGesture);
      };
    }
  }, [filters.length]);

  let zoom;
  let hover;
  let minimap;
  let regions;
  let timeline;
  let disableRegionCreate;

  const dawRef = useRef(null);
  const audioRef = useRef(new Audio()); // Create a dummy audio element
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
  const [mapPresent, setMapPresent] = useState(false);
  const [rvbPresent, setRvbPresent] = useState(false);
  const [chrPresent, setChrPresent] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [audioURL, setAudioURL] = useState(scratchURL);
  const [silenceData, setSilenceData] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [editListIndex, setEditListIndex] = useState(0);
  const [showAudioDrop, setShowAudioDrop] = useState(false);
  const [ignoreSilence, setIgnoreSilence] = useState(false);
  const [submissionFile, setSubmissionFile] = useState(null);

  const [activeTakeNo, setActiveTakeNo] = useState(-1);
  const [activeNaming, setActiveNaming] = useState(-1);

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

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [blobURL, setBlobURL] = useState('');
  const [blobData, setBlobData] = useState();
  const [blobInfo, setBlobInfo] = useState([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [mimeType, setMimeType] = useState(null);
  const chunksRef = useRef([]);
  const dispatch = useDispatch();
  const [min, setMinute] = useState(0);
  const [sec, setSecond] = useState(0);

  const [takeNo, setTakeNo] = useState(0);
  const [pendingBlob, setPendingBlob] = useState(null); // Track blob to process

  // @mfwolffe wavesurfer initialization
  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    height: 208,
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

  // Initialize wavesurfer with scratch audio when DAW first shows
  useEffect(() => {
    if (showDAW && wavesurfer && scratchURL) {
      // Load scratch audio first to initialize wavesurfer
      wavesurfer.load(scratchURL).catch(err => {
        console.log('Failed to load scratch audio:', err);
      });
    }
  }, [showDAW, wavesurfer]);

  // @mfwolffe only attempt to register plugins once
  //           surfer is ready
  //           Also there is superfluous opt chaining
  //           below
  useEffect(() => {
    if (wavesurfer) {
      wavesurfer.once('ready', () => {
        // only add them once, and when you do, add them all at once.
        if (wavesurfer.getActivePlugins().length === 0) {
          zoom = wavesurfer?.registerPlugin(
            Zoom.create({
              deltaThreshold: 5,
              maxZoom: 300,
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
          disableRegionCreate = regions?.enableDragSelection({ color: 'rgba(155, 115, 215, 0.4)', });

          // subscribe regions plugin to events
          regions?.on('region-double-clicked', (region) => { region.remove(); });
          regions?.on('region-created', (region) => { disableRegionCreate(); setCutRegion(region); });
          regions?.on('region-removed', (region) => { disableRegionCreate = regions.enableDragSelection(); });
        }

        // make sure ffmpeg is ready before trying to use it
        if (!loaded) loadFfmpeg(ffmpegRef, setLoaded, setIsLoading);
      });
    }
  }, [wavesurfer, loaded]);

  useEffect(() => {
    // Don't reload if it's just the scratch URL or no URL
    if (!audioURL || audioURL === scratchURL) return;
    
    async function loadAudio() {
      // Only proceed if showing DAW and wavesurfer is ready
      if (showDAW && wavesurfer && audioURL) {
        try {
          // Load the audio URL directly into wavesurfer
          await wavesurfer.load(audioURL);
        } catch (error) {
          console.error('Error loading audio in wavesurfer:', error);
          
          // Fallback: try creating a new audio element
          try {
            const audioElement = new Audio(audioURL);
            await new Promise((resolve, reject) => {
              audioElement.onloadeddata = resolve;
              audioElement.onerror = reject;
            });
            await wavesurfer.load(audioElement);
          } catch (fallbackError) {
            console.error('Fallback audio loading also failed:', fallbackError);
          }
        }
      }
    }

    loadAudio();
  }, [audioURL, wavesurfer, showDAW]);

  // TODO @mfwolffe this really needs rethinking - should students be
  //                able to change speed of piece in the data or just during
  //                playback? @hcientist?
  useEffect(() => {
    async function updatePlaybackSpeed() {
      if (!ffmpegRef.current || !ffmpegRef.current.loaded || !audioURL || audioURL === scratchURL) {
        return;
      }
      
      try {
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
        if (wavesurfer) {
          wavesurfer.load(audioRef.current.src);
        }
      } catch (error) {
        console.error('Error updating playback speed:', error);
      }
    }

    if (playbackSpeed !== 1) {
      updatePlaybackSpeed();
    }
  }, [playbackSpeed, audioURL, wavesurfer]);

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

  const startRecording = () => {
    if (isBlocked || !mediaRecorder) {
      console.error('cannot record, microphone permissions are blocked or recorder not ready');
      return;
    }

    if (accompanimentRef.current) {
      accompanimentRef.current.play();
    }
    
    chunksRef.current = [];
    mediaRecorder.start(10); // Capture in 10ms chunks for better compatibility
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (accompanimentRef.current) {
      accompanimentRef.current.pause();
      accompanimentRef.current.load();
    }

    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      // Don't increment takeNo here - let onstop handler do it
    }
    setIsRecording(false);
  };

  const deleteTake = (index) => {
    if (takeNo == index) {
      setShowDAW(false);
    }

    const newInfo = blobInfo.slice();
    newInfo.splice(index, 1);
    setBlobInfo(newInfo);
  };

  // TODO @mfwolffe I forget why I am no longer using this helper
  const takeRename = (i, userName) => { blobInfo[i].takeName = userName };

  // Initialize MediaRecorder
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
            setPendingBlob({ blob, mimeType: supportedType });
            chunksRef.current = [];
            setIsRecording(false);
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

  const handleRename = (takeNumber) => {
    const nameInput = document.getElementById(`name-take-${takeNumber}`);
    const placeholder = document.getElementById(`plc-txt-${takeNumber}`);
    
    if (nameInput && placeholder) {
      if (nameInput.style.display === 'none') {
        nameInput.style.display = 'block';
        placeholder.style.display = 'none';
        nameInput.focus();
      } else {
        nameInput.style.display = 'none';
        placeholder.style.display = 'block';
      }
    }
  };

  // Process pending blob when recording stops
  useEffect(() => {
    if (pendingBlob && !isRecording) {
      const { blob, mimeType } = pendingBlob;
      const url = URL.createObjectURL(blob);
      
      // Verify the blob is valid before using it
      const testAudio = new Audio();
      testAudio.onloadedmetadata = () => {
        // Blob is valid, proceed
        const currentTakeNo = takeNo + 1;
        
        setBlobData(blob);
        setBlobURL(url);
        setBlobInfo((prevInfo) => [
          ...prevInfo,
          {
            url,
            data: blob,
            take: currentTakeNo,
            timeStr: new Date().toLocaleString(),
            mimeType: mimeType,
            takeName: null,
          },
        ]);
        setTakeNo(currentTakeNo);
        setActiveTakeNo(currentTakeNo);
        setPendingBlob(null); // Clear pending blob
      };
      
      testAudio.onerror = () => {
        console.error('Invalid audio blob created');
        setPendingBlob(null); // Clear pending blob
      };
      
      testAudio.src = url;
    }
  }, [pendingBlob, isRecording, takeNo]);

  useEffect(() => {
    if (activeTakeNo === -1) return;
    const take = blobInfo.find((o) => o.take === activeTakeNo);
    if (take) {
      setAudioURL(take.url);
    }
  }, [activeTakeNo, blobInfo]);

  useEffect(() => {
    let interval = null;
    if (isRecording) {
      interval = setInterval(() => {
        setSecond(prev => {
          if (prev === 59) {
            setMinute(m => m + 1);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setMinute(0);
      setSecond(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const submitEditedRecording = async (url) => {
    if (!url || url === scratchURL) {
      alert('Please record audio before submitting');
      return;
    }

    try {
      // Check for silence if not ignored
      if (!ignoreSilence && audioRef.current) {
        const silenceResult = await catchSilence(
          ffmpegRef,
          audioRef.current.src,
          10,
          30,
          null
        );
        setSilenceData(silenceResult);
        
        if (silenceResult?.silenceFlag) {
          setShowAudioDrop(true);
          return;
        }
      }

      // Submit the recording
      const response = await fetch(url);
      const blob = await response.blob();
      setSubmissionFile(blob);
      
      if (submit) {
        submit(blob);
      }
    } catch (error) {
      console.error('Error submitting recording:', error);
      alert('Error submitting recording. Please try again.');
    }
  };

  return (
    <>
      <Row>
        <Col>
          {isRecording ? (
            <Button onClick={stopRecording} className='mb-2 mt-2'>
              <FaStop /> {String(min).padStart(2, '0')}:
              {String(sec).padStart(2, '0')}
            </Button>
          ) : (
            <Button onClick={startRecording} className='mb-2 mt-2'>
              <FaMicrophone />
            </Button>
          )}
        </Col>
      </Row>
      <Row>
        <Col>
          {/* <StatusIndicator statusId={`recording-take-test`} /> */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio ref={accompanimentRef} className='mb-2'>
            <source src={accompaniment} type="audio/mpeg" />
          </audio>
          {blobInfo.length === 0 ? (
            <span className='mt-2'>No takes yet. Click the microphone icon to record.</span>
          ) : (
            <ListGroup as="ol" numbered className='mt-2'>
              <h3>Your Takes ({blobInfo.length})</h3>
              {blobInfo.map((take, i) => (
                <ListGroupItem
                  key={take.url}
                  as="li"
                  className="d-flex justify-content-between"
                  style={{ fontSize: '1rem', alignItems: "center" }}
                >
                  <Form.Control
                    type="text"
                    placeholder={`Take ${take.take} -- ${take.timeStr}`}
                    id={`plc-txt-${take.take}`}
                    style={{ display: 'block' }}
                    value={take.takeName || `Take ${take.take} -- ${take.timeStr}`}
                    readOnly
                  />
                  <Form.Control
                    type="text"
                    placeholder={`Name your take`}
                    id={`name-take-${take.take}`}
                    style={{ display: 'none' }}
                    onBlur={(e) => {
                      const newBlobInfo = [...blobInfo];
                      newBlobInfo[i].takeName = e.target.value || null;
                      setBlobInfo(newBlobInfo);
                      handleRename(take.take);
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.target.blur();
                      }
                    }}
                  />

                  <div className='d-flex justify-content-center align-items-center'>
                    <Button onClick={() => { handleRename(take.take) }} className='ml-1'>
                      <BiRename />
                    </Button>

                    <Button
                      disabled={take.take === activeTakeNo && showDAW}
                      onClick={() => {
                        setActiveTakeNo(take.take);
                        setAudioURL(take.url);
                        setShowDAW(true); // Only show DAW when edit is clicked
                      }}
                      className='ml-1 disabled-cursor'
                    >
                      <FaEdit />
                    </Button>
                    <Button onClick={() => deleteTake(i)} className='ml-1'>
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
          <AudioDropModal
            show={showAudioDrop}
            setShow={setShowAudioDrop}
            silenceData={silenceData}
            setIgnore={setIgnoreSilence}
          />

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
            <CardBody style={{ background: 'lightsteelblue' }}>
              <div className="d-flex w-100 gap-2p">
                {/* TODO @mfwolffe don't do widget width calcs like this */}
                {/* TODO @mfwolffe why are the widget calcs still like this? */}
                {/* TODO @mfwolffe WHY are the widget calcs STILL like this?? */}
                <div
                  id="waveform-container"
                  style={{
                    width: `${100 -
                      (rvbPresent || eqPresent || chrPresent ? 1.5 : 0) -
                      (eqPresent ? EQWIDTH : 0) -
                      (rvbPresent ? RVBWIDTH : 0) -
                      (chrPresent ? CHRWIDTH : 0)
                      }%`,
                  }}
                >
                  <DawControlsTop
                    mapPresent={mapPresent}
                    mapSetter={setMapPresent}
                    eqSetter={setEqPresent}
                    eqPresent={eqPresent}
                    cutRegion={cutRegion}
                    rvbPresent={rvbPresent}
                    rvbSetter={setRvbPresent}
                    chrPresent={chrPresent}
                    chrSetter={setChrPresent}
                    regions={regions}
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
            <CardFooter className="dawHeaderFooter">
              <Button
                style={{ float: 'right' }}
                onClick={() => submitEditedRecording(audioURL)}
              >
                Submit{' '}
                {silenceData?.silenceFlag ? (
                  <PiWarningDuotone />
                ) : ''}
              </Button>
            </CardFooter>
          </Card>
        </Col>
      </Row>
    </>
  );
}