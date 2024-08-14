import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { FFmpeg } from '@ffmpeg/ffmpeg';

function validateCutoff(cutoff) {
  if (typeof cutoff === 'number' && 1 - Math.abs(cutoff) > 0) return true;
  if (typeof cutoff === 'string') {
    const rexp = /-\d{2}dB/;
    const regex = new RegExp(rexp);

    if (regex.test(cutoff)) return true;
  }
  return false;
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
  if (!validateCutoff(cutoff) || !ffmpegRef)
    throw new Error(
      'Parameter must be an amplitude ratio (0 < n < 1) or decibel string, e.g., "-40dB")'
    );

  const ffmpeg = ffmpegRef.current;
  // argument string for the -af flag
  const filterGraphStr = `silencedetect=noise=${cutoff}:duration=${duration}${
    mono ?? `:mono=${mono}`
  }`;

  // args for ffmpeg exec
  const args = [
    '-i',
    `${submissionFile}`,
    '-af',
    filterGraphStr,
    '-f',
    'null',
    '-',
  ];

  await ffmpeg.writeFile('input.mp3', await fetchFile(submissionFile));
  await ffmpeg.exec(args);
  const data = await ffmpeg.readFile('output.txt');

  console.log(data);
}

export { catchSilence };
