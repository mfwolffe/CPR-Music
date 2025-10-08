/**
 * Clip Effects Rack
 *
 * Modern effects rack for multitrack editor that operates on selected clips.
 * Unlike the single-track effects rack, this applies effects to individual clips non-destructively.
 */

'use client';

import { useState, useCallback } from 'react';
import { Modal, Button, Card, Row, Col, Badge, ListGroup, Dropdown, OverlayTrigger, Tooltip, ProgressBar, Alert } from 'react-bootstrap';
import { FaPlus, FaTimes, FaPowerOff, FaGripVertical, FaEllipsisV, FaCopy, FaCog, FaCheck } from 'react-icons/fa';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import {
  addEffectToClip,
  removeEffectFromClip,
  toggleEffectEnabled,
  reorderEffects,
  clearAllEffects,
  copyEffectsToClip,
  EFFECT_CHAIN_PRESETS,
  applyEffectChainPreset,
  processClipWithEffects
} from './ClipEffectsManager';
import { EFFECTS_CATALOG, getEffectsByCategory } from '../../../../lib/effects/EffectsParameterSchemas';
import ClipEffectParametersModal from './ClipEffectParametersModal';
import { decodeAudioFromURL } from './AudioEngine';

/**
 * Convert AudioBuffer to WAV file
 */
function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const data = [];
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      data.push(int16);
    }
  }

  const dataLength = data.length * bytesPerSample;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  // Write audio data
  let offset = 44;
  for (let i = 0; i < data.length; i++) {
    view.setInt16(offset, data[i], true);
    offset += 2;
  }

  return arrayBuffer;
}

/**
 * Effects Browser Modal - Select effects to add
 */
