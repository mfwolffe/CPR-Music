'use client';

import React from 'react';
import { AudioProvider } from './AudioContext';
import { RecordingProvider } from './RecordingContext';
import { EffectsProvider } from './EffectsContext';
import { FFmpegProvider } from './FFmpegContext';
import { UIProvider } from './UIContext';

/**
 * DAWProvider combines all the context providers needed for the DAW and Recorder
 * This makes it easy to wrap components that need access to these contexts
 */
export const DAWProvider = ({ children }) => {
  return (
    <FFmpegProvider>
      <AudioProvider>
        <RecordingProvider>
          <EffectsProvider>
            <UIProvider>
              {children}
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