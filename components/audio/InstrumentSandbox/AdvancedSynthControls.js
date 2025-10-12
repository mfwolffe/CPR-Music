'use client';

import React from 'react';
import { Row, Col, Form, Card, Badge, ToggleButtonGroup, ToggleButton, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { GiSoundWaves } from 'react-icons/gi';
import { FaMixcloud, FaWaveSquare } from 'react-icons/fa';
import { IoMdOptions } from 'react-icons/io';
import { MdScience } from 'react-icons/md';
import Knob from '../../Knob';

/**
 * Educational Tooltips for Advanced Controls
 */
const AdvancedTooltips = {
  // Oscillator Mixing
  osc2Enabled: "Adds a second oscillator for thicker, richer sounds. Layer different waveforms, detune for chorus effects, or use for cross-modulation.",
  osc2Type: "Waveform of second oscillator. Mixing different shapes (Saw+Square, Sine+Triangle) creates complex harmonic content.",
  oscMix: "Balance between oscillator 1 and oscillator 2. 0% is osc1 only, 100% is osc2 only, 50% blends both equally.",
  osc2Detune: "Fine-tune oscillator 2 pitch in cents. ±7-12 creates chorus, ±20-50 creates unison thickness, ±50+ creates tension.",
  osc2Pitch: "Transpose oscillator 2 in semitones. +12 adds an octave above, -12 adds an octave below. Use for harmonies and layering.",
  fmAmount: "Frequency modulation - oscillator 2 modulates oscillator 1's pitch. Creates bell-like, metallic, or aggressive timbres. 50%+ for pronounced effects.",
  ringModAmount: "Ring modulation - multiplies oscillators together. Creates clangorous, bell-like, or alien tones. Loses original pitch at high values.",
  oscSync: "Oscillator sync - forces oscillator 1 to restart when oscillator 2 completes a cycle. Creates aggressive, cutting sounds with harmonic movement.",

  // Sub & Noise
  subOscEnabled: "Adds a sub-oscillator one octave below for low-end weight. Essential for bass sounds and adding foundation to leads.",
  subOscType: "Waveform of sub-oscillator. Square is punchy and defined, Sine is pure and deep.",
  subOscLevel: "Volume of sub-oscillator. 30-50% adds foundation, 70%+ for bass-heavy sounds.",
  noiseLevel: "Adds noise generator for breath, air, or texture. 10-30% adds realism to instruments, 50%+ for effects and transitions.",
  noiseType: "Color of noise. White is bright/hissy, Pink is balanced/natural, Brown is dark/rumbling.",

  // Advanced Filter
  filterType: "Filter shape. Lowpass removes highs (warm), Highpass removes lows (thin), Bandpass keeps middle (nasal), Notch removes middle (hollow).",
  filterEnvAmount: "How much the filter envelope affects cutoff. Positive opens filter on attack, negative closes it. ±50% for movement, ±100% for dramatic sweeps.",
  filterAttack: "Time for filter to reach peak. Quick (10-50ms) for plucks, slow (100-500ms) for evolving pads.",
  filterDecay: "Time for filter to settle from peak to sustain. Short for percussive, long for evolving textures.",
  filterSustain: "Filter level held during sustain. 0 returns to base cutoff, 1.0 stays at peak.",
  filterRelease: "Filter closing time after release. Short for tight sounds, long for smooth fadeouts.",

  // Modulation
  pulseWidth: "Width of pulse wave when using square oscillator. 50% is standard square, other values create different harmonic content.",
  pwmAmount: "Pulse width modulation depth. Modulates pulse width cyclically for chorusing, movement. 30-60% for subtle, 80%+ for dramatic.",
  pwmRate: "Speed of pulse width modulation in Hz. 0.5-2 Hz for slow movement, 4-8 Hz for vibrato-like effects.",
  lfo2Target: "What LFO 2 modulates. Pitch for vibrato, Filter for wah effects, Amp for tremolo.",
  lfo2Rate: "Speed of LFO 2 in Hz. 0.5-2 Hz for slow sweeps, 4-8 Hz for vibrato/tremolo, 10+ for special effects.",
  lfo2Amount: "Depth of LFO 2 modulation. Start subtle (20-40%), increase for pronounced effects (60-100%).",

  // Experimental
  bitCrushBits: "Reduces bit depth for lo-fi degradation. 16 bits is clean, 8-12 is vintage, 1-6 is extreme degradation.",
  bitCrushRate: "Reduces sample rate for aliasing. 44100 Hz is clean, 8000-16000 Hz is lo-fi, below 4000 Hz creates extreme artifacts.",
  waveFoldAmount: "Folds waveform back on itself creating new harmonics. 20-40% adds brightness, 60%+ creates aggressive distortion.",
  feedbackAmount: "Routes output back to input for chaos and distortion. Use carefully: 20-40% adds thickness, 60%+ creates instability.",
  formantShift: "Vowel-like filtering from vocal tract simulation. Creates talking/singing synth effects. Sweep through values for vowel morphing.",

  // Granular & Glitch
  grainSize: "Size of audio chunks in milliseconds. Small grains (10-50ms) for textures, large grains (100-300ms) for rhythmic stuttering.",
  grainSpeed: "Playback speed of grains. 1.0 is normal, 0.5 is half-speed, 2.0 is double-speed. Creates pitch shifting and time effects.",
  grainReverse: "Plays grains backward. Creates reverse-like textures and unusual timbres.",
  grainFreeze: "Freezes grain buffer for infinite sustain. Creates drone-like sustained textures from short sounds.",
  combFreq: "Comb filter frequency - creates metallic resonance. Match to pitch for harmonic reinforcement, detune for inharmonic clangs.",
  combFeedback: "Comb filter resonance. Low values (10-30%) add metallic sheen, high values (60-90%) create strong ringing.",
  combMix: "Balance between dry and comb-filtered signal. 30-50% adds character, 70%+ for pronounced effect.",
  sampleHoldRate: "Sample & hold rate in Hz. Creates stepped, quantized modulation. 2-8 Hz for rhythmic, 10+ for glitchy.",
  sampleHoldAmount: "Depth of sample & hold modulation. Creates random stepped changes. 30-50% for subtle randomness, 70%+ for chaos.",
  sampleHoldTarget: "What sample & hold affects. Pitch for random melody, Filter for timbral variation, PWM for pulse width randomization."
};

const AdvancedSynthControls = ({ params, onParamChange }) => {
  // Helper to create a knob control with tooltip
  const createKnob = (param, label, min, max, step = 0.01, unit = '', color = '#7bafd4', tooltip = null) => {
    // Safety check: if param is undefined, use min value as default
    const value = params[param] !== undefined ? params[param] : min;

    // Format display value based on parameter type
    let displayValue;
    if (unit === 's') {
      displayValue = `${value.toFixed(step < 0.01 ? 3 : 2)}${unit}`;
    } else if (unit === ' Hz') {
      displayValue = `${Math.round(value)}${unit}`;
    } else if (unit === ' cents' || unit === ' st' || unit === ' bits' || unit === ' ms') {
      displayValue = `${Math.round(value)}${unit}`;
    } else if (unit === '%') {
      displayValue = `${Math.round(value)}${unit}`;
    } else if (unit === 'x') {
      displayValue = `${value.toFixed(1)}${unit}`;
    } else {
      displayValue = `${value.toFixed(step < 1 ? 2 : 0)}${unit}`;
    }

    const control = (
      <div className="d-flex justify-content-center">
        <Knob
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(val) => onParamChange(param, val)}
          label={label}
          displayValue={displayValue}
          size={50}
          color={color}
        />
      </div>
    );

    if (tooltip) {
      return (
        <OverlayTrigger
          placement="top"
          delay={{ show: 1500, hide: 250 }}
          overlay={<Tooltip>{tooltip}</Tooltip>}
        >
          {control}
        </OverlayTrigger>
      );
    }
    return control;
  };

  // Helper for toggle controls with tooltip
  const createToggle = (param, label, options, tooltip = null) => {
    const control = (
      <div className="synth-control-group">
        <Form.Label className="text-light small mb-2">{label}</Form.Label>
        <ToggleButtonGroup
          type="radio"
          name={param}
          value={params[param]}
          onChange={(val) => onParamChange(param, val)}
          className="d-flex"
          size="sm"
        >
          {options.map(opt => (
            <ToggleButton
              key={opt.value}
              id={`${param}-${opt.value}`}
              value={opt.value}
              variant="outline-primary"
              className="flex-fill custom-toggle-btn"
            >
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
    );

    if (tooltip) {
      return (
        <OverlayTrigger
          placement="top"
          delay={{ show: 1500, hide: 250 }}
          overlay={<Tooltip>{tooltip}</Tooltip>}
        >
          {control}
        </OverlayTrigger>
      );
    }
    return control;
  };

  return (
    <div className="advanced-synth-controls">
      <Row className="g-3">
        {/* Oscillator Mixing Section */}
        <Col md={6}>
          <Card className="h-100 bg-dark border-0">
            <Card.Header className="text-light py-2 border-0" style={{ backgroundColor: '#1a1a1a' }}>
              <div className="d-flex align-items-center gap-2">
                <FaMixcloud />
                <span className="fw-bold small">OSCILLATOR MIXING</span>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              {/* Oscillator 2 Enable */}
              {createToggle('osc2Enabled', 'Oscillator 2', [
                { value: false, label: 'Off' },
                { value: true, label: 'On' }
              ], AdvancedTooltips.osc2Enabled)}

              {params.osc2Enabled && (
                <>
                  {/* Oscillator 2 Type */}
                  <div className="mt-3">
                    {createToggle('osc2Type', 'OSC 2 Waveform', [
                      { value: 'sine', label: '∿' },
                      { value: 'square', label: '⊓' },
                      { value: 'sawtooth', label: '⩙' },
                      { value: 'triangle', label: '△' }
                    ], AdvancedTooltips.osc2Type)}
                  </div>

                  {/* Oscillator Mix */}
                  <Row className="g-2 mt-3">
                    <Col xs={6}>
                      {createKnob('oscMix', 'OSC Mix', 0, 100, 1, '%', '#92ce84', AdvancedTooltips.oscMix)}
                    </Col>
                    <Col xs={6}>
                      {createKnob('osc2Detune', 'Detune', -100, 100, 1, ' cents', '#92ce84', AdvancedTooltips.osc2Detune)}
                    </Col>
                  </Row>

                  {/* Oscillator 2 Pitch */}
                  <Row className="g-2 mt-2">
                    <Col xs={12} className="d-flex justify-content-center">
                      {createKnob('osc2Pitch', 'OSC 2 Pitch', -24, 24, 1, ' st', '#7bafd4', AdvancedTooltips.osc2Pitch)}
                    </Col>
                  </Row>

                  {/* Cross Modulation */}
                  <div className="mt-3 pt-3 border-top border-secondary">
                    <h6 className="text-info small mb-2">Cross Modulation</h6>
                    <Row className="g-2">
                      <Col xs={6}>
                        {createKnob('fmAmount', 'FM', 0, 100, 1, '%', '#e75b5c', AdvancedTooltips.fmAmount)}
                      </Col>
                      <Col xs={6}>
                        {createKnob('ringModAmount', 'Ring Mod', 0, 100, 1, '%', '#e75b5c', AdvancedTooltips.ringModAmount)}
                      </Col>
                    </Row>
                    <div className="mt-2">
                      {createToggle('oscSync', 'OSC Sync', [
                        { value: false, label: 'Off' },
                        { value: true, label: 'On' }
                      ], AdvancedTooltips.oscSync)}
                    </div>
                  </div>
                </>
              )}

            </Card.Body>
          </Card>
        </Col>

        {/* Sub & Noise Section */}
        <Col md={6}>
          <Card className="h-100 bg-dark border-0">
            <Card.Header className="text-light py-2 border-0" style={{ backgroundColor: '#1a1a1a' }}>
              <div className="d-flex align-items-center gap-2">
                <GiSoundWaves />
                <span className="fw-bold small">SUB & NOISE</span>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              {/* Sub Oscillator */}
              <h6 className="text-info small mb-2">Sub Oscillator</h6>
              {createToggle('subOscEnabled', 'Sub OSC', [
                { value: false, label: 'Off' },
                { value: true, label: 'On' }
              ], AdvancedTooltips.subOscEnabled)}

              {params.subOscEnabled && (
                <>
                  <div className="mt-2">
                    {createToggle('subOscType', 'Sub Wave', [
                      { value: 'square', label: 'Square' },
                      { value: 'sine', label: 'Sine' }
                    ], AdvancedTooltips.subOscType)}
                  </div>
                  <div className="mt-2">
                    {createKnob('subOscLevel', 'Sub Level', 0, 100, 1, '%', '#cbb677', AdvancedTooltips.subOscLevel)}
                  </div>
                </>
              )}

              {/* Noise Generator */}
              <div className="mt-3 pt-3 border-top border-secondary">
                <h6 className="text-info small mb-2">Noise Generator</h6>
                {createKnob('noiseLevel', 'Noise Level', 0, 100, 1, '%', '#92ceaa', AdvancedTooltips.noiseLevel)}
                {params.noiseLevel > 0 && (
                  <div className="mt-2">
                    {createToggle('noiseType', 'Noise Color', [
                      { value: 'white', label: 'White' },
                      { value: 'pink', label: 'Pink' },
                      { value: 'brown', label: 'Brown' }
                    ], AdvancedTooltips.noiseType)}
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Advanced Filter Section */}
        <Col md={6}>
          <Card className="h-100 bg-dark border-0">
            <Card.Header className="text-light py-2 border-0" style={{ backgroundColor: '#1a1a1a' }}>
              <div className="d-flex align-items-center gap-2">
                <IoMdOptions />
                <span className="fw-bold small">ADVANCED FILTER</span>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              {/* Filter Type */}
              {createToggle('filterType', 'Filter Type', [
                { value: 'lowpass', label: 'LP' },
                { value: 'highpass', label: 'HP' },
                { value: 'bandpass', label: 'BP' },
                { value: 'notch', label: 'Notch' }
              ], AdvancedTooltips.filterType)}

              {/* Filter Envelope */}
              <div className="mt-3 pt-3 border-top border-secondary">
                <h6 className="text-info small mb-2">Filter Envelope</h6>
                {createKnob('filterEnvAmount', 'Env Amt', -100, 100, 1, '%', '#9b59b6', AdvancedTooltips.filterEnvAmount)}
                {params.filterEnvAmount !== 0 && (
                  <Row className="g-2 mt-2">
                    <Col xs={6}>
                      {createKnob('filterAttack', 'Attack', 0, 2, 0.001, 's', '#7bafd4', AdvancedTooltips.filterAttack)}
                    </Col>
                    <Col xs={6}>
                      {createKnob('filterDecay', 'Decay', 0, 2, 0.001, 's', '#7bafd4', AdvancedTooltips.filterDecay)}
                    </Col>
                    <Col xs={6}>
                      {createKnob('filterSustain', 'Sustain', 0, 1, 0.01, '', '#92ceaa', AdvancedTooltips.filterSustain)}
                    </Col>
                    <Col xs={6}>
                      {createKnob('filterRelease', 'Release', 0, 5, 0.001, 's', '#e75b5c', AdvancedTooltips.filterRelease)}
                    </Col>
                  </Row>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Modulation Section */}
        <Col md={6}>
          <Card className="h-100 bg-dark border-0">
            <Card.Header className="text-light py-2 border-0" style={{ backgroundColor: '#1a1a1a' }}>
              <div className="d-flex align-items-center gap-2">
                <FaWaveSquare />
                <span className="fw-bold small">MODULATION</span>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              {/* PWM for Square Wave */}
              <h6 className="text-info small mb-2">Pulse Width (Square)</h6>
              {createKnob('pulseWidth', 'Width', 5, 95, 1, '%', '#cbb677', AdvancedTooltips.pulseWidth)}
              {params.oscillatorType === 'square' && (
                <Row className="g-2 mt-2">
                  <Col xs={6}>
                    {createKnob('pwmAmount', 'PWM Amt', 0, 100, 1, '%', '#9b59b6', AdvancedTooltips.pwmAmount)}
                  </Col>
                  <Col xs={6}>
                    {params.pwmAmount > 0 && createKnob('pwmRate', 'PWM Rate', 0.1, 20, 0.1, ' Hz', '#9b59b6', AdvancedTooltips.pwmRate)}
                  </Col>
                </Row>
              )}

              {/* Additional LFO */}
              <div className="mt-3 pt-3 border-top border-secondary">
                <h6 className="text-info small mb-2">LFO 2</h6>
                {createToggle('lfo2Target', 'Target', [
                  { value: 'off', label: 'Off' },
                  { value: 'pitch', label: 'Pitch' },
                  { value: 'filter', label: 'Filter' },
                  { value: 'amp', label: 'Amp' }
                ], AdvancedTooltips.lfo2Target)}
                {params.lfo2Target !== 'off' && (
                  <Row className="g-2 mt-2">
                    <Col xs={6}>
                      {createKnob('lfo2Rate', 'Rate', 0.1, 20, 0.1, ' Hz', '#92ceaa', AdvancedTooltips.lfo2Rate)}
                    </Col>
                    <Col xs={6}>
                      {createKnob('lfo2Amount', 'Amount', 0, 100, 1, '%', '#92ceaa', AdvancedTooltips.lfo2Amount)}
                    </Col>
                  </Row>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Experimental Effects Section */}
        <Col md={6}>
          <Card className="h-100 bg-dark border-0">
            <Card.Header className="text-light py-2 border-0" style={{ backgroundColor: '#1a1a1a' }}>
              <div className="d-flex align-items-center gap-2">
                <MdScience />
                <span className="fw-bold small">EXPERIMENTAL</span>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              {/* Bit Crusher */}
              <h6 className="text-info small mb-2">Bit Crusher</h6>
              <Row className="g-2">
                <Col xs={6}>
                  {createKnob('bitCrushBits', 'Bit Depth', 1, 16, 1, ' bits', '#e75b5c', AdvancedTooltips.bitCrushBits)}
                </Col>
                <Col xs={6}>
                  {createKnob('bitCrushRate', 'Sample Rate', 1000, 44100, 1000, ' Hz', '#e75b5c', AdvancedTooltips.bitCrushRate)}
                </Col>
              </Row>

              {/* Wave Folder */}
              <div className="mt-3">
                <h6 className="text-info small mb-2">Wave Folder</h6>
                {createKnob('waveFoldAmount', 'Fold Amount', 0, 100, 1, '%', '#cbb677', AdvancedTooltips.waveFoldAmount)}
              </div>

              {/* Feedback */}
              <div className="mt-3">
                <h6 className="text-info small mb-2">Chaos Control</h6>
                {createKnob('feedbackAmount', 'Feedback', 0, 90, 1, '%', '#e75b5c', AdvancedTooltips.feedbackAmount)}
              </div>

              {/* Formant Filter */}
              <div className="mt-3">
                <h6 className="text-info small mb-2">Vowel Formant</h6>
                {createKnob('formantShift', 'Vowel Morph', 0, 100, 1, '', '#9b59b6', AdvancedTooltips.formantShift)}
                {params.formantShift > 0 && (
                  <div className="mt-2 text-muted small">
                    {params.formantShift < 10 ? 'Neutral' :
                     params.formantShift < 20 ? 'EE (beat)' :
                     params.formantShift < 30 ? 'IH (bit)' :
                     params.formantShift < 40 ? 'EH (bet)' :
                     params.formantShift < 50 ? 'AE (bat)' :
                     params.formantShift < 60 ? 'AH (but)' :
                     params.formantShift < 70 ? 'AW (bought)' :
                     params.formantShift < 80 ? 'UH (foot)' :
                     params.formantShift < 90 ? 'UW (boot)' :
                     'ER (bird)'}
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Granular & Glitch Section */}
        <Col md={6}>
          <Card className="h-100 bg-dark border-0">
            <Card.Header className="text-light py-2 border-0" style={{ backgroundColor: '#1a1a1a' }}>
              <div className="d-flex align-items-center gap-2">
                <IoMdOptions />
                <span className="fw-bold small">GRANULAR & GLITCH</span>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              {/* Granular Buffer */}
              <h6 className="text-info small mb-2">Grain Buffer</h6>
              <Row className="g-2">
                <Col xs={6}>
                  {createKnob('grainSize', 'Grain Size', 10, 500, 10, ' ms', '#7bafd4', AdvancedTooltips.grainSize)}
                </Col>
                <Col xs={6}>
                  {createKnob('grainSpeed', 'Speed', 0.1, 2.0, 0.1, 'x', '#7bafd4', AdvancedTooltips.grainSpeed)}
                </Col>
              </Row>
              <div className="mt-2">
                {createToggle('grainReverse', 'Direction', [
                  { value: false, label: 'Forward' },
                  { value: true, label: 'Reverse' }
                ], AdvancedTooltips.grainReverse)}
              </div>
              <div className="mt-2">
                {createToggle('grainFreeze', 'Freeze', [
                  { value: false, label: 'Off' },
                  { value: true, label: 'Frozen' }
                ], AdvancedTooltips.grainFreeze)}
              </div>

              {/* Comb Filter */}
              <div className="mt-3 pt-3 border-top border-secondary">
                <h6 className="text-info small mb-2">Metallic Resonator</h6>
                <Row className="g-2">
                  <Col xs={6}>
                    {createKnob('combFreq', 'Frequency', 50, 2000, 10, ' Hz', '#cbb677', AdvancedTooltips.combFreq)}
                  </Col>
                  <Col xs={6}>
                    {createKnob('combFeedback', 'Resonance', 0, 95, 1, '%', '#cbb677', AdvancedTooltips.combFeedback)}
                  </Col>
                </Row>
                <div className="mt-2">
                  {createKnob('combMix', 'Mix', 0, 100, 1, '%', '#92ceaa', AdvancedTooltips.combMix)}
                </div>
              </div>

              {/* Sample & Hold */}
              <div className="mt-3 pt-3 border-top border-secondary">
                <h6 className="text-info small mb-2">Sample & Hold</h6>
                <Row className="g-2">
                  <Col xs={6}>
                    {createKnob('sampleHoldRate', 'Rate', 0.5, 50, 0.5, ' Hz', '#9b59b6', AdvancedTooltips.sampleHoldRate)}
                  </Col>
                  <Col xs={6}>
                    {createKnob('sampleHoldAmount', 'Amount', 0, 100, 1, '%', '#9b59b6', AdvancedTooltips.sampleHoldAmount)}
                  </Col>
                </Row>
                {params.sampleHoldAmount > 0 && (
                  <div className="mt-2">
                    {createToggle('sampleHoldTarget', 'Target', [
                      { value: 'pitch', label: 'Pitch' },
                      { value: 'filter', label: 'Filter' },
                      { value: 'pwm', label: 'PWM' }
                    ], AdvancedTooltips.sampleHoldTarget)}
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Custom styles */}
      <style jsx>{`
        .advanced-synth-controls {
          color: #fff;
        }

        :global(.custom-toggle-btn.btn-outline-primary:not(.active)) {
          color: #dee2e6 !important;
          background-color: #2a2a2a !important;
          border-color: #6c757d !important;
        }

        :global(.custom-toggle-btn.btn-outline-primary:not(.active):hover) {
          color: #fff !important;
          background-color: #3a3a3a !important;
          border-color: #8c959d !important;
        }

        :global(.custom-toggle-btn.btn-outline-primary.active),
        :global(.custom-toggle-btn.btn-outline-primary[aria-pressed="true"]),
        :global(.btn-check:checked + .custom-toggle-btn.btn-outline-primary) {
          background-color: #dee2e6 !important;
          border-color: #adb5bd !important;
          color: #212529 !important;
        }

        :global(.custom-toggle-btn.btn-outline-primary.active:hover),
        :global(.custom-toggle-btn.btn-outline-primary[aria-pressed="true"]:hover),
        :global(.btn-check:checked + .custom-toggle-btn.btn-outline-primary:hover) {
          background-color: #f8f9fa !important;
          border-color: #ced4da !important;
          color: #212529 !important;
        }
      `}</style>
    </div>
  );
};

export default AdvancedSynthControls;