function EffectsBrowserModal({ show, onHide, onSelectEffect }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const effectsByCategory = getEffectsByCategory();

  const allEffects = Object.values(EFFECTS_CATALOG);
  const displayEffects = selectedCategory === 'all'
    ? allEffects
    : effectsByCategory[selectedCategory] || [];

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="bg-dark text-white">
        <Modal.Title>Add Effect</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-white">
        {/* Category Filter */}
        <div className="mb-3">
          <Button
            size="sm"
            variant={selectedCategory === 'all' ? 'primary' : 'outline-secondary'}
            className="me-2"
            onClick={() => setSelectedCategory('all')}
          >
            All
          </Button>
          {Object.keys(effectsByCategory).map(category => (
            <Button
              key={category}
              size="sm"
              variant={selectedCategory === category ? 'primary' : 'outline-secondary'}
              className="me-2"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Effects Grid */}
        <Row>
          {displayEffects.map(effect => {
            const IconComponent = effect.icon;
            return (
              <Col key={effect.id} xs={12} sm={6} md={4} className="mb-3">
                <Card
                  className="h-100 bg-secondary text-white cursor-pointer hover-lift"
                  onClick={() => {
                    onSelectEffect(effect.id);
                    onHide();
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <Card.Body>
                    <div className="text-center mb-2" style={{ fontSize: '2rem' }}>
                      {IconComponent && <IconComponent />}
                    </div>
                    <Card.Title className="text-center small">{effect.name}</Card.Title>
                    <Card.Text className="text-center" style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                      {effect.description}
                    </Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      </Modal.Body>
    </Modal>
  );
}

/**
 * Presets Dropdown
 */
function PresetsDropdown({ onApplyPreset }) {
  return (
    <Dropdown>
      <Dropdown.Toggle variant="outline-secondary" size="sm">
        Presets
      </Dropdown.Toggle>
      <Dropdown.Menu className="bg-dark">
        {Object.entries(EFFECT_CHAIN_PRESETS).map(([key, preset]) => (
          <Dropdown.Item
            key={key}
            className="text-white"
            onClick={() => onApplyPreset(key)}
          >
            {preset.name}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}

/**
 * Effect Chain Item - Single effect in the rack
 */
function EffectChainItem({ effect, onRemove, onToggle, onMoveUp, onMoveDown, onEdit, canMoveUp, canMoveDown }) {
  const effectInfo = EFFECTS_CATALOG[effect.type];
  const IconComponent = effectInfo?.icon;

  return (
    <ListGroup.Item className="bg-secondary text-white d-flex align-items-center justify-content-between p-2">
      {/* Drag Handle */}
      <div className="d-flex align-items-center" style={{ gap: '8px' }}>
        <FaGripVertical className="text-muted" style={{ cursor: 'grab' }} />

        {/* Effect Icon & Name - Clickable to edit */}
        <div
          onClick={onEdit}
          style={{ cursor: 'pointer' }}
          className="hover-highlight"
        >
          {IconComponent && <IconComponent className="me-2" />}
          <strong>{effectInfo?.name || effect.type}</strong>
        </div>
      </div>

      {/* Controls */}
      <div className="d-flex align-items-center" style={{ gap: '8px' }}>
        {/* Edit Parameters Button */}
        <OverlayTrigger
          placement="top"
          overlay={<Tooltip>Edit Parameters</Tooltip>}
        >
          <Button
            size="sm"
            variant="outline-primary"
            onClick={onEdit}
          >
            <FaCog size={12} />
          </Button>
        </OverlayTrigger>

        {/* Enabled/Bypass Toggle */}
        <OverlayTrigger
          placement="top"
          overlay={<Tooltip>{effect.enabled ? 'Bypass' : 'Enable'}</Tooltip>}
        >
          <Button
            size="sm"
            variant={effect.enabled ? 'success' : 'outline-secondary'}
            onClick={onToggle}
          >
            <FaPowerOff size={12} />
          </Button>
        </OverlayTrigger>

        {/* Move Up/Down */}
        <Dropdown>
          <Dropdown.Toggle variant="outline-secondary" size="sm">
            <FaEllipsisV />
          </Dropdown.Toggle>
          <Dropdown.Menu className="bg-dark">
            <Dropdown.Item
              className="text-white"
              onClick={onMoveUp}
              disabled={!canMoveUp}
            >
              Move Up
            </Dropdown.Item>
            <Dropdown.Item
              className="text-white"
              onClick={onMoveDown}
              disabled={!canMoveDown}
            >
              Move Down
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item
              className="text-danger"
              onClick={onRemove}
            >
              Remove
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </ListGroup.Item>
  );
}

/**
 * Main Clip Effects Rack Component (Modal)
 */
export default function ClipEffectsRack({ show, onHide, selectedClipId }) {
  const { tracks, updateTrack } = useMultitrack();
  const [showEffectsBrowser, setShowEffectsBrowser] = useState(false);
  const [showEffectParameters, setShowEffectParameters] = useState(false);
  const [selectedEffect, setSelectedEffect] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Find the selected clip
  const selectedClip = tracks
    .flatMap(track => (track.clips || []).map(clip => ({ ...clip, trackId: track.id, trackType: track.type })))
    .find(clip => clip.id === selectedClipId);

  const selectedTrack = tracks.find(track => track.id === selectedClip?.trackId);

  const effects = selectedClip?.effects || [];
  const isMidiClip = selectedClip?.trackType === 'midi';

  // Effect Management Handlers
  const handleAddEffect = useCallback((effectType) => {
    const updatedClip = addEffectToClip(selectedClip, effectType);
    updateTrack(selectedClip.trackId, {
      clips: selectedTrack.clips.map(c => c.id === selectedClipId ? updatedClip : c)
    });
  }, [selectedClip, selectedClipId, selectedTrack, updateTrack]);

  const handleRemoveEffect = useCallback((effectId) => {
    const updatedClip = removeEffectFromClip(selectedClip, effectId);
    updateTrack(selectedClip.trackId, {
      clips: selectedTrack.clips.map(c => c.id === selectedClipId ? updatedClip : c)
    });
  }, [selectedClip, selectedClipId, selectedTrack, updateTrack]);

  const handleToggleEffect = useCallback((effectId) => {
    const updatedClip = toggleEffectEnabled(selectedClip, effectId);
    updateTrack(selectedClip.trackId, {
      clips: selectedTrack.clips.map(c => c.id === selectedClipId ? updatedClip : c)
    });
  }, [selectedClip, selectedClipId, selectedTrack, updateTrack]);

  const handleReorderEffect = useCallback((effectId, direction) => {
    const effectIndex = effects.findIndex(e => e.id === effectId);
    const targetIndex = direction === 'up' ? effectIndex - 1 : effectIndex + 1;

    if (targetIndex < 0 || targetIndex >= effects.length) return;

    const updatedClip = reorderEffects(selectedClip, effectIndex, targetIndex);
    updateTrack(selectedClip.trackId, {
      clips: selectedTrack.clips.map(c => c.id === selectedClipId ? updatedClip : c)
    });
  }, [selectedClip, selectedClipId, selectedTrack, updateTrack, effects]);

  const handleClearAll = useCallback(() => {
    if (!confirm('Remove all effects from this clip?')) return;

    const updatedClip = clearAllEffects(selectedClip);
    updateTrack(selectedClip.trackId, {
      clips: selectedTrack.clips.map(c => c.id === selectedClipId ? updatedClip : c)
    });
  }, [selectedClip, selectedClipId, selectedTrack, updateTrack]);

  const handleApplyPreset = useCallback((presetName) => {
    const updatedClip = applyEffectChainPreset(selectedClip, presetName);
    updateTrack(selectedClip.trackId, {
      clips: selectedTrack.clips.map(c => c.id === selectedClipId ? updatedClip : c)
    });
  }, [selectedClip, selectedClipId, selectedTrack, updateTrack]);

  // Open effect parameters modal
  const handleEditEffect = useCallback((effect) => {
    setSelectedEffect(effect);
    setShowEffectParameters(true);
  }, []);

  // Apply effects to clip audio
  const handleApplyEffects = useCallback(async () => {
    if (!selectedClip || !selectedTrack || effects.length === 0) {
      return;
    }

    if (!selectedClip.src) {
      setError('Clip has no audio source');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);
    setProgress(0);

    try {
      setProgress(10);

      // Load the clip's audio buffer using the existing decodeAudioFromURL function
      const audioBuffer = await decodeAudioFromURL(selectedClip.src);

      if (!audioBuffer) {
        throw new Error('Failed to decode audio from clip');
      }

      setProgress(40);

      // Create audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Process with effects chain
      const processedBuffer = await processClipWithEffects(audioBuffer, selectedClip, audioContext);

      setProgress(70);

      // Convert to WAV blob
      const wav = audioBufferToWav(processedBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      setProgress(90);

      // Update clip with new audio source
      const updatedClip = {
        ...selectedClip,
        src: url,
        // Keep the effects chain for future reference
      };

      updateTrack(selectedTrack.id, {
        clips: selectedTrack.clips.map(c => c.id === selectedClipId ? updatedClip : c)
      });

      setProgress(100);
      setSuccess(`Effects applied successfully! (${effects.filter(e => e.enabled).length} effects processed)`);

      // Reset after delay
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
        setSuccess(null);
      }, 2000);

    } catch (err) {
      console.error('Error applying effects:', err);
      setError(err.message || 'Failed to apply effects');
      setIsProcessing(false);
      setProgress(0);
    }
  }, [selectedClip, selectedTrack, effects, selectedClipId, updateTrack]);

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="bg-dark text-white border-secondary">
        <Modal.Title>
          Clip Effects
          {selectedClip && (
            <>
              <span className="text-muted ms-2">—</span>
              <span className="text-muted ms-2">{selectedClip.name || 'Unnamed Clip'}</span>
              {effects.length > 0 && (
                <Badge bg="success" className="ms-2">{effects.length}</Badge>
              )}
            </>
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="bg-dark text-white" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Error/Success Messages */}
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-3">
            {error}
          </Alert>
        )}
        {success && (
          <Alert variant="success" className="mb-3">
            {success}
          </Alert>
        )}

        {/* MIDI Clip Message */}
        {isMidiClip && (
          <div className="text-center py-5">
            <p className="text-muted mb-0">Effects are not available for MIDI tracks</p>
            <small className="text-muted">Convert to audio or use virtual instrument effects</small>
          </div>
        )}

        {/* No Clip Selected */}
        {!selectedClip && (
          <div className="text-center py-5">
            <p className="text-muted mb-0">Select an audio clip to apply effects</p>
          </div>
        )}

        {/* Effects Controls */}
        {selectedClip && !isMidiClip && (
          <>
            {/* Action Buttons */}
            <div className="d-flex justify-content-between mb-3">
              <PresetsDropdown onApplyPreset={handleApplyPreset} />
              <div className="d-flex" style={{ gap: '8px' }}>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setShowEffectsBrowser(true)}
                  disabled={isProcessing}
                >
                  <FaPlus className="me-1" /> Add Effect
                </Button>
                {effects.length > 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="success"
                      onClick={handleApplyEffects}
                      disabled={isProcessing || effects.filter(e => e.enabled).length === 0}
                    >
                      <FaCheck className="me-1" /> Apply Effects
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={handleClearAll}
                      disabled={isProcessing}
                    >
                      Clear All
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Processing Progress */}
            {isProcessing && (
              <ProgressBar
                now={progress}
                label={`${Math.round(progress)}%`}
                animated
                striped
                className="mb-3"
              />
            )}

            {/* Effects Chain */}
            {effects.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted mb-3">No effects on this clip</p>
                <Button
                  variant="primary"
                  onClick={() => setShowEffectsBrowser(true)}
                >
                  <FaPlus className="me-2" />
                  Add Your First Effect
                </Button>
              </div>
            ) : (
              <>
                <ListGroup variant="flush">
                  {effects.map((effect, index) => (
                    <EffectChainItem
                      key={effect.id}
                      effect={effect}
                      onRemove={() => handleRemoveEffect(effect.id)}
                      onToggle={() => handleToggleEffect(effect.id)}
                      onEdit={() => handleEditEffect(effect)}
                      onMoveUp={() => handleReorderEffect(effect.id, 'up')}
                      onMoveDown={() => handleReorderEffect(effect.id, 'down')}
                      canMoveUp={index > 0}
                      canMoveDown={index < effects.length - 1}
                    />
                  ))}
                </ListGroup>

                {/* Signal Flow Indicator */}
                {effects.length > 1 && (
                  <div className="mt-3 text-center text-muted small">
                    <span>Signal Flow: Top → Bottom</span>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Modal.Body>

      {/* Effects Browser Modal */}
      <EffectsBrowserModal
        show={showEffectsBrowser}
        onHide={() => setShowEffectsBrowser(false)}
        onSelectEffect={handleAddEffect}
      />

      {/* Effect Parameters Modal */}
      {selectedEffect && (
        <ClipEffectParametersModal
          show={showEffectParameters}
          onHide={() => {
            setShowEffectParameters(false);
            setSelectedEffect(null);
          }}
          clipId={selectedClipId}
          effectId={selectedEffect.id}
          effectType={selectedEffect.type}
          currentParameters={selectedEffect.parameters}
        />
      )}
    </Modal>
  );
}
