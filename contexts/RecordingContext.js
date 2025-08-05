'use client';

import { createContext, useContext, useState, useRef, useCallback } from 'react';

const RecordingContext = createContext();

export const useRecording = () => {
  const context = useContext(RecordingContext);
  if (!context) {
    throw new Error('useRecording must be used within RecordingProvider');
  }
  return context;
};

export const RecordingProvider = ({ children }) => {
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [mimeType, setMimeType] = useState(null);
  
  // Recording timer
  const [recordingTime, setRecordingTime] = useState({ min: 0, sec: 0 });
  
  // Takes management
  const [takeNo, setTakeNo] = useState(0);
  const [activeTakeNo, setActiveTakeNo] = useState(-1);
  const [blobInfo, setBlobInfo] = useState([]);
  const [blobURL, setBlobURL] = useState('');
  const [blobData, setBlobData] = useState();
  
  // Refs for recording
  const chunksRef = useRef([]);
  const accompanimentRef = useRef(null);
  
  // Silence detection state
  const [silenceData, setSilenceData] = useState(null);
  const [ignoreSilence, setIgnoreSilence] = useState(false);
  const [showAudioDrop, setShowAudioDrop] = useState(false);
  
  // Helper to get supported MIME type
  const getSupportedMimeType = useCallback(() => {
    const types = [
      'audio/ogg;codecs=opus',
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/mpeg',
    ];
    return types.find((type) => MediaRecorder.isTypeSupported(type)) || null;
  }, []);
  
  // Add a new take
  const addTake = useCallback((takeData) => {
    setBlobInfo(prev => [...prev, takeData]);
    setTakeNo(prev => prev + 1);
    // Don't automatically set active take - let the UI handle this
  }, []);
  
  // Delete a take
  const deleteTake = useCallback((index) => {
    setBlobInfo(prev => {
      const newInfo = [...prev];
      newInfo.splice(index, 1);
      return newInfo;
    });
    
    // If we're deleting the active take, reset
    if (takeNo === index) {
      setActiveTakeNo(-1);
    }
  }, [takeNo]);
  
  // Rename a take
  const renameTake = useCallback((index, newName) => {
    setBlobInfo(prev => {
      const newInfo = [...prev];
      if (newInfo[index]) {
        newInfo[index].takeName = newName;
      }
      return newInfo;
    });
  }, []);
  
  // Clear all recording data (useful for switching between parts)
  const clearRecordingData = useCallback(() => {
    setBlobInfo([]);
    setBlobURL('');
    setBlobData(undefined);
    setTakeNo(0);
    setActiveTakeNo(-1);
    setSilenceData(null);
    setIgnoreSilence(false);
  }, []);
  
  const value = {
    // Recording state
    isRecording,
    setIsRecording,
    isBlocked,
    setIsBlocked,
    mediaRecorder,
    setMediaRecorder,
    mimeType,
    setMimeType,
    
    // Timer
    recordingTime,
    setRecordingTime,
    
    // Takes
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
    
    // Refs
    chunksRef,
    accompanimentRef,
    
    // Silence detection
    silenceData,
    setSilenceData,
    ignoreSilence,
    setIgnoreSilence,
    showAudioDrop,
    setShowAudioDrop,
    
    // Methods
    getSupportedMimeType,
    addTake,
    deleteTake,
    renameTake,
    clearRecordingData,
  };
  
  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  );
};