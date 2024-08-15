import { fetchFile, toBlobURL } from '@ffmpeg/util';

const isNumber = (str) => Number.isFinite(+str);
const ORIGURL = '/sample_audio/uncso-bruckner4-1.mp3';

const formatTime = (seconds) =>
  [seconds / 60, seconds % 60]
    .map((v) => `0${Math.floor(v)}`.slice(-2))
    .join(':');

const formatTimeMilli = (seconds) => {
  const M = Math.floor(seconds / 60);
  seconds %= 60;
  const s = Math.floor(seconds);
  const m = Math.floor((seconds - s) * 1000);

  return `${('00' + M).slice(-2)}:${('00' + s).slice(-2)}:${('000' + m).slice(
    -3
  )}`;
};

const setupAudioContext = () => {
  const audio = new Audio();
  audio.controls = false;
  audio.src = '/sample_audio/uncso-bruckner4-1.mp3';

  const audioContext = new AudioContext();
  const eqBands = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

  const filters = eqBands.map((band) => {
    const filter = audioContext.createBiquadFilter();
    filter.type =
      band <= 32 ? 'lowshelf' : band >= 16000 ? 'highshelf' : 'peaking';
    filter.gain.value = 0;
    filter.Q.value = 1; // resonance
    filter.frequency.value = band; // cut-off frequency
    return filter;
  });

  audio.addEventListener(
    'canplay',
    () => {
      const mediaNode = audioContext.createMediaElementSource(audio);

      const equalizer = filters.reduce((prev, curr) => {
        prev.connect(curr);
        return curr;
      }, mediaNode);
      equalizer.connect(audioContext.destination);
    },
    { once: true }
  );

  console.log('audio context established');

  return {
    audio: audio,
    audioContext: audioContext,
    filters: filters,
  };
};

/**
 * initializes ffmpeg reference for work
 *
 * @param {*} ffmpegRef ffmpeg instance
 * @param {*} setLoaded function to signal loading complete
 * @param {*} setIsLoading function to signal loading started
 */
const loadFfmpeg = async (ffmpegRef, setLoaded, setIsLoading) => {
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  const ffmpeg = ffmpegRef.current;

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    // TODO @mfwolffe workerURL?
  });

  setLoaded(true);
  setIsLoading(false);
  console.log('loaded');
};

function validateCutoff(cutoff) {
  if (isNumber(cutoff) && 1 - Math.abs(cutoff) > 0) return true;
  if (typeof cutoff === 'string') {
    const rexp = /-\d{2}dB/;
    const regex = new RegExp(rexp);

    if (regex.test(cutoff)) return true;
  }
  return false;
}

function processLog(log) {
  const chkLst = (lst) => {
    if (lst.length !== 1)
      throw new Error('Unexpected token in log. See FFmpeg logs.');
  };
  const chkTimeStamp = (time) => {
    if (Number.isNaN(time))
      throw new Error('Unexpected token in log. See FFmpeg logs.');
  };
  const tokenizeLog = (rexp, log) => log.match(rexp);
  const extractTimeStamp = (str) => Number(str.replaceAll(/[^0-9.]/gi, ''));

  let tokenList = tokenizeLog(/silence_end: \d*\.?[0-9]*/, log);
  chkLst(tokenList);
  const end = extractTimeStamp(tokenList[0]);
  chkTimeStamp(end);

  tokenList = tokenizeLog(/silence_duration: \d*\.?[0-9]*/, log);
  chkLst(tokenList);
  const duration = extractTimeStamp(tokenList[0]);
  chkTimeStamp(duration);

  const start = end - duration;

  return {
    startTime: start,
    endTime: end,
    duration: duration,
  };
}

/**
 * detects dropped audio in a submission mp3 with specified tolerances,
 * optionally processing input channels separately
 *
 * @param {*} ffmpegRef ffmpeg reference
 * @param {*} mono process in separate channels?
 * @param {*} submissionFile student file to process pre-submit
 * @param {*} duration length of time (seconds) of continuous silence to flag the file
 * @param {*} cutoff volume at which to flag file; can be represented in dB (as string)
 *                   or as ratio relative to max amplitude, e.g., '-40dB' or 0.001
 */
async function catchSilence(
  ffmpegRef,
  submissionFile,
  cutoff,
  duration = 2,
  mono = null
) {
  if (
    !validateCutoff(cutoff) ||
    !ffmpegRef ||
    !isNumber(duration) ||
    !submissionFile
  )
    throw new Error(
      'Parameter must be an amplitude ratio (0 < n < 1) or decibel string, e.g., "-40dB")'
    );

  const droppedRegions = [];
  const ffmpeg = ffmpegRef.current;

  // argument string for the -af flag
  const filterGraphStr = `silencedetect=n=${cutoff}:d=${duration}${
    mono ? `:m=true` : ''
  }`;

  ffmpeg.on('log', ({ type, message }) => {
    console.log(message);
    if (message.search(/silence_end: \d*\.?[0-9]*/) !== -1) {
      droppedRegions.push(processLog(message));
    }
  });

  // args for ffmpeg exec
  const args = ['-i', 'input.mp3', '-af', filterGraphStr, '-f', 'null', '-'];

  try {
    await ffmpeg.writeFile('input.mp3', await fetchFile(submissionFile));
  } catch (e) {
    console.error('Failure to fetch/write ffmpeg input file: ', e);
    return;
  }

  try {
    console.log(`EXECUTING::ffmpeg ${args.join(' ')}`);
    await ffmpeg.exec(args);
  } catch (e) {
    console.error('Command failed to execute: ', e);
  }

  console.log('scan completed');

  return {
    silences: droppedRegions,
    numSilences: droppedRegions.length,
    silenceFlag: droppedRegions.length > 0,
  };
}

export {
  catchSilence,
  formatTime,
  formatTimeMilli,
  loadFfmpeg,
  setupAudioContext,
};
