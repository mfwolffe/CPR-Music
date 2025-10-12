'use client';

import React from 'react';
import { Row, Col, Form, Card, Badge, ToggleButtonGroup, ToggleButton } from 'react-bootstrap';
import { GiSoundWaves } from 'react-icons/gi';
import { FaMixcloud, FaWaveSquare } from 'react-icons/fa';
import { IoMdOptions } from 'react-icons/io';
import { MdScience } from 'react-icons/md';

const AdvancedSynthControls = ({ params, onParamChange }) => {
  // Helper to create a slider control
  const createSlider = (param, label, min, max, step = 1, unit = '') => (
    <div className="synth-control-group">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <Form.Label className="mb-0 text-light small">{label}</Form.Label>
        <Badge bg="dark" className="font-monospace">
          {params[param]?.toFixed?.(step < 1 ? 2 : 0) || params[param]}{unit}
        </Badge>
      </div>
      <Form.Range
        min={min}
        max={max}
        step={step}
        value={params[param] || 0}
        onChange={(e) => onParamChange(param, parseFloat(e.target.value))}
        className="synth-slider"
      />
    </div>
  );

  // Helper for toggle controls
  const createToggle = (param, label, options) => (
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
            className="flex-fill"
          >
            {opt.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );

  return (
    <div className="advanced-synth-controls">
      <Row className="g-3">
        {/* Oscillator Mixing Section */}
        <Col md={6}>
          <Card className="h-100 bg-dark border-secondary">
            <Card.Header className="bg-gradient text-light py-2 border-secondary">
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
              ])}

              {params.osc2Enabled && (
                <>
                  {/* Oscillator 2 Type */}
                  <div className="mt-3">
                    {createToggle('osc2Type', 'OSC 2 Waveform', [
                      { value: 'sine', label: '∿' },
                      { value: 'square', label: '⊓' },
                      { value: 'sawtooth', label: '⩙' },
                      { value: 'triangle', label: '△' }
                    ])}
                  </div>

                  {/* Oscillator Mix */}
                  <div className="mt-3">
                    {createSlider('oscMix', 'OSC Mix (1←→2)', 0, 100, 1, '%')}
                  </div>

                  {/* Oscillator 2 Detune */}
                  <div className="mt-2">
                    {createSlider('osc2Detune', 'OSC 2 Detune', -100, 100, 1, ' cents')}
                  </div>

                  {/* Oscillator 2 Pitch */}
                  <div className="mt-2">
                    {createSlider('osc2Pitch', 'OSC 2 Pitch', -24, 24, 1, ' st')}
                  </div>

                  {/* Cross Modulation */}
                  <div className="mt-3 pt-3 border-top border-secondary">
                    <h6 className="text-info small mb-2">Cross Modulation</h6>
                    {createSlider('fmAmount', 'FM Amount', 0, 100, 1, '%')}
                    {createSlider('ringModAmount', 'Ring Mod', 0, 100, 1, '%')}
                    {createToggle('oscSync', 'OSC Sync', [
                      { value: false, label: 'Off' },
                      { value: true, label: 'On' }
                    ])}
                  </div>
                </>
              )}

            </Card.Body>
          </Card>
        </Col>

        {/* Sub & Noise Section */}
        <Col md={6}>
          <Card className="h-100 bg-dark border-secondary">
            <Card.Header className="bg-gradient text-light py-2 border-secondary">
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
              ])}

              {params.subOscEnabled && (
                <>
                  <div className="mt-2">
                    {createToggle('subOscType', 'Sub Wave', [
                      { value: 'square', label: 'Square' },
                      { value: 'sine', label: 'Sine' }
                    ])}
                  </div>
                  <div className="mt-2">
                    {createSlider('subOscLevel', 'Sub Level', 0, 100, 1, '%')}
                  </div>
                </>
              )}

              {/* Noise Generator */}
              <div className="mt-3 pt-3 border-top border-secondary">
                <h6 className="text-info small mb-2">Noise Generator</h6>
                {createSlider('noiseLevel', 'Noise Level', 0, 100, 1, '%')}
                {params.noiseLevel > 0 && (
                  <div className="mt-2">
                    {createToggle('noiseType', 'Noise Color', [
                      { value: 'white', label: 'White' },
                      { value: 'pink', label: 'Pink' },
                      { value: 'brown', label: 'Brown' }
                    ])}
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Advanced Filter Section */}
        <Col md={6}>
          <Card className="h-100 bg-dark border-secondary">
            <Card.Header className="bg-gradient text-light py-2 border-secondary">
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
              ])}

              {/* Filter Envelope */}
              <div className="mt-3 pt-3 border-top border-secondary">
                <h6 className="text-info small mb-2">Filter Envelope</h6>
                {createSlider('filterEnvAmount', 'Env Amount', -100, 100, 1, '%')}
                {params.filterEnvAmount !== 0 && (
                  <>
                    {createSlider('filterAttack', 'Attack', 0, 2, 0.001, 's')}
                    {createSlider('filterDecay', 'Decay', 0, 2, 0.001, 's')}
                    {createSlider('filterSustain', 'Sustain', 0, 1, 0.01)}
                    {createSlider('filterRelease', 'Release', 0, 5, 0.001, 's')}
                  </>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Modulation Section */}
        <Col md={6}>
          <Card className="h-100 bg-dark border-secondary">
            <Card.Header className="bg-gradient text-light py-2 border-secondary">
              <div className="d-flex align-items-center gap-2">
                <FaWaveSquare />
                <span className="fw-bold small">MODULATION</span>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              {/* PWM for Square Wave */}
              <h6 className="text-info small mb-2">Pulse Width (Square)</h6>
              {createSlider('pulseWidth', 'Width', 5, 95, 1, '%')}
              {params.oscillatorType === 'square' && (
                <>
                  {createSlider('pwmAmount', 'PWM Amount', 0, 100, 1, '%')}
                  {params.pwmAmount > 0 && createSlider('pwmRate', 'PWM Rate', 0.1, 20, 0.1, ' Hz')}
                </>
              )}

              {/* Additional LFO */}
              <div className="mt-3 pt-3 border-top border-secondary">
                <h6 className="text-info small mb-2">LFO 2</h6>
                {createToggle('lfo2Target', 'Target', [
                  { value: 'off', label: 'Off' },
                  { value: 'pitch', label: 'Pitch' },
                  { value: 'filter', label: 'Filter' },
                  { value: 'amp', label: 'Amp' }
                ])}
                {params.lfo2Target !== 'off' && (
                  <>
                    <div className="mt-2">
                      {createSlider('lfo2Rate', 'Rate', 0.1, 20, 0.1, ' Hz')}
                    </div>
                    <div className="mt-2">
                      {createSlider('lfo2Amount', 'Amount', 0, 100, 1, '%')}
                    </div>
                  </>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Experimental Effects Section */}
        <Col md={6}>
          <Card className="h-100 bg-dark border-secondary">
            <Card.Header className="bg-gradient text-light py-2 border-secondary">
              <div className="d-flex align-items-center gap-2">
                <MdScience />
                <span className="fw-bold small">EXPERIMENTAL</span>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              {/* Bit Crusher */}
              <h6 className="text-info small mb-2">Bit Crusher</h6>
              {createSlider('bitCrushBits', 'Bit Depth', 1, 16, 1, ' bits')}
              {createSlider('bitCrushRate', 'Sample Rate', 1000, 44100, 1000, ' Hz')}

              {/* Wave Folder */}
              <div className="mt-3">
                <h6 className="text-info small mb-2">Wave Folder</h6>
                {createSlider('waveFoldAmount', 'Fold Amount', 0, 100, 1, '%')}
              </div>

              {/* Feedback */}
              <div className="mt-3">
                <h6 className="text-info small mb-2">Chaos Control</h6>
                {createSlider('feedbackAmount', 'Feedback', 0, 90, 1, '%')}
              </div>

              {/* Formant Filter */}
              <div className="mt-3">
                <h6 className="text-info small mb-2">Vowel Formant</h6>
                {createSlider('formantShift', 'Vowel Morph', 0, 100, 1)}
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
      </Row>

      {/* Custom styles */}
      <style jsx>{`
        .advanced-synth-controls {
          color: #fff;
        }

        .synth-control-group {
          margin-bottom: 0.75rem;
        }

        .synth-slider {
          height: 6px;
          background: #333;
          border-radius: 3px;
          outline: none;
          -webkit-appearance: none;
        }

        .synth-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          background: #9b59b6;
          border: 2px solid #fff;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .synth-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          background: #9b59b6;
          border: 2px solid #fff;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .bg-gradient {
          background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
        }

        .btn-outline-primary:not(.active) {
          color: #666;
          border-color: #444;
        }

        .btn-outline-primary.active {
          background-color: #9b59b6;
          border-color: #9b59b6;
        }
      `}</style>
    </div>
  );
};

export default AdvancedSynthControls;