/**
 * useActivityProgress Hook
 *
 * Manages activity progress state for DAW study protocol.
 * Integrates with DAWActivityLogger and backend API.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getDAWActivityLogger } from '../lib/activity/DAWActivityLogger';
import {
  getActivityProgress,
  mutateLogActivityEvent,
  mutateSubmitActivityStep,
  mutateSaveQuestionResponse,
} from '../api';
import {
  isStepComplete,
  getStepProgress,
  getMissingOperations,
  ACTIVITY_REQUIREMENTS,
} from '../lib/activity/activityConstants';

export function useActivityProgress({ slug, assignmentId, initialStep = 1, email = null }) {
  // Progress state
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [stepCompletions, setStepCompletions] = useState({});
  const [activityLogs, setActivityLogs] = useState([]);
  const [questionResponses, setQuestionResponses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track if we've loaded initial progress
  const hasLoadedProgress = useRef(false);

  // Store email in ref to avoid re-renders
  const emailRef = useRef(email);

  // Get logger instance
  const logger = getDAWActivityLogger();

  // Sync currentStep when initialStep changes (fixes NaN issue on first render)
  useEffect(() => {
    if (!isNaN(initialStep) && initialStep !== currentStep) {
      console.log('🔄 Syncing currentStep with initialStep:', initialStep);
      setCurrentStep(initialStep);
    }
  }, [initialStep, currentStep]);

  // Load progress from backend on mount
  useEffect(() => {
    if (!slug || !assignmentId || hasLoadedProgress.current) return;

    const loadProgress = async () => {
      try {
        const progress = await getActivityProgress({ slug, assignmentId });

        if (progress) {
          setCurrentStep(progress.current_step);
          setStepCompletions(progress.step_completions);
          setActivityLogs(progress.activity_logs || []);
          setQuestionResponses(progress.question_responses);
        }

        hasLoadedProgress.current = true;
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load activity progress:', error);
        setIsLoading(false);
      }
    };

    loadProgress();
  }, [slug, assignmentId]);

  // Log operation and update local state
  const logOperation = useCallback(async (operation, data = {}) => {
    console.log('📝 useActivityProgress.logOperation called:', { operation, data, slug, assignmentId, currentStep });

    if (!slug || !assignmentId) {
      console.warn('⚠️ Cannot log operation - missing slug or assignmentId:', { slug, assignmentId });
      return;
    }

    try {
      // Log to backend
      console.log('📡 Sending operation to backend:', operation);
      const logEvent = mutateLogActivityEvent({ slug, assignmentId });
      const updatedProgress = await logEvent({
        operation,
        step: currentStep,
        data,
        email: emailRef.current, // Include email from Qualtrics
      });

      console.log('✅ Backend responded with updated progress:', updatedProgress?.step_completions);

      // Also log to DAW logger for local analytics
      logger.logEvent(operation, data);

      // Update local state with server response
      if (updatedProgress) {
        setStepCompletions(updatedProgress.step_completions);
        setActivityLogs(updatedProgress.activity_logs || []);
      }

      return updatedProgress;
    } catch (error) {
      console.error('❌ Failed to log operation:', error);
      throw error;
    }
  }, [slug, assignmentId, currentStep, logger]);

  // Save question response
  const saveResponse = useCallback(async (questionId, response) => {
    if (!slug || !assignmentId) return;

    try {
      const saveResponseFn = mutateSaveQuestionResponse({ slug, assignmentId });
      const updatedProgress = await saveResponseFn({ questionId, response });

      // Update local state
      setQuestionResponses(prev => ({
        ...prev,
        [questionId]: response,
      }));

      return updatedProgress;
    } catch (error) {
      console.error('Failed to save response:', error);
      throw error;
    }
  }, [slug, assignmentId]);

  // Submit current step and advance
  const submitStep = useCallback(async (responses = {}) => {
    if (!slug || !assignmentId) return;

    setIsSubmitting(true);

    try {
      const submitFn = mutateSubmitActivityStep({ slug, assignmentId });
      const updatedProgress = await submitFn({
        questionResponses: {
          ...questionResponses,
          ...responses,
        },
      });

      // Update local state
      setCurrentStep(updatedProgress.current_step);
      setStepCompletions(updatedProgress.step_completions);
      setActivityLogs(updatedProgress.activity_logs || []);
      setQuestionResponses(updatedProgress.question_responses);

      setIsSubmitting(false);
      return updatedProgress;
    } catch (error) {
      console.error('Failed to submit step:', error);
      setIsSubmitting(false);
      throw error;
    }
  }, [slug, assignmentId, questionResponses]);

  // Check if current step can be submitted
  const canSubmit = useCallback(() => {
    return isStepComplete(currentStep, stepCompletions, activityLogs);
  }, [currentStep, stepCompletions, activityLogs]);

  // Get progress percentage for current step
  const progress = useCallback(() => {
    return getStepProgress(currentStep, stepCompletions, activityLogs);
  }, [currentStep, stepCompletions, activityLogs]);

  // Get missing operations for current step
  const missingOperations = useCallback(() => {
    return getMissingOperations(currentStep, stepCompletions, activityLogs);
  }, [currentStep, stepCompletions, activityLogs]);

  // Get step requirements
  const requirements = ACTIVITY_REQUIREMENTS[currentStep] || { required: [] };

  return {
    // State
    currentStep,
    stepCompletions,
    questionResponses,
    isLoading,
    isSubmitting,

    // Computed
    canSubmit: canSubmit(),
    progress: progress(),
    missingOperations: missingOperations(),
    requirements,

    // Methods
    logOperation,
    saveResponse,
    submitStep,
  };
}

export default useActivityProgress;
