'use client';

import React from 'react';
import { Row, Col, Form, Card, Badge } from 'react-bootstrap';
import { FaWaveSquare, FaSlidersH, FaClock, FaWater } from 'react-icons/fa';

const SynthControls = ({ params, onParamChange }) => {
  // Helper to create a slider control
  const createSlider = (param, label, min, max, step = 1, unit = '') => (
    <div className="synth-control-group">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <Form.Label className="mb-0 text-light small">{label}</Form.Label>
        <Badge bg="dark" className="font-monospace">
          {params[param]}{unit}
        </Badge>
      </div>
      <Form.Range
        min={min}
        max={max}
        step={step}
        value={params[param]}
        onChange={(e) => onParamChange(param, parseFloat(e.target.value))}
        className="synth-slider"
      />
    </div>
  );

  // Helper to create a select control
  const createSelect = (param, label, options) => (
    <div className="synth-control-group">
      <Form.Label className="text-light small">{label}</Form.Label>
      <Form.Select
        value={params[param]}
        onChange={(e) => onParamChange(param, e.target.value)}
        className="bg-dark text-light border-secondary"
        size="sm"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Form.Select>
    </div>
  );

  return (
    <div className="synth-controls">
      <Row className="g-4">
        {/* Oscillator Section */}
        <Col md={6} lg={3}>
          <Card className="h-100 bg-dark border-secondary">
            <Card.Header className="bg-gradient text-light py-2 border-secondary">
              <div className="d-flex align-items-center gap-2">
                <FaWaveSquare />
                <span className="fw-bold small">OSCILLATOR</span>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              {createSelect('oscillatorType', 'Waveform', [
                { value: 'sine', label: 'Sine' },
                { value: 'square', label: 'Square' },
                { value: 'sawtooth', label: 'Sawtooth' },
                { value: 'triangle', label: 'Triangle' }
              ])}
              <div className="mt-3">
                {createSlider('detune', 'Detune', -100, 100, 1, ' cents')}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Filter Section */}
        <Col md={6} lg={3}>
          <Card className="h-100 bg-dark border-secondary">
            <Card.Header className="bg-gradient text-light py-2 border-secondary">
              <div className="d-flex align-items-center gap-2">
                <FaSlidersH />
                <span className="fw-bold small">FILTER</span>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              {createSlider('filterCutoff', 'Cutoff', 20, 20000, 10, ' Hz')}
              <div className="mt-3">
                {createSlider('filterResonance', 'Resonance', 0, 30, 0.1)}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Envelope Section */}
        <Col md={6} lg={3}>
          <Card className="h-100 bg-dark border-secondary">
            <Card.Header className="bg-gradient text-light py-2 border-secondary">
              <div className="d-flex align-items-center gap-2">
                <FaClock />
                <span className="fw-bold small">ENVELOPE</span>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              <div className="envelope-controls">
                {createSlider('attack', 'Attack', 0, 2, 0.001, 's')}
                {createSlider('decay', 'Decay', 0, 2, 0.001, 's')}
                {createSlider('sustain', 'Sustain', 0, 1, 0.01)}
                {createSlider('release', 'Release', 0, 5, 0.001, 's')}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Effects Section */}
        <Col md={6} lg={3}>
          <Card className="h-100 bg-dark border-secondary">
            <Card.Header className="bg-gradient text-light py-2 border-secondary">
              <div className="d-flex align-items-center gap-2">
                <FaWater />
                <span className="fw-bold small">EFFECTS</span>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              {createSlider('reverb', 'Reverb', 0, 100, 1, '%')}
              <div className="mt-2">
                {createSlider('delay', 'Delay', 0, 100, 1, '%')}
              </div>
              <div className="mt-2">
                {createSlider('distortion', 'Distortion', 0, 100, 1, '%')}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* LFO Section */}
      <Row className="mt-4">
        <Col>
          <Card className="bg-dark border-secondary">
            <Card.Header className="bg-gradient text-light py-2 border-secondary">
              <span className="fw-bold small">LFO (Low Frequency Oscillator)</span>
            </Card.Header>
            <Card.Body className="p-3">
              <Row>
                <Col md={6}>
                  {createSlider('lfoRate', 'Rate', 0.1, 20, 0.1, ' Hz')}
                </Col>
                <Col md={6}>
                  {createSlider('lfoAmount', 'Amount', 0, 100, 1, '%')}
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Custom styles */}
      <style jsx>{`
        .synth-controls {
          color: #fff;
        }

        .synth-control-group {
          margin-bottom: 0.75rem;
        }

        .synth-slider {
          height: 6px;
          background: linear-gradient(to right, #0d6efd 0%, #0d6efd ${props => (props.value / props.max) * 100}%, #333 ${props => (props.value / props.max) * 100}%, #333 100%);
          border-radius: 3px;
          outline: none;
          -webkit-appearance: none;
        }

        .synth-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          background: #0d6efd;
          border: 2px solid #fff;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .synth-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          background: #0d6efd;
          border: 2px solid #fff;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .bg-gradient {
          background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
        }

        .envelope-controls > div {
          margin-bottom: 0.5rem;
        }

        .envelope-controls > div:last-child {
          margin-bottom: 0;
        }

        .form-select option {
          background-color: #1a1a1a;
        }
      `}</style>
    </div>
  );
};

export default SynthControls;