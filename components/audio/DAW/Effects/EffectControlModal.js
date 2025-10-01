'use client';

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Modal, Button, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { FaArrowLeft, FaTimes, FaPlay, FaStop, FaMagic } from 'react-icons/fa';
import { useUI } from '../../../../contexts/DAWProvider';

// Dynamically import effect components
const effectComponents = {
  eq: lazy(() => import('./EQ')),
  filter: lazy(() => import('./Filter')),
  compressor: lazy(() => import('./Compressor')),
  limiter: lazy(() => import('./Limiter')),
  gate: lazy(() => import('./Gate')),
  distortion: lazy(() => import('./Distortion')),
  echo: lazy(() => import('./Echo')),
  advdelay: lazy(() => import('./AdvancedDelay')),
  reverb: lazy(() => import('./Reverb')),
  reverseverb: lazy(() => import('./ReverseReverb')),
  chorus: lazy(() => import('./Chorus')),
  flanger: lazy(() => import('./Flanger')),
  phaser: lazy(() => import('./Phaser')),
  tremolo: lazy(() => import('./Tremolo')),
  autopan: lazy(() => import('./AutoPan')),
  autowah: lazy(() => import('./AutoWah')),
  pitchshift: lazy(() => import('./PitchShifter')),
  freqshift: lazy(() => import('./FrequencyShifter')),
  ringmod: lazy(() => import('./RingModulator')),
  glitch: lazy(() => import('./Glitch')),
  granular: lazy(() => import('./GranularFreeze')),
  paulstretch: lazy(() => import('./Paulstretch')),
  spectral: lazy(() => import('./SpectralFilter')),
  stereowide: lazy(() => import('./StereoWidener'))
};

export default function EffectControlModal() {
  const {
    showEffectControlModal,
    setShowEffectControlModal,
    setShowEffectsModal,
    selectedEffect,
    setSelectedEffect
  } = useUI();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleBack = () => {
    setShowEffectControlModal(false);
    setShowEffectsModal(true);
  };

  const handleClose = () => {
    setShowEffectControlModal(false);
    setSelectedEffect(null);
  };

  const handleApply = () => {
    // This would trigger the actual effect application
    // For now, just close the modal
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      handleClose();
    }, 1000);
  };

  if (!selectedEffect) {
    return null;
  }

  const EffectComponent = effectComponents[selectedEffect.id];
  const Icon = selectedEffect.icon;

  return (
    <Modal
      show={showEffectControlModal}
      onHide={handleClose}
      size="xl"
      fullscreen
      centered
      backdrop="static"
      keyboard={true}
      className="effect-control-modal"
    >
      <Modal.Header className="bg-dark text-white border-secondary">
        <div className="d-flex align-items-center gap-3 flex-grow-1">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={handleBack}
            disabled={isProcessing}
          >
            <FaArrowLeft className="me-2" />
            Back
          </Button>
          <div className="d-flex align-items-center gap-2">
            <div
              className="effect-icon p-2 rounded"
              style={{ backgroundColor: selectedEffect.color + '33' }}
            >
              <Icon size={20} style={{ color: selectedEffect.color }} />
            </div>
            <Modal.Title className="mb-0">
              {selectedEffect.name}
            </Modal.Title>
          </div>
        </div>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={handleClose}
          disabled={isProcessing}
        >
          <FaTimes />
        </Button>
      </Modal.Header>

      <Modal.Body className="p-0" style={{ backgroundColor: '#1a1a1a', height: '80vh' }}>
        <div className="h-100 d-flex flex-column">
          {/* Main content area with scrolling */}
          <div className="flex-grow-1 overflow-auto p-4">
            <Suspense
              fallback={
                <div className="d-flex align-items-center justify-content-center h-100">
                  <Spinner animation="border" variant="primary" />
                </div>
              }
            >
              {EffectComponent ? (
                <div className="effect-controls-container">
                  <EffectComponent width={100} modalMode={true} />
                </div>
              ) : (
                <Alert variant="warning">
                  Effect component not found for: {selectedEffect.id}
                </Alert>
              )}
            </Suspense>
          </div>

          {/* Fixed bottom action bar */}
          <div className="border-top border-secondary p-3 bg-darker">
            <div className="d-flex gap-2 justify-content-end">
              <Button
                variant="outline-secondary"
                onClick={handleClose}
                disabled={isProcessing}
                style={{ minWidth: '120px' }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleApply}
                disabled={isProcessing}
                style={{ minWidth: '120px' }}
              >
                {isProcessing ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                      className="me-2"
                    />
                    Processing...
                  </>
                ) : (
                  <>
                    <FaPlay className="me-2" />
                    Apply Effect
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}