'use client';

import { useRef, useEffect, useState } from 'react';
import styles from './Knob.module.css';

/**
 * Custom rotary knob component for audio controls
 */
export default function Knob({ 
  value = 0, 
  min = 0, 
  max = 1, 
  step = 0.01,
  onChange,
  label = '',
  displayValue,
  size = 50,
  color = '#7bafd4'
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  const knobRef = useRef(null);
  const startY = useRef(0);
  const startValue = useRef(0);
  
  useEffect(() => {
    setInternalValue(value);
  }, [value]);
  
  // Convert value to rotation angle (0-270 degrees)
  const valueToAngle = (val) => {
    const normalized = (val - min) / (max - min);
    return normalized * 270 - 135; // -135 to 135 degrees
  };
  
  // Convert Y movement to value change
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const deltaY = startY.current - e.clientY;
    const sensitivity = (max - min) / 100;
    const newValue = startValue.current + (deltaY * sensitivity);
    const clampedValue = Math.max(min, Math.min(max, newValue));
    const steppedValue = Math.round(clampedValue / step) * step;
    
    setInternalValue(steppedValue);
    onChange && onChange(steppedValue);
  };
  
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = internalValue;
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);
  
  const rotation = valueToAngle(internalValue);
  const displayText = displayValue || internalValue.toFixed(2);
  
  return (
    <div className="text-center">
      <div 
        ref={knobRef}
        className={styles.knobContainer}
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
      >
        <svg 
          width={size} 
          height={size} 
          viewBox="0 0 100 100"
          className={styles.knobSvg}
        >
          {/* Outer ring */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#444"
            strokeWidth="2"
          />
          
          {/* Track */}
          <path
            d="M 20 80 A 35 35 0 1 1 80 80"
            fill="none"
            stroke="#666"
            strokeWidth="8"
            strokeLinecap="round"
          />
          
          {/* Value arc */}
          <path
            d="M 20 80 A 35 35 0 1 1 80 80"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${((internalValue - min) / (max - min)) * 188} 188`}
            className={styles.valueArc}
          />
          
          {/* Knob body */}
          <circle
            cx="50"
            cy="50"
            r="30"
            fill="#2a2a2a"
            stroke="#555"
            strokeWidth="1"
          />
          
          {/* Pointer */}
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="25"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            transform={`rotate(${rotation} 50 50)`}
          />
          
          {/* Center dot */}
          <circle
            cx="50"
            cy="50"
            r="5"
            fill="#444"
          />
        </svg>
      </div>
      
      <div className="mt-1">
        <small className="text-white d-block">{label}</small>
        <small className="text-muted">{displayText}</small>
      </div>
    </div>
  );
}