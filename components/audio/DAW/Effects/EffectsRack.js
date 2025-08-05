'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardBody, Nav, Tab } from 'react-bootstrap';
import { useEffects } from '../../../../contexts/DAWProvider';
import EQ from './EQ';
import Echo from './Echo';
import Reverb from './Reverb';
import Chorus from './Chorus';
import Distortion from './Distortion';
import Phaser from './Phaser';
import AutoPan from './AutoPan';
import Tremolo from './Tremolo';
import Compressor from './Compressor';
import RingModulator from './RingModulator';
import Paulstretch from './Paulstretch';
import SpectralFilter from './SpectralFilter';
import ReverseReverb from './ReverseReverb';
import Glitch from './Glitch';
import FrequencyShifter from './FrequencyShifter';
import GranularFreeze from './GranularFreeze';
import AdvancedDelay from './AdvancedDelay';
import AutoWah from './AutoWah';
import Flanger from './Flanger';
import Gate from './Gate';
import PitchShifter from './PitchShifter';
import StereoWidener from './StereoWidener';

/**
 * Effects Rack - Tabbed container for all effects
 * Shows all effects in tabs below the DAW
 */
export default function EffectsRack({ width }) {
  const { 
    setEqPresent,
    setRvbPresent,
    setReverbPresent,
    setChrPresent,
    setDistortionPresent,
    setPhaserPresent,
    setAutoPanPresent,
    setTremoloPresent,
    setCompressorPresent,
    setRingModPresent,
    setPaulstretchPresent,
    setSpectralPresent,
    setReverseReverbPresent,
    setGlitchPresent,
    setFreqShiftPresent,
    setGranularPresent,
    setAdvDelayPresent,
    setAutoWahPresent,
    setFlangerPresent,
    setGatePresent,
    setPitchShiftPresent,
    setStereoWidenerPresent
  } = useEffects();
  
  // Track active tab
  const [activeTab, setActiveTab] = useState('eq');
  
  // Enable all effects when rack is opened
  useEffect(() => {
    setEqPresent(true);
    setRvbPresent(true);
    setReverbPresent(true);
    setChrPresent(true);
    setDistortionPresent(true);
    setPhaserPresent(true);
    setAutoPanPresent(true);
    setTremoloPresent(true);
    setCompressorPresent(true);
    setRingModPresent(true);
    setPaulstretchPresent(true);
    setSpectralPresent(true);
    setReverseReverbPresent(true);
    setGlitchPresent(true);
    setFreqShiftPresent(true);
    setGranularPresent(true);
    setAdvDelayPresent(true);
    setAutoWahPresent(true);
    setFlangerPresent(true);
    setGatePresent(true);
    setPitchShiftPresent(true);
    setStereoWidenerPresent(true);
    
    // Cleanup: disable all when unmounted
    return () => {
      setEqPresent(false);
      setRvbPresent(false);
      setReverbPresent(false);
      setChrPresent(false);
      setDistortionPresent(false);
      setPhaserPresent(false);
      setAutoPanPresent(false);
      setTremoloPresent(false);
      setCompressorPresent(false);
      setRingModPresent(false);
      setPaulstretchPresent(false);
      setSpectralPresent(false);
      setReverseReverbPresent(false);
      setGlitchPresent(false);
      setFreqShiftPresent(false);
      setGranularPresent(false);
      setAdvDelayPresent(false);
      setAutoWahPresent(false);
      setFlangerPresent(false);
      setGatePresent(false);
      setPitchShiftPresent(false);
      setStereoWidenerPresent(false);
    };
  }, [setEqPresent, setRvbPresent, setReverbPresent, setChrPresent, setDistortionPresent, setPhaserPresent, setAutoPanPresent, setTremoloPresent, setCompressorPresent, setRingModPresent, setPaulstretchPresent, setSpectralPresent, setReverseReverbPresent, setGlitchPresent, setFreqShiftPresent, setGranularPresent, setAdvDelayPresent, setAutoWahPresent, setFlangerPresent, setGatePresent, setPitchShiftPresent, setStereoWidenerPresent]);
  
  // All tabs are always available in the rack
  const tabs = [
    { key: 'eq', title: 'Equalizer', component: EQ },
    { key: 'compressor', title: 'Compressor', component: Compressor },
    { key: 'gate', title: 'Gate', component: Gate },
    { key: 'echo', title: 'Echo', component: Echo },
    { key: 'advdelay', title: 'Adv Delay', component: AdvancedDelay },
    { key: 'reverb', title: 'Reverb', component: Reverb },
    { key: 'chorus', title: 'Chorus', component: Chorus },
    { key: 'flanger', title: 'Flanger', component: Flanger },
    { key: 'phaser', title: 'Phaser', component: Phaser },
    { key: 'distortion', title: 'Distortion', component: Distortion },
    { key: 'autowah', title: 'Auto-Wah', component: AutoWah },
    { key: 'ringmod', title: 'Ring Mod', component: RingModulator },
    { key: 'tremolo', title: 'Tremolo', component: Tremolo },
    { key: 'autopan', title: 'Auto-Pan', component: AutoPan },
    { key: 'pitchshift', title: 'Pitch Shift', component: PitchShifter },
    { key: 'freqshift', title: 'Freq Shift', component: FrequencyShifter },
    { key: 'stereowide', title: 'Stereo Wide', component: StereoWidener },
    { key: 'glitch', title: 'Glitch', component: Glitch },
    { key: 'granular', title: 'Granular', component: GranularFreeze },
    { key: 'paulstretch', title: 'Paulstretch', component: Paulstretch },
    { key: 'spectral', title: 'Spectral', component: SpectralFilter },
    { key: 'reverseverb', title: 'Rev Reverb', component: ReverseReverb }
  ];
  
  return (
    <Card id="effects-rack" style={{ width: `${width}%`, maxHeight: '200px' }}>
      <CardBody className="bg-dawcontrol text-white p-0">
        <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
          {/* Tab Navigation */}
          <Nav variant="tabs" className="bg-daw-toolbars" style={{ minHeight: '30px' }}>
            {tabs.map(tab => (
              <Nav.Item key={tab.key} style={{ flex: 1 }}>
                <Nav.Link 
                  eventKey={tab.key}
                  className={activeTab === tab.key ? 'active-effect-tab' : 'inactive-effect-tab'}
                  style={{ 
                    padding: '0.25rem 0.5rem', 
                    fontSize: '0.8rem',
                    textAlign: 'center'
                  }}
                >
                  {tab.title}
                </Nav.Link>
              </Nav.Item>
            ))}
          </Nav>
          
          {/* Tab Content */}
          <Tab.Content className="pt-1" style={{ height: '160px', overflowY: 'auto' }}>
            {tabs.map(tab => {
              const Component = tab.component;
              return (
                <Tab.Pane key={tab.key} eventKey={tab.key}>
                  <Component width={100} />
                </Tab.Pane>
              );
            })}
          </Tab.Content>
        </Tab.Container>
      </CardBody>
    </Card>
  );
};