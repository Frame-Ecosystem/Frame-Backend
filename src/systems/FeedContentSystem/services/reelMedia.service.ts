import { execFile as execFileCallback } from 'child_process';
import { randomUUID } from 'crypto';
import { stat, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import ffmpegPath from 'ffmpeg-static';
import { MAX_REEL_THUMBNAIL_BYTES } from '@systems/FeedContentSystem/contentLimits';

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
}

interface ImageMetadata {
  codec: string;
  width: number;
  height: number;
}

function execute(args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFileCallback(ffmpegPath || 'ffmpeg', args, { timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.message = `${error.message}${stderr ? `: ${stderr.trim()}` : ''}`;
        return reject(error);
      }
      resolve(`${stdout}\n${stderr}`);
    });
  });
}

function getMediaStream(output: string) {
  const stream = output.split(/\r?\n/).find(line => /Stream #\d+:\d+.*Video:/.test(line));
  if (!stream) throw new Error('Video stream metadata is missing');

  const codec = stream.match(/Video:\s*([a-zA-Z0-9_]+)/)?.[1];
  const dimensions = stream.match(/\b(\d{2,5})x(\d{2,5})\b/);
  const width = Number(dimensions?.[1]);
  const height = Number(dimensions?.[2]);
  if (!codec || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error('Video stream metadata is incomplete');
  }
  return { codec, width, height };
}

class ReelMediaService {
  public async getVideoMetadata(filePath: string): Promise<VideoMetadata> {
    const output = await execute(['-hide_banner', '-i', filePath, '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-'], 30_000);
    const durationMatch = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    const stream = getMediaStream(output);
    const duration = durationMatch ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]) : Number.NaN;

    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('Video duration metadata is incomplete');
    }

    return { duration, width: stream.width, height: stream.height };
  }

  public async getImageMetadata(filePath: string): Promise<ImageMetadata> {
    const output = await execute(['-hide_banner', '-i', filePath, '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-'], 15_000);
    const stream = getMediaStream(output);
    return { codec: stream.codec, width: stream.width, height: stream.height };
  }

  public async generateThumbnail(videoPath: string, seekSeconds: number): Promise<{ path: string; size: number }> {
    const profiles = [
      { maxWidth: 640, quality: 8 },
      { maxWidth: 480, quality: 12 },
    ];

    for (const [index, profile] of profiles.entries()) {
      const thumbnailPath = join(tmpdir(), `${randomUUID()}.jpg`);
      try {
        await execute(
          [
            '-hide_banner',
            '-loglevel',
            'error',
            '-ss',
            String(Math.max(0, seekSeconds)),
            '-i',
            videoPath,
            '-t',
            '8',
            '-map',
            '0:v:0',
            '-vf',
            `scale='min(${profile.maxWidth},iw)':-2,thumbnail=12`,
            '-frames:v',
            '1',
            '-an',
            '-q:v',
            String(profile.quality),
            '-threads',
            '1',
            '-y',
            thumbnailPath,
          ],
          60_000,
        );

        const fileStats = await stat(thumbnailPath);
        if (!fileStats.isFile() || fileStats.size <= 0) {
          throw new Error('Thumbnail generation returned an empty file');
        }
        if (fileStats.size <= MAX_REEL_THUMBNAIL_BYTES) {
          return { path: thumbnailPath, size: fileStats.size };
        }

        await unlink(thumbnailPath);
        if (index === profiles.length - 1) {
          throw new Error('Generated thumbnail exceeds the configured size limit');
        }
      } catch (error) {
        await unlink(thumbnailPath).catch(() => undefined);
        throw error;
      }
    }

    throw new Error('Unable to generate a thumbnail within the configured size limit');
  }
}

export default new ReelMediaService();
