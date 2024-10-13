import { Command } from 'commander';
import { accessSync, constants, mkdirSync, readFileSync } from 'fs';
import analyze from './analyze';
import copyFiles from './copyFiles';
import audiobook from './audiobook';
import nodePath from 'path';
import { exit } from 'process';
import { logger } from './logger';

const workingDir = nodePath.join(__dirname, '..', 'work');
const relativeDir = process.cwd();

try {
  mkdirSync(workingDir);
} catch (err) {
  // ignore if working dir cannot be created
}

try {
  process.chdir(workingDir);
} catch (err) {
  logger.error(`could not switch to working directory "${workingDir}"`);
  exit(1);
}
logger.info(`Using working directory "${workingDir}"`);

const program = new Command();

program.name('mediaconverter').description('convert various media in a directory tree').version('0.8.0');

program
  .command('analyze')
  .description('analyze a directory tree showing all different formats encountered')
  .argument('<path>', 'path to analyze')
  .option('--no-recursive', 'dont go into subdirs')
  .option('-c, --compare <path>', 'json file with props to compare against', '')
  .option(
    '-f, --format <string>',
    'output format, one of info, files. files lists all files for a category, info just shows counts.',
    'info'
  )
  .action(async (path, options) => {
    const recursive = options['noRecursive'] ? false : true;
    const format = options['format'];
    const compare = options['compare'] && JSON.parse(readFileSync(nodePath.resolve(relativeDir, options['compare'])));
    const pathToAnalyze = nodePath.resolve(relativeDir, path);
    logger.info('Running Analyze:', { recursive, format, compare, pathToAnalyze });
    const res = await analyze({ path: pathToAnalyze, format, recursive, compare });
    logger.info(res);
  });
program
  .command('copy')
  .description('analyze a directory tree reencoding files not in compare json to a target directory')
  .argument('<path>', 'path to analyze')
  .argument('<target>', 'path to copy files to')
  .option('--no-recursive', 'dont go into subdirs')
  .option(
    '-c, --compare <path>',
    'json file with props to compare against',
    nodePath.join(__dirname, '..', 'config', 'video.json')
  )
  .option(
    '-e, --encode-config <json>',
    'path to encode json file',
    nodePath.join(__dirname, '..', 'config', 'encode.json')
  )
  .action(async (path, target, options) => {
    const recursive = options['no-recursive'] ? false : true;
    const compareJson = JSON.parse(readFileSync(nodePath.resolve(relativeDir, options['compare'])));
    const encodeJson = JSON.parse(readFileSync(nodePath.resolve(relativeDir, options['encodeConfig'])));
    const pathToAnalyze = nodePath.resolve(relativeDir, path);
    const targetPath = nodePath.resolve(relativeDir, target);
    try {
      accessSync(targetPath, constants.R_OK | constants.W_OK | constants.X_OK);
    } catch (err) {
      logger.error(`Cannot access targetFolder ${targetPath}`);
      exit(1);
    }
    logger.info('Running Copy:', { recursive, compareJson, encodeJson, pathToAnalyze, targetPath });
    const res = await analyze({ path: pathToAnalyze, format: 'files', recursive, compare: compareJson });
    for (const key of Object.keys(res)) {
      await copyFiles({
        files: res[key],
        conversion: key,
        targetFolder: targetPath,
        sourceFolder: pathToAnalyze,
        encode: encodeJson,
      });
    }
  });
program
  .command('audiobook')
  .description('analyze a directory tree with mp3 audiobooks and convert them to m4b')
  .argument('<mp3folder>', 'folder containing mp3s or a folder with subfolders containing mp3s')
  .argument('<targetFolder>', 'output folder where the .m4b should be put in')
  .option(
    '-e, --encode-config <json>',
    'path to encode json file',
    nodePath.join(__dirname, '..', 'config', 'encode.json')
  )
  .action(async (mp3folder, targetFolder, options) => {
    const pathToAnalyze = nodePath.resolve(relativeDir, mp3folder);
    const targetPath = nodePath.resolve(relativeDir, targetFolder);
    const encodeJson = JSON.parse(readFileSync(nodePath.resolve(relativeDir, options['encodeConfig'])));
    try {
      accessSync(targetPath, constants.R_OK | constants.W_OK | constants.X_OK);
    } catch (err) {
      logger.error(`Cannot access targetFolder ${targetPath}`);
      exit(1);
    }
    logger.info('Running Audiobook:', { pathToAnalyze, targetPath, bitrate: encodeJson.aBitrate });
    await audiobook({ path: pathToAnalyze, targetFolder: targetPath, encode: encodeJson });
  });

program.parse();
