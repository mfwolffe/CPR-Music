'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert, Spinner } from 'react-bootstrap';
import { FaCog, FaCheck, FaTimes, FaArrowLeft } from 'react-icons/fa';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

// Import individual effect components from mono editor
// TODO: These will be imported in Phase 3
// import EQ from '../Effects/EQ';
// import Reverb from '../Effects/Reverb';
// import Compressor from '../Effects/Compressor';
// ... etc

const EFFECT_INFO = {
  eq: { name: 'EQ', category: 'Frequency', description: 'Multi-band equalizer' },
  reverb: { name: 'Reverb', category: 'Space', description: 'Algorithmic reverb' },
  compressor: { name: 'Compressor', category: 'Dynamics', description: 'Dynamic range control' },
  chorus: { name: 'Chorus', category: 'Modulation', description: 'Pitch modulation chorus' },
  distortion: { name: 'Distortion', category: 'Dynamics', description: 'Harmonic distortion' },
  phaser: { name: 'Phaser', category: 'Modulation', description: 'Phase shifting modulation' },
  autoPan: { name: 'Auto Pan', category: 'Space', description: 'Automatic stereo panning' },
  tremolo: { name: 'Tremolo', category: 'Modulation', description: 'Amplitude modulation' },
  gate: { name: 'Gate', category: 'Dynamics', description: 'Noise gate' },
  flanger: { name: 'Flanger', category: 'Modulation', description: 'Sweeping comb filter' },
  echo: { name: 'Echo', category: 'Time', description: 'Simple echo delay' },
  pitchShifter: { name: 'Pitch Shifter', category: 'Pitch', description: 'Pitch shifting without time change' },
  // Add more as needed...
};

// Placeholder component for effect parameters
function EffectParametersPlaceholder({ effectType, onParameterChange }) {
  const effectInfo = EFFECT_INFO[effectType] || { 
    name: effectType, 
    category: 'Unknown', 
    description: 'Effect parameters will be loaded here' 
  };

  return (
    <div className="text-center py-5">
      <FaCog size={48} className="text-muted mb-3" />
      <h4>{effectInfo.name}</h4>
      <p className="text-muted mb-4">{effectInfo.description}</p>
      
      <Alert variant="info">
        <Alert.Heading>Phase 3 Implementation</Alert.Heading>
        <p className="mb-0">
          This is where the {effectInfo.name} parameters will be loaded from the mono editor's EffectsRack.
          The actual knobs, sliders, and controls will be imported and configured in Phase 3.
        </p>
      </Alert>

      <div className="mt-4">
        <small className="text-muted">
          Category: <strong>{effectInfo.category}</strong>
        </small>
      </div>
    </div>
  );
}

export default function EffectParametersModal() {
  const {
    showEffectParametersModal,
    setShowEffectParametersModal,
    setShowEffectSelectionModal,
    selectedEffectType,
    setSelectedEffectType,
    effectTargetTrackId,
    tracks,
    updateTrack
  } = useMultitrack();

  const [effectParameters, setEffectParameters] = useState({});
  const [isApplying, setIsApplying] = useState(false);

  const targetTrack = tracks.find(t => t.id === effectTargetTrackId);
  const effectInfo = EFFECT_INFO[selectedEffectType] || { name: selectedEffectType, category: 'Unknown' };

  const handleParameterChange = (paramName, value) => {
    setEffectParameters(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const handleApplyEffect = async () => {
    if (!targetTrack || !selectedEffectType) return;

    setIsApplying(true);

    try {
      // In Phase 4, we'll implement the actual effect application
      // For now, we'll just add the effect configuration to the track
      const newEffect = {
        id: `${selectedEffectType}-${Date.now()}`,
        type: selectedEffectType,
        parameters: effectParameters,
        enabled: true,
        bypass: false
      };

      const updatedEffects = [...(targetTrack.effects || []), newEffect];

      updateTrack(targetTrack.id, {
        effects: updatedEffects
      });

      console.log(`🎛️ Added ${effectInfo.name} to track ${targetTrack.name}:`, newEffect);

      // Close modal on success
      handleClose();
    } catch (error) {
      console.error('Error applying effect:', error);
    } finally {
      setIsApplying(false);
    }
  };

  const handleClose = () => {
    setShowEffectParametersModal(false);
    setSelectedEffectType(null);
    setEffectParameters({});
  };

  const handleBackToSelection = () => {
    setShowEffectParametersModal(false);
    setShowEffectSelectionModal(true);
    // Keep selectedEffectType and effectTargetTrackId for potential reuse
  };

  // Reset parameters when effect type changes
  useEffect(() => {
    if (selectedEffectType) {
      setEffectParameters({});
    }
  }, [selectedEffectType]);

  if (!selectedEffectType) {
    return null;
  }

  return (
    <Modal
      show={showEffectParametersModal}
      onHide={handleClose}
      size="lg"
      centered
      backdrop="static"
      keyboard={true}
    >
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          <FaCog />
          Configure {effectInfo.name}
          {targetTrack && (
            <small className="text-muted ms-2">
              → {targetTrack.name}
            </small>
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ minHeight: '400px' }}>
        <EffectParametersPlaceholder
          effectType={selectedEffectType}
          onParameterChange={handleParameterChange}
        />
      </Modal.Body>

      <Modal.Footer>
        <div className="d-flex justify-content-between align-items-center w-100">
          <Button 
            variant="outline-secondary" 
            onClick={handleBackToSelection}
            className="d-flex align-items-center gap-2"
          >
            <FaArrowLeft size={14} />
            Back to Effects
          </Button>

          <div className="d-flex gap-2">
            <Button variant="secondary" onClick={handleClose}>
              <FaTimes className="me-1" />
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleApplyEffect}
              disabled={isApplying}
              className="d-flex align-items-center gap-2"
            >
              {isApplying ? (
                <>
                  <Spinner size="sm" />
                  Applying...
                </>
              ) : (
                <>
                  <FaCheck />
                  Add Effect
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
}