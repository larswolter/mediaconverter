import pino from 'pino';
import { join } from 'path';

const file = join(__dirname, '..', 'work', 'mediaconverter.log');

const transport = pino.transport({
  targets: [
    {
      level: 'debug',
      target: 'pino-pretty',
      options: {
        destination: file,
        mkdir: true,
        colorize: false,
        append: false,
        ignore: 'pid,hostname',
      },
    },
    {
      level: 'info',
      target: 'pino-pretty',
      options: { destination: 1 },
    },
  ],
});

export const logger = pino(transport);
