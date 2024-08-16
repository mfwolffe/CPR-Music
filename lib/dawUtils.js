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

export {
  formatTime,
  restoreState,
  setupAudioContext,
  loadFfmpeg,
  effectSliceRegions,
  effectChorusReverb,
};
