import { appendFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { exec } from 'child_process';
import { Presets, MultiBar } from 'cli-progress';
import { collectFiles, collectFolders, fileDuration, fileSize, getProgress } from './helpers';
import { logger } from './logger';

const audiobook = async ({ path, targetFolder, encode }) => {
  logger.info('collecting files...');
  const folders = collectFolders({ path, recursive: true });
  const progress = new MultiBar(
    {
      format: 'Converting {bar} {value}/{total} audiobooks',
    },
    Presets.shades_classic
  );
  const filesBar = progress.create(folders.length, 1);
  for (const folder of folders) {
    // cleanup
    try {
      unlinkSync('audiobookConcatenated.m4a');
      unlinkSync('audiobookFinal.m4a');
    } catch (err) {
      /*ignore*/
    }
    const files = collectFiles({ path: folder, recursive: false }).sort();
    // analyze files to get duration and chapters
    let encodingBar = progress.create(
      files.length,
      0,
      {},
      { format: `Analyzing:${folder.replace(path, '').substr(0, 25)} {bar} {value}/{total} files` }
    );
    let sourceDuration = 0;
    const chapters = [];
    writeFileSync(
      'audiobookMetadata.txt',
      `;FFMETADATA1
title=${basename(folder)}
`
    );
    let cover;
    for (const file of files) {
      const duration = await fileDuration(file);
      if (duration) {
        chapters.push(file);
        appendFileSync(
          'audiobookMetadata.txt',
          `[CHAPTER]
TIMEBASE=1/1000
START=${sourceDuration * 1000}
END=${(sourceDuration + duration) * 1000}
title=${basename(file, 'mp3')}
`
        );
        sourceDuration += duration;
      } else if (
        file.toLowerCase().endsWith('.jpg') ||
        file.toLowerCase().endsWith('.jpeg') ||
        file.toLowerCase().endsWith('.png')
      ) {
        cover = file;
      }
      encodingBar.increment();
    }
    const targetFilename = join(targetFolder, basename(folder)) + '.m4b';
    const existingFileSize = await fileSize(targetFilename);
    if (existingFileSize) {
      unlinkSync('audiobookMetadata.txt');
      progress.remove(encodingBar);
      filesBar.increment();
      continue;
    }
    // create filelist
    writeFileSync('audiobookFileList.txt', chapters.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
    progress.remove(encodingBar);

    encodingBar = progress.create(
      sourceDuration,
      0,
      {},
      { format: `Transcoding:${folder.replace(path, '').substr(0, 25)} {bar} {value}/{total} seconds` }
    );
    const prober = setInterval(async () => {
      const { time: targetDuration } = await getProgress();
      encodingBar.update(targetDuration);
    }, 2000);
    try {
      await new Promise((resolve, reject) => {
        exec(
          `ffmpeg -f concat -safe 0 -i audiobookFileList.txt -b:a ${
            encode.aBitrate || '128k'
          } -c:a aac -vn -nostats -progress ffmpeg.progress "audiobookConcatenated.m4a"`,
          (error) => {
            if (error) reject(error);
            resolve();
          }
        );
      });
      await new Promise((resolve, reject) => {
        exec(
          `ffmpeg -i "audiobookConcatenated.m4a" -i audiobookMetadata.txt ${
            cover ? `-i "${cover}"` : ''
          } -map 0 -map_metadata 1 ${cover ? '-map 2' : ''} -c:a copy ${
            cover ? '-vf "scale=512:-2" -c:v png -disposition:v attached_pic' : ''
          }  "audiobookFinal.m4a"`,
          (error) => {
            if (error) reject(error);
            resolve();
          }
        );
      });
      unlinkSync('audiobookFileList.txt');
      unlinkSync('audiobookMetadata.txt');
      unlinkSync('audiobookConcatenated.m4a');
      renameSync('audiobookFinal.m4a', targetFilename);
    } catch (err) {
      logger.info(err);
    }
    clearInterval(prober);
    progress.remove(encodingBar);
    filesBar.increment();
  }
  progress.stop();
};

export default audiobook;
