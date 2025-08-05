'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  FaEdit,
  FaStop,
  FaMicrophone,
  FaRegTrashAlt,
} from 'react-icons/fa';
import { BiRename } from "react-icons/bi";
import {
  Card,
  Form,
  Button,
  ListGroup,
  ListGroupItem,
  Row,
  Col,
} from 'react-bootstrap';
import { useRouter } from 'next/router';
import { useDispatch } from 'react-redux';
import { 
  useAudio, 
  useRecording, 
  useFFmpeg, 
  useUI,
  useEffects
} from '../contexts/DAWProvider';
import DAW from './audio/DAW';
import { AudioDropModal } from './audio/silenceDetect';
import { catchSilence, setupAudioContext } from '../lib/dawUtils';
import StatusIndicator from './statusIndicator';

// Create a silent audio buffer as scratch audio to initialize wavesurfer
const createSilentAudio = () => {
  if (typeof window === 'undefined') return '';
  
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
    const arrayBuffer = new ArrayBuffer(44 + buffer.length * 2);
    const view = new DataView(arrayBuffer);
    
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

export default function RecorderRefactored({ submit, accompaniment }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const { slug, piece, actCategory, partType } = router.query;
  
  // Use contexts instead of local state
  const { 
    audioURL, 
    setAudioURL, 
    audioRef,
    addToEditHistory
  } = useAudio();
  
  const {
    isRecording,
    setIsRecording,
    isBlocked,
    setIsBlocked,
    mediaRecorder,
    setMediaRecorder,
    mimeType,
    setMimeType,
    recordingTime,
    setRecordingTime,
    takeNo,
    setTakeNo,
    activeTakeNo,
    setActiveTakeNo,
    blobInfo,
    setBlobInfo,
    blobURL,
    setBlobURL,
    blobData,
    setBlobData,
    chunksRef,
    accompanimentRef,
    silenceData,
    setSilenceData,
    ignoreSilence,
    setIgnoreSilence,
    showAudioDrop,
    setShowAudioDrop,
    getSupportedMimeType,
    addTake,
    deleteTake,
    clearRecordingData
  } = useRecording();
  
  const { ffmpegRef, loaded: ffmpegLoaded } = useFFmpeg();
  const { showDAW, setShowDAW } = useUI();
  const { setFilters } = useEffects();
  
  // Create a ref to track current take number
  const takeNoRef = useRef(0);
  useEffect(() => {
    takeNoRef.current = takeNo;
  }, [takeNo]);
  
  // Initialize audio URL with scratch audio
  useEffect(() => {
    if (!audioURL) {
      setAudioURL(scratchURL);
    }
  }, [audioURL, setAudioURL]);
  
  // Initialize audio context and filters - only once
  useEffect(() => {
    if (typeof window !== 'undefined' && (audioURL || scratchURL)) {
      let initialized = false;
      
      const initAudioContext = () => {
        if (initialized) return;
        initialized = true;
        
        const result = setupAudioContext(audioURL || scratchURL);
        setFilters(result.filters);
        audioRef.current = result.audio;
      };
      
      const handleUserGesture = () => {
        initAudioContext();
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
  }, []); // Empty dependency array - setup only once
  
  // Clear recording data when switching parts
  useEffect(() => {
    clearRecordingData();
  }, [partType, clearRecordingData]);
  
  // Initialize MediaRecorder - only run once on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator?.mediaDevices?.getUserMedia) {
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
            const url = URL.createObjectURL(blob);
            
            // Use ref to get current take number
            const currentTakeNo = takeNoRef.current + 1;
            
            setBlobData(blob);
            setBlobURL(url);
            addTake({
              url,
              data: blob,
              take: currentTakeNo,
              timeStr: new Date().toLocaleString(),
              mimeType: supportedType,
              takeName: null,
            });
            
            chunksRef.current = [];
          };

          setMediaRecorder(recorder);
          setIsBlocked(false);
        })
        .catch((err) => {
          console.log('Permission Denied', err);
          setIsBlocked(true);
        });
    }
  }, []); // Empty dependency array - only run once on mount
  
  // Update audio URL when active take changes
  useEffect(() => {
    if (activeTakeNo === -1 || blobInfo.length === 0) return;
    const take = blobInfo.find((o) => o.take === activeTakeNo);
    if (take && take.url !== audioURL) {
      setAudioURL(take.url);
      addToEditHistory(take.url);
    }
  }, [activeTakeNo, blobInfo]);
  
  // Recording timer
  useEffect(() => {
    let interval = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => ({
          min: prev.sec === 59 ? prev.min + 1 : prev.min,
          sec: prev.sec === 59 ? 0 : prev.sec + 1
        }));
      }, 1000);
    } else {
      setRecordingTime({ min: 0, sec: 0 });
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, setRecordingTime]);
  
  const startRecording = useCallback(() => {
    if (isBlocked || !mediaRecorder) {
      console.error('Cannot record, microphone permissions are blocked or recorder not ready');
      return;
    }

    if (accompanimentRef.current) {
      accompanimentRef.current.play();
    }
    
    chunksRef.current = [];
    mediaRecorder.start(10);
    setIsRecording(true);
  }, [isBlocked, mediaRecorder, accompanimentRef, chunksRef, setIsRecording]);
  
  const stopRecording = useCallback(() => {
    if (accompanimentRef.current) {
      accompanimentRef.current.pause();
      accompanimentRef.current.load();
    }

    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      // Set the active take to the one we just recorded
      setTimeout(() => {
        setActiveTakeNo(takeNoRef.current + 1);
      }, 100);
    }
    setIsRecording(false);
  }, [mediaRecorder, accompanimentRef, setIsRecording, setActiveTakeNo]);
  
  const handleDeleteTake = useCallback((index) => {
    const takeToDelete = blobInfo[index];
    if (takeToDelete && takeToDelete.take === activeTakeNo) {
      setShowDAW(false);
    }
    deleteTake(index);
  }, [blobInfo, activeTakeNo, setShowDAW, deleteTake]);
  
  const handleRename = useCallback((takeNumber) => {
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
  }, []);
  
  const submitEditedRecording = useCallback(async (url) => {
    if (!url || url === scratchURL) {
      alert('Please record audio before submitting');
      return;
    }

    try {
      if (!ignoreSilence && ffmpegLoaded) {
        const silenceResult = await catchSilence(
          ffmpegRef,
          url,
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

      const response = await fetch(url);
      const blob = await response.blob();
      
      if (submit) {
        submit(blob);
      }
    } catch (error) {
      console.error('Error submitting recording:', error);
      alert('Error submitting recording. Please try again.');
    }
  }, [ignoreSilence, ffmpegLoaded, ffmpegRef, setSilenceData, setShowAudioDrop, submit]);
  
  return (
    <>
      <Row>
        <Col>
          {isRecording ? (
            <Button onClick={stopRecording} className='mb-2 mt-2'>
              <FaStop /> {String(recordingTime.min).padStart(2, '0')}:
              {String(recordingTime.sec).padStart(2, '0')}
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
                    <Button onClick={() => handleRename(take.take)} className='ml-1'>
                      <BiRename />
                    </Button>

                    <Button
                      disabled={take.take === activeTakeNo && showDAW}
                      onClick={() => {
                        setActiveTakeNo(take.take);
                        setShowDAW(true);
                      }}
                      className='ml-1 disabled-cursor'
                    >
                      <FaEdit />
                    </Button>
                    
                    <Button onClick={() => handleDeleteTake(i)} className='ml-1'>
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
          
          <AudioDropModal
            show={showAudioDrop}
            setShow={setShowAudioDrop}
            silenceData={silenceData}
            setIgnore={setIgnoreSilence}
          />
          
          <DAW 
            onSubmit={submitEditedRecording}
            showSubmitButton={true}
            silenceWarning={silenceData?.silenceFlag}
          />
        </Col>
      </Row>
    </>
  );
}