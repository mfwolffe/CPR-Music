// contexts/DAWProvider.js
'use client';

import React from 'react';
import { AudioProvider } from './AudioContext';
import { RecordingProvider } from './RecordingContext';
import { EffectsProvider } from './EffectsContext';
import { FFmpegProvider } from './FFmpegContext';
import { UIProvider } from './UIContext';
import { MultitrackProvider } from './MultitrackContext';

/**
 * DAWProvider combines all the context providers needed for the DAW
 * Now includes MultitrackProvider for multitrack functionality
 */
export const DAWProvider = ({ children }) => {
  return (
    <FFmpegProvider>
      <AudioProvider>
        <RecordingProvider>
          <EffectsProvider>
            <UIProvider>
              <MultitrackProvider>
                {children}
              </MultitrackProvider>
            </UIProvider>
          </EffectsProvider>
        </RecordingProvider>
      </AudioProvider>
    </FFmpegProvider>
  );
};

// Export all hooks for convenience
export { useAudio } from './AudioContext';
export { useRecording } from './RecordingContext';
export { useEffects } from './EffectsContext';
export { useFFmpeg } from './FFmpegContext';
export { useUI } from './UIContext';
export { useMultitrack } from './MultitrackContext';