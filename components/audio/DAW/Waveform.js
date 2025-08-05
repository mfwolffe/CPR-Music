'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import WaveSurfer from 'wavesurfer.js';
import Zoom from 'wavesurfer.js/dist/plugins/zoom.esm.js';
import Hover from 'wavesurfer.js/dist/plugins/hover.esm.js';
import Minimap from 'wavesurfer.js/dist/plugins/minimap.esm.js';
import Timeline from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { useAudio, useEffects, useUI } from '../../../contexts/DAWProvider';
import { formatTime } from '../../../lib/dawUtils';
import { MinimapContainer } from '../daw-old/common';

/**
 * Waveform component handles the wavesurfer instance and plugins
 * This is where the delicate wavesurfer setup lives
 */
export default function Waveform() {
  const dawRef = useRef(null);
  const { 
    audioURL, 
    wavesurferRef, 
    setIsPlaying, 
    setCurrentTime, 
    setDuration 
  } = useAudio();
  const { setCutRegion } = useEffects();
  const { mapPresent } = useUI();
  
  // Initialize wavesurfer with all plugins
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
  
  // Store wavesurfer instance in context
  useEffect(() => {
    if (wavesurfer && wavesurferRef) {
      wavesurferRef.current = wavesurfer;
    }
  }, [wavesurfer, wavesurferRef]);
  
  // Update context state when wavesurfer state changes
  useEffect(() => {
    if (isPlaying !== undefined) {
      setIsPlaying(isPlaying);
    }
  }, [isPlaying, setIsPlaying]);
  
  useEffect(() => {
    if (currentTime !== undefined) {
      setCurrentTime(currentTime);
    }
  }, [currentTime, setCurrentTime]);
  
  // Initialize plugins once wavesurfer is ready
  useEffect(() => {
    if (!wavesurfer) return;
    
    wavesurfer.once('ready', () => {
      // Only add plugins if they haven't been added yet
      if (wavesurfer.getActivePlugins().length === 0) {
        // Zoom plugin
        const zoom = wavesurfer.registerPlugin(
          Zoom.create({
            deltaThreshold: 5,
            maxZoom: 300,
            scale: 0.125,
          })
        );
        
        // Hover plugin
        const hover = wavesurfer.registerPlugin(
          Hover.create({
            lineWidth: 2,
            labelSize: 12,
            labelColor: '#fff',
            formatTimeCallback: formatTime,
            lineColor: 'var(--jmu-gold)',
          })
        );
        
        // Minimap plugin
        const minimap = wavesurfer.registerPlugin(
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
        
        // Timeline plugin
        const timeline = wavesurfer.registerPlugin(
          Timeline.create({
            height: 24,
            insertPosition: 'beforebegin',
            style: 'color: #e6dfdc; background-color: var(--daw-timeline-bg)',
          })
        );
        
        // Regions plugin
        const regions = wavesurfer.registerPlugin(RegionsPlugin.create());
        let disableRegionCreate = regions.enableDragSelection({
          color: 'rgba(155, 115, 215, 0.4)',
        });
        
        // Region event handlers
        regions.on('region-created', (region) => {
          disableRegionCreate();
          setCutRegion(region);
        });
        
        regions.on('region-double-clicked', (region) => {
          region.remove();
          disableRegionCreate = regions.enableDragSelection();
        });
        
        regions.on('region-removed', (region) => {
          disableRegionCreate = regions.enableDragSelection();
        });
      }
      
      // Update duration when ready
      setDuration(wavesurfer.getDuration());
    });
    
    // Load audio when URL changes
    if (audioURL && audioURL !== '') {
      wavesurfer.load(audioURL).catch(err => {
        console.error('Error loading audio:', err);
      });
    }
  }, [wavesurfer, audioURL, setCutRegion, setDuration]);
  
  return (
    <>
      <div
        ref={dawRef}
        id="waveform"
        className="ml-auto mr-auto mb-0 mt-0"
      />
      {MinimapContainer(!mapPresent)}
    </>
  );
}