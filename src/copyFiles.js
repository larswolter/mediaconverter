import { exec } from 'child_process';
import { Presets, MultiBar } from 'cli-progress';
import { unlinkSync } from 'fs';
import { join } from 'path';
import { fileDuration, fileSize, getProgress } from './helpers';

const copyFiles = async ({ files, conversion, sourceFolder, targetFolder, encode }) => {
  const progress = new MultiBar(
    {
      format: `${
        conversion === '' || conversion.includes('ERR') ? 'Ignoring' : 'Enc:'
      } ${conversion} {bar} {value}/{total} {description}`,
    },
    Presets.shades_classic
  );

  const filesBar = progress.create(files.length, 0, { description: 'files' });
  for (const filename of files) {
    let pass = 'scan';
    let targetFilename = join(targetFolder, filename.replace(sourceFolder, ''));
    if (!targetFilename.endsWith('.mp4')) targetFilename = targetFilename + '.mp4';
    const existingFileSize = await fileSize(targetFilename);
    const sourceDuration = await fileDuration(filename);
    if (existingFileSize) {
      const existingTargetDuration = await fileDuration(targetFilename);
      if (existingTargetDuration === sourceDuration) {
        // file exists and is complete
        filesBar.increment();
        continue;
      }
      throw new Error(
        `output file for ${filename} alreeady exists with ${existingFileSize} MB but has different duration ${sourceDuration} vs ${existingTargetDuration}`
      );
    }
    if (conversion === '' || conversion.includes('ERR')) {
      // copyFileSync(filename, targetFilename);
    } else if (['fps', 'fps-vBitrate', 'fps-vBitrate-Resolution'].includes(conversion)) {
      // we have a quick solution, just transcoding framerate
      const encodingBar = progress.create(
        sourceDuration,
        0,
        {},
        { format: `{pass}:${filename.replace(sourceFolder, '').substr(0, 25)} {bar} {value}/{total} seconds {eta}` }
      );

      const prober = setInterval(async () => {
        const { time: targetDuration, pass } = await getProgress();
        encodingBar.update(targetDuration, { pass });
      }, 2000);

      try {
        await new Promise((resolve, reject) => {
          exec(
            `ffmpeg -loglevel error -nostats -progress ffmpeg.progress -i "${filename}" -map 0 -codec:v:1 copy -codec:v:2 copy -codec:v:3 copy -filter:v:0 "fps=25.0" "${targetFilename}" `,
            (error) => {
              if (error) reject(error);
              resolve();
            }
          );
        });
      } catch (err) {
        console.log(`Error transociding ${filename}\n`, err);
      }
      clearInterval(prober);
      progress.remove(encodingBar);
    } else if (
      conversion.includes('vBitrate') ||
      conversion.includes('resolution') ||
      conversion.includes('vBitrateResolution') ||
      conversion.includes('vCodec')
    ) {
      const encodingBar = progress.create(
        sourceDuration,
        0,
        {},
        { format: `{pass}:${filename.replace(sourceFolder, '').substr(0, 25)} {bar} {value}/{total} seconds {eta}` }
      );

      const prober = setInterval(async () => {
        const { time: targetDuration } = await getProgress();

        encodingBar.update(targetDuration, { pass });
      }, 2000);
      try {
        // default copy streams 1,2,3 and only map 0
        let vParams = '-map 0 -codec:v:1 copy -codec:v:2 copy -codec:v:3 copy';
        let aParams = '-c:a copy';
        let precode = '';
        if (encode.preset) {
          vParams += ` -preset ${encode.preset}`;
        }
        if (encode.vBitrate) {
          if (encode.vCodec === 'hevc') {
            vParams += ` -c:v:0 libx265 -b:v:0 ${encode.vBitrate || '1700k'}`;
            precode = `ffmpeg -loglevel error -nostats -progress ffmpeg.progress -i "${filename}" ${vParams} -c:v:0 libx265 -b:v:0 ${
              encode.vBitrate || '1700k'
            } -x265-params pass=1 -an -f null /dev/null`;
            vParams += ' -x265-params pass=2';
          }
        } else if (encode.vQuality) {
          if (encode.vCodec === 'hevc') {
            vParams += ` -c:v:0 libx265 -crf ${encode.vQuality || '28'}`;
          }
        }
        if (conversion.includes('aBitrate') || conversion.includes('aCodec') || conversion.includes('aBitrate')) {
          aParams = `-c:a ${encode.aCodec || 'aac'} -b:a ${encode.aBitrate || '128k'}`;
        }
        if (precode) {
          await new Promise((resolve, reject) => {
            exec(precode, (error) => {
              if (error) reject(error);
              resolve();
            });
          });
          pass = 'enc';
          await new Promise((resolve, reject) => {
            exec(
              `ffmpeg -loglevel error -nostats -progress ffmpeg.progress -i "${filename}" ${vParams} ${aParams} "${targetFilename}" `,
              (error) => {
                if (error) reject(error);
                resolve();
              }
            );
          });
        }
      } catch (err) {
        console.log(`Error transcoding ${filename}\n`, err);
        throw err;
      }
      clearInterval(prober);
      progress.remove(encodingBar);
    }
    try {
      unlinkSync('ffmpeg.progress');
    } catch (err) {
      // ignore failed unlink
    }
    filesBar.increment();
  }
  progress.stop();
};
export default copyFiles;
