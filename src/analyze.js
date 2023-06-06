import { exec } from 'child_process';
import { SingleBar, Presets } from 'cli-progress';
import { collectFiles } from './helpers';

const categories = {};

const analyze = async ({ path, format, recursive, compare }) => {
  console.log('collecting files...');
  const files = collectFiles({ path, recursive });
  console.log(`${files.length} collected`);
  const progress = new SingleBar(
    {
      format: `${compare ? 'Comparing' : 'Analyzing'} {bar} {value}/{total} files`,
    },
    Presets.shades_classic
  );
  progress.start(files.length, 0);
  for (const filename of files) {
    try {
      const probe = await new Promise((resolve) => {
        exec(
          `ffprobe -v quiet -print_format json -show_format -show_streams -show_error "${filename}" `,
          (error, stdout) => {
            // console.log(result.join('\n'));
            resolve(JSON.parse(stdout));
          }
        );
      });
      if (probe && probe.streams && probe.format) {
        const video = probe.streams.find(
          (s) => s.codec_type === 'video' && (s.disposition.default || probe.streams.length === 1)
        );
        const audio = probe.streams.find(
          (s) => s.codec_type === 'audio' && (s.disposition.default || probe.streams.length === 1)
        );
        // const preview = probe.streams.find((s) => s.codec_type === 'video' && s.disposition.attached_pic);
        const classification = {
          format:
            probe.format.format_name && probe.format.format_name.includes(',mp4,') ? 'mp4' : probe.format.format_name,
          ...(video
            ? {
                vCodec: video.codec_name,
                resolution: Number(video.height),
                fps: Math.round(Number(video.r_frame_rate.split('/')[0]) / Number(video.r_frame_rate.split('/')[1])),
                vBitrate: Number((Math.round(Number(video.bit_rate) * 0.00001) * 0.1).toFixed(1)),
                vBitrateResolution:
                  Number(((Number(video.bit_rate) * 0.001) / Number(video.height)).toFixed(1)) *
                  (video.codec_name === 'hevc' ? 0.8 : 1.0),
              }
            : { vCodec: 'v' }),
          ...(audio
            ? {
                aCodec: audio.codec_name,
                channels: Number(audio.channels),
                sampleRate: Number(audio.sample_rate),
                aBitrate: Math.round(Number(audio.bit_rate) * 0.001),
              }
            : { aCodec: 'a' }),
        };
        let diffing =
          compare &&
          Object.keys(compare).filter((key) => {
            if (Array.isArray(compare[key])) {
              if (compare[key].includes(classification[key])) return false;
            } else if (compare[key].includes('-')) {
              const [min, max] = compare[key].split('-').map((n) => Number(n));
              if (classification[key] >= min && classification[key] <= max) return false;
            } else if (compare[key] === classification[key]) return false;
            return true;
          });
        const classificationString = Object.values(classification).join('-');
        if (classificationString.includes('-v-a')) {
          // we dont have audio or video
          diffing = [];
        }
        const category = compare ? diffing.join('-') : classificationString;
        if (format === 'files') {
          categories[category] = [...(categories[category] || []), filename];
        } else {
          categories[category] = categories[category] ? categories[category] + 1 : 1;
        }
      } else if (probe && probe.error) {
        if (format === 'files') {
          categories[`ERR-${probe.error.string}`] = [...(categories[`ERR-${probe.error.string}`] || []), filename];
        } else {
          categories[`ERR-${probe.error.string}`] = categories[`ERR-${probe.error.string}`]
            ? categories[`ERR-${probe.error.string}`] + 1
            : 1;
        }
      } else {
        if (format === 'files') {
          categories.unprobeable = [...(categories.unprobeable || []), filename];
        } else {
          categories.unprobeable = categories.unprobeable ? categories.unprobeable + 1 : 1;
        }
      }
    } catch (err) {
      if (format === 'files') {
        categories[`ERR-${err.message}`] = [...(categories[`ERR-${err.message}`] || []), filename];
      } else {
        categories[`ERR-${err.message}`] = categories[`ERR-${err.message}`] ? categories[`ERR-${err.message}`] + 1 : 1;
      }
    }
    progress.increment();
  }
  progress.stop();
  return categories;
};

export default analyze;
