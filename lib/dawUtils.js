import { fetchFile, toBlobURL } from '@ffmpeg/util';

const formatTime = (seconds) =>
  [seconds / 60, seconds % 60]
    .map((v) => `0${Math.floor(v)}`.slice(-2))
    .join(':');

const restoreState = (index, editList, setIndex, wavesurfer) => {
  if (index < 0 || index >= editList.length) return;

  console.log('current list', editList);
  console.log('restoring to index', index);
  wavesurfer.load(editList[index]);
  setIndex(index);
};

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
  // audio.src = url;

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

  console.log('audio context established', filters);

  return {
    audio: audio,
    audioContext: audioContext,
    filters: filters,
  };
};

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

const effectSliceRegions = async (
  region,
  ffmpegRef,
  setAudioURL,
  wavesurfer,
  setEditList,
  editList,
  setEditListIndex,
  editListIndex,
  audioRef,
  audioURL,
  keep
) => {
  if (!region) {
    console.log('bad region');
    return;
  }
  const end = region.end;
  const start = region.start;
  const duration = end - start;
  const ffmpeg = ffmpegRef.current;

  const destroyParams = [
    '-i',
    'input.mp3',
    '-filter_complex',
    `[0]atrim=duration=${start}[a];[0]atrim=start=${end}[b];[a][b]concat=n=2:v=0:a=1`,
    'output.mp3',
  ];

  const keepParams = [
    '-ss',
    `${start}`,
    '-i',
    'input.mp3',
    '-t',
    `${duration}`,
    'output.mp3',
  ];

  await ffmpeg.writeFile('input.mp3', await fetchFile(audioURL));
  await ffmpeg.exec(keep ? keepParams : destroyParams);

  const data = await ffmpeg.readFile('output.mp3');
  if (audioRef.current) {
    audioRef.current.src = URL.createObjectURL(
      new Blob([data.buffer], { type: 'audio/mp3' })
    );
  }

  setAudioURL(audioRef.current.src);
  console.log('transcode done', audioRef.current.src);
  wavesurfer.load(audioRef.current.src);
  setEditList([...editList, audioRef.current.src]);
  setEditListIndex(editListIndex + 1);
};

const effectChorusReverb = async (
  ffmpegRef,
  inGainChr,
  outGainChr,
  delayChr,
  decayChr,
  speedChr,
  depthsChr,
  audioRef,
  setAudioURL,
  audioURL,
  wavesurfer,
  setEditList,
  editList,
  setEditListIndex,
  editListIndex
) => {
  const ffmpeg = ffmpegRef.current;
  await ffmpeg.writeFile('input.mp3', await fetchFile(audioURL));

  console.log(
    `Reverb/Chorus Params: ${inGainChr} ${outGainChr} ${delayChr} ${decayChr} | ${speedChr} ${depthsChr}`
  );

  const command =
    depthsChr === null
      ? [
          '-i',
          'input.mp3',
          '-map',
          '0',
          '-af',
          `aecho=${inGainChr}:${outGainChr}:${delayChr}:${decayChr}`,
          'output.mp3',
        ]
      : [
          '-i',
          'input.mp3',
          '-af',
          `chorus=${inGainChr}:${outGainChr}:${delayChr}:${decayChr}:${speedChr}:${depthsChr}`,
          'output.mp3',
        ];

  await ffmpeg.exec(command);

  const data = await ffmpeg.readFile('output.mp3');
  if (audioRef.current) {
    audioRef.current.src = URL.createObjectURL(
      new Blob([data.buffer], { type: 'audio/mp3' })
    );
  }

  setAudioURL(audioRef.current.src);
  console.log('chorus updated', audioRef.current.src);
  wavesurfer.load(audioRef.current.src);
  setEditList([...editList, audioRef.current.src]);
  setEditListIndex(editListIndex + 1);
};

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
  if (!validateCutoff(cutoff) || !ffmpegRef || !isNumber(duration))
    throw new Error('Bad parameter to catchSilence()');

  const droppedRegions = [];
  const ffmpeg = ffmpegRef.current;

  // argument string for the -af flag
  const filterGraphStr = `silencedetect=n=${cutoff}:d=${duration}${
    mono ? `:m=true` : ''
  }`;

  // listen to ffmpeg logs (since filter-to-use has no output)
  // to determine if silence flagged
  ffmpeg.on('log', ({ type, message }) => {
    if (message.search(/silence_end: \d*\.?[0-9]*/) !== -1) {
      console.log(message);
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
  formatTime,
  loadFfmpeg,
  catchSilence,
  restoreState,
  formatTimeMilli,
  setupAudioContext,
  effectChorusReverb,
  effectSliceRegions,
};
