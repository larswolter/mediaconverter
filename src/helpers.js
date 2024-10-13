import { readdirSync } from 'fs';
import { join as pathJoin } from 'path';
import { exec } from 'child_process';
import { statSync } from 'fs';

export const collectFiles = ({ path, recursive }) => {
  let files = [];
  let entries = readdirSync(path, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (recursive)
        files = [
          ...files,
          ...collectFiles({
            path: pathJoin(path, entry.name),
            recursive,
            parent: path,
          }),
        ];
    } else {
      files.push(pathJoin(path, entry.name));
    }
  }
  return files;
};

export const collectFolders = ({ path, recursive }) => {
  let folders = [];
  let entries = readdirSync(path, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (recursive) {
        const subFolders = collectFolders({
          path: pathJoin(path, entry.name),
          recursive,
          parent: path,
        });
        folders = [...folders, ...subFolders];
      } else {
        folders.push(pathJoin(path, entry.name));
      }
    }
  }
  if (folders.length === 0) return [path];
  return folders;
};

export const fileSize = async (filename) => {
  try {
    const probe = statSync(filename);
    return Math.round(probe.size / 1000 / 1000);
  } catch (err) {
    return 0;
  }
};
export const getProgress = async () => {
  const probe = await new Promise((resolve) => {
    exec('tail -n 15 ffmpeg.progress', (error, stdout) => {
      // logger.info(result.join('\n'));
      const progress = {};
      stdout.split('\n').forEach((line) => {
        const [key, value] = line.split('=');
        if (key && value) progress[key] = value;
      });
      resolve(progress);
    });
  });
  // unlinkSync('ffmpeg.progress');
  return {
    time: Math.round(Number(probe.out_time_us || '0') / 1000000),
    pass: probe.bitrate && probe.bitrate.indexOf('N/A') >= 0 ? 'scan' : 'enc',
  };
};

export const fileDuration = async (filename) => {
  const probe = await new Promise((resolve) => {
    exec(`ffprobe -v quiet -print_format json -show_format "${filename}" `, (error, stdout) => {
      // logger.info(result.join('\n'));
      resolve(JSON.parse(stdout));
    });
  });
  return Math.floor(parseFloat((probe && probe.format && probe.format.duration) || '0'));
};
