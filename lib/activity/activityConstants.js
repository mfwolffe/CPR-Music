/**
 * Activity Constants for DAW Study Protocol
 *
 * Defines operation types and required completions for each study activity step
 */

// Operation types for tracking (matching backend event types)
export const OPERATION_TYPES = {
  // Activity 1: Selections and Removal
  REGION_SELECTED: 'region_created',
  REGION_DESELECTED: 'region_deselected',
  REGION_DELETED: 'clip_delete',  // Reusing existing event
  UNDO_PERFORMED: 'undo_action',
  REDO_PERFORMED: 'redo_action',
  SILENCE_TRIMMED_START: 'silence_trimmed_start',
  SILENCE_TRIMMED_END: 'silence_trimmed_end',

  // Activity 2: Selections and Retaining
  AUDIO_RESTORED: 'audio_restored',
  SCISSOR_USED: 'clip_cut',  // Reusing existing event
  REGION_RETAINED: 'region_retained',

  // Activity 3: EQ & Mixes
  AUDIO_TRACK_ADDED: 'track_added',
  RECORDING_PERFORMED: 'recording_completed',
  CLIP_DRAGGED: 'clip_move',
  CLIP_COPIED: 'clip_copy',
  CLIP_PASTED: 'clip_paste',
  CLIPS_DELETED: 'clip_delete',
  TAKES_IMPORTED: 'takes_imported',
  MIXDOWN_CREATED: 'mixdown_created',
  SOLO_USED: 'mixing_solo',
  EFFECTS_RACK_TOGGLED: 'effects_rack_toggled',
  EQ_LOADED: 'effect_applied',  // When effectType is 'equalizer'
  EQ_PRESET_APPLIED: 'eq_preset_applied',

  // Activity 4: Effects Playground
  EFFECT_EXPERIMENTED: 'effect_applied',
};

// Required operations for each activity step
export const ACTIVITY_REQUIREMENTS = {
  1: {
    name: 'Selections and Removal',
    required: [
      OPERATION_TYPES.REGION_SELECTED,
      OPERATION_TYPES.REGION_DESELECTED,
      OPERATION_TYPES.REGION_DELETED,
      OPERATION_TYPES.UNDO_PERFORMED,
      OPERATION_TYPES.REDO_PERFORMED,
      OPERATION_TYPES.SILENCE_TRIMMED_START,
      OPERATION_TYPES.SILENCE_TRIMMED_END,
    ],
    minRequired: 7  // Must complete all
  },
  2: {
    name: 'Selections and Retaining',
    required: [
      OPERATION_TYPES.AUDIO_RESTORED,
      OPERATION_TYPES.REGION_SELECTED,
      OPERATION_TYPES.SCISSOR_USED,
      OPERATION_TYPES.REGION_RETAINED,
    ],
    minRequired: 4  // Must complete all
  },
  3: {
    name: 'EQ & Mixes',
    required: [
      OPERATION_TYPES.AUDIO_TRACK_ADDED,
      OPERATION_TYPES.RECORDING_PERFORMED,
      OPERATION_TYPES.CLIP_DRAGGED,
      OPERATION_TYPES.CLIP_COPIED,
      OPERATION_TYPES.CLIP_PASTED,
      OPERATION_TYPES.CLIPS_DELETED,
      OPERATION_TYPES.TAKES_IMPORTED,
      OPERATION_TYPES.MIXDOWN_CREATED,
      OPERATION_TYPES.SOLO_USED,
      OPERATION_TYPES.EFFECTS_RACK_TOGGLED,
      OPERATION_TYPES.EQ_LOADED,
      OPERATION_TYPES.EQ_PRESET_APPLIED,
    ],
    minRequired: 12  // Must complete all
  },
  4: {
    name: 'Effects Playground',
    required: [
      OPERATION_TYPES.EFFECT_EXPERIMENTED,
    ],
    minRequired: 1  // At least try one effect
  }
};

// Question IDs for each activity
export const ACTIVITY_QUESTIONS = {
  1: {
    Q1: 'waveform_correspondence',
    Q2: 'canvas_sound_comparison',
    Q3: 'waveform_change_observation',
    Q4: 'deletion_improvement',
  },
  2: {
    Q1: 'operation_efficiency',
    Q2: 'user_time_comparison',
    Q3: 'user_ease_comparison',
    Q4: 'result_similarity',
  },
  3: {
    Q1: 'countdown_behavior',
    Q2: 'playhead_gap_prediction',
    Q3: 'mixdown_understanding',
    Q4: 'frequency_graph_relation',
    Q5: 'eq_sound_change',
  },
  4: {
    Q1: 'when_to_use_daw',
    Q2: 'band_orchestra_usage',
    Q3: 'personal_music_usage',
    Q4: 'other_usage',
  }
};

// Helper to check if an activity step is complete
export function isStepComplete(stepNumber, completedOperations) {
  const requirements = ACTIVITY_REQUIREMENTS[stepNumber];
  if (!requirements) return false;

  const stepKey = String(stepNumber);
  const completed = completedOperations[stepKey] || [];

  // Count how many required operations have been completed
  const completedCount = requirements.required.filter(op =>
    completed.includes(op)
  ).length;

  return completedCount >= requirements.minRequired;
}

// Helper to get progress percentage for a step
export function getStepProgress(stepNumber, completedOperations) {
  const requirements = ACTIVITY_REQUIREMENTS[stepNumber];
  if (!requirements) return 0;

  const stepKey = String(stepNumber);
  const completed = completedOperations[stepKey] || [];

  const completedCount = requirements.required.filter(op =>
    completed.includes(op)
  ).length;

  return Math.round((completedCount / requirements.minRequired) * 100);
}

// Helper to get missing operations for a step
export function getMissingOperations(stepNumber, completedOperations) {
  const requirements = ACTIVITY_REQUIREMENTS[stepNumber];
  if (!requirements) return [];

  const stepKey = String(stepNumber);
  const completed = completedOperations[stepKey] || [];

  return requirements.required.filter(op => !completed.includes(op));
}
