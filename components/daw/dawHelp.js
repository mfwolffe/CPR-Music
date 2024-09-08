'use client';

import * as React from 'react';
import { Accordion, Container, Row, Col } from 'react-bootstrap';

import { MdGroups } from 'react-icons/md';
import { IoArrowUndo } from 'react-icons/io5';
import { IoArrowRedo } from 'react-icons/io5';
import { IoCutOutline } from 'react-icons/io5';
import { MdOutlineWaves } from 'react-icons/md';
import { RiEqualizerLine } from 'react-icons/ri';
import { IoTrashOutline } from 'react-icons/io5';
import { RiSoundModuleFill } from 'react-icons/ri';
import { BsSpeedometer2 } from 'react-icons/bs';
import { FaRegCirclePlay } from 'react-icons/fa6';
import { FaRegCirclePause } from 'react-icons/fa6';
import { FaArrowRotateLeft } from 'react-icons/fa6';
import { FaArrowRotateRight } from 'react-icons/fa6';
import { BsSkipBackwardCircle } from 'react-icons/bs';

import { BsZoomIn } from 'react-icons/bs';
import { BsZoomOut } from 'react-icons/bs';
import { TbZoomReset } from 'react-icons/tb';

export default function HelpAccordion() {
  return (
    <Accordion defaultActiveKey="0">
      <Accordion.Item eventKey="0">
        <Accordion.Header>What is a DAW?</Accordion.Header>
        <Accordion.Body>
          A DAW, which stands for "digital audio workstation", is a software program or electronic device that allows you to edit and produce audio files.
          Traditionally, DAWs are made up of four fundamental parts: a computer, an audio interface, audio editing software, and input devices.
          When compared to commercial DAWs, the MusicCPR DAW is quite rudimentary, but can still perform a number of the most common DAW functions. 
        </Accordion.Body>
      </Accordion.Item>
      <Accordion.Item eventKey="1">
        <Accordion.Header>Icons</Accordion.Header>
        <Accordion.Body>
          <Container >
              <Row className='mb-2'>
              <Col lg={1}><MdOutlineWaves fontSize="1.6rem" /></Col>
                <Col>Hides/shows minimap waveform; most useful when zooming in on segments of the larger waveform</Col>
              </Row>
              <Row className='mb-2'>
                <Col lg={1}><RiEqualizerLine fontSize="1.6rem" /></Col>
              <Col>
                Hides/shows equalizer widget. This widget allows you to make specific frequencies louder or quieter relative to other frequencies in your recording.
              </Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><RiSoundModuleFill fontSize="1.6rem" /></Col>
              <Col>Hides/shows a widget for adding echo effects such as delay, decay, and input/output gain.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><MdGroups fontSize="1.6rem" /></Col>
              <Col>Hides/shows a widget for adding chorus effects; includes all parameters available to the echo effect widget in addition to speed and depth.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><IoCutOutline fontSize="1.6rem" /></Col>
              <Col>Deletes all audio other than a user highlighted region.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><IoTrashOutline fontSize="1.6rem" /></Col>
              <Col>Deletes all audio within a user highlighted region.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><IoArrowUndo fontSize="1.6rem" /></Col>
              <Col>Undo last action.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><IoArrowRedo fontSize="1.6rem" /></Col>
              <Col>Redo last action.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><FaArrowRotateLeft fontSize="1.6rem" /></Col>
              <Col>Skip playback cursor back ten seconds.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><BsSkipBackwardCircle fontSize="1.6rem" /></Col>
              <Col>Move playback cursor to 00:00.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><FaRegCirclePlay fontSize="1.6rem" /></Col>
              <Col>Play audio file</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><FaRegCirclePause fontSize="1.6rem" /></Col>
              <Col>Pause audio file.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><FaArrowRotateRight fontSize="1.6rem" /></Col>
              <Col>Skip playback cursor forward ten seconds.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><BsZoomIn fontSize="1.6rem" /></Col>
              <Col>Zoom in on waveform.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><BsZoomOut fontSize="1.6rem" /></Col>
              <Col>Zoom out on waveform.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><TbZoomReset fontSize="1.6rem" /></Col>
              <Col>Reset zoom levels to default.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><BsSpeedometer2 fontSize="1.6rem" /></Col>
              <Col>Adjust playback speed</Col>
            </Row>
          </Container>
        </Accordion.Body>
      </Accordion.Item>
      <Accordion.Item eventKey="2">
        <Accordion.Header>Glossary</Accordion.Header>
        <Accordion.Body>
          <dl>
            <dt>Amplitude</dt>
            <dd>
              Put simply, the loudness of a sound.
              Measured in decibels (dB), a larger number of decibels corresponds to louder sounds.
            </dd>


            <dt>Chorus</dt>
            <dd>
              Splits an audio sample into wet and dry signals, then modifies the wet signal so that when remixed with the dry signal, gives an illusion of multiple instruments/voices.
            </dd>

            <dt>Decay</dt>
            <dd>
              The time it takes for an audio signal to drop to a specified amplitude from full volume.
            </dd>

            <dt>Delay</dt>
            <dd>A time-based effect that replays an original audio signal at set intervals to create an echo-like effect.</dd>

            <dt>Depth</dt>
            <dd>
              The amplitude of pitch modulation within a chorus effect. The higher the depth, the more pitches deviate, leading to a more noticeable chorus effect.
            </dd>

            <dt>Equalization</dt>
            <dd>
              (EQ) is the process of modifying the volume of specific frequency bands within an audio sample.
              It can be used to amplify sound, eliminate unwanted sounds or make others more prominent, alter instrument timbre, correct recording hardware shortcomings, and more.
            </dd>

            <dt>Frequency</dt>
            <dd>
              Put simply, the pitch of a sound, i.e., how high or low a sound is.
              Measured in the SI unit of Hz and its metric prefixes, a larger number corresponds to higher pitched sounds.
            </dd>

            <dt>Gain</dt>
            <dd>
              The amount of a given audio signal that has been increased by an amplifier.
              Unlike changing <em>volume</em>, changing gain alters the tone of a sound.
            </dd>

            <dt>Gain Envelope</dt>
            <dd>
              A line overlayed on a waveform whose relative height corresponds to sound amplitudes.
              Users can often add keyframes/nodes and drag them up and down to change the amplitude at that time position.
              The higher a keyframe/node, the louder the sound at that keyframe's position.
            </dd>

            <dt>Speed</dt>
            <dd>The rate of pitch modulation in a chorus effect. The higher the speed, the faster the modulation, and the more chorus-like a signal will sound.</dd>

            <dt>Timbre</dt>
            <dd>
              The unique, perceived quality of a sound or tone.
              When a saxophone and clarinet play the same sequence of pitches, it is the timbre of each instrument that allows us to distinguish their sounds by ear.
            </dd>

            <dt>Volume</dt>
            <dd>
              The loudness of a sound. Unlike gain, changing volume only changes the loudness of a sound sample and has no impact on tone.
            </dd>

            <dt>Waveform</dt>
            <dd>
              A type of graph which describes a sound wave.
              The horizontal axis most often represents elapsed time.
              The vertical axis represents displacement of molecules by a source of sound; this is distinguishable to humans as volume, or how loud we perceive a sound.
            </dd>
          </dl>
        </Accordion.Body>
      </Accordion.Item>
      <Accordion.Item eventKey="3">
        <Accordion.Header>Other Features</Accordion.Header>
        <Accordion.Body>
          <dl>
            <dt>Highlighting/Selecting an Audio Segment</dt>
            <dd>
              To highlight a region so that you can make edits to only a specific segment of your recording,
              click the waveform with your mouse, hold the mouse button, and drag the mouse to the left or right.
            </dd>
            <dt>Deselecting an Audio Segment</dt>
            <dd>
              By default, creating a new segment is locked when a region currently exists on the waveform.
              To deselect a segment and allow creation of a new highlighted region, hover your mouse over your highlighted region
              and double click it.
            </dd>
            <dt>Moving a Highlighted Segment</dt>
            <dd>
              To move a highlighted segment to a different location on the waveform, simply click and drag to the left or right.
            </dd>
            <dt>Resizing a Highlighted Segment</dt>
            <dd>
              To resize a highlighted audio segment, hover your mouse over the left or right edge of the region
              until you see the shape of the mouse cursor change to a double-sided arrow
              (Region endpoints have a different color to assist in this task).
              Once changed, click and drag to extend or shrink your highlighted region.
            </dd>
          </dl>
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  );
}

