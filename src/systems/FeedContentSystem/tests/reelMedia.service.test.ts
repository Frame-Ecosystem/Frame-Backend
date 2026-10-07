jest.mock('child_process', () => ({ execFile: jest.fn() }));

import { execFile } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { stat, unlink } from 'fs/promises';
import ReelMediaService from '@systems/FeedContentSystem/services/reelMedia.service';
import { MAX_REEL_THUMBNAIL_BYTES } from '@systems/FeedContentSystem/contentLimits';

const mockedExecFile = execFile as unknown as jest.Mock;

describe('Reel media processing', () => {
  beforeEach(() => {
    mockedExecFile.mockReset();
  });

  it('reads duration and video dimensions from ffprobe metadata', async () => {
    mockedExecFile.mockImplementation((_binary, _args, _options, callback) => {
      callback(null, '', 'Input #0, mov, from video.mp4:\n  Duration: 00:02:59.50, start: 0.000000\n  Stream #0:0: Video: h264, yuv420p, 720x1280');
    });

    await expect(ReelMediaService.getVideoMetadata('video.mp4')).resolves.toEqual({
      duration: 179.5,
      width: 720,
      height: 1280,
    });
  });

  it('selects a representative frame rather than the first frame and returns a bounded JPEG file', async () => {
    let ffmpegArgs: string[] = [];
    mockedExecFile.mockImplementation((binary, args, _options, callback) => {
      if (String(binary).toLowerCase().includes('ffmpeg')) {
        ffmpegArgs = args;
        writeFileSync(args[args.length - 1], Buffer.from('jpeg-frame'));
      }
      callback(null, '', '');
    });

    const generated = await ReelMediaService.generateThumbnail('video.mp4', 2);

    expect(ffmpegArgs).toContain("scale='min(640,iw)':-2,thumbnail=12");
    expect(ffmpegArgs).toContain('-frames:v');
    expect(ffmpegArgs).toContain('1');
    expect(await stat(generated.path)).toMatchObject({ size: generated.size });
    await unlink(generated.path);
  });

  it('retries oversized generated frames at lower resolution and quality', async () => {
    const filters: string[] = [];
    let attempt = 0;
    mockedExecFile.mockImplementation((_binary, args, _options, callback) => {
      filters.push(args[args.indexOf('-vf') + 1]);
      attempt += 1;
      writeFileSync(args[args.length - 1], Buffer.alloc(attempt === 1 ? MAX_REEL_THUMBNAIL_BYTES + 1 : 1024));
      callback(null, '', '');
    });

    const generated = await ReelMediaService.generateThumbnail('video.mp4', 1);

    expect(generated.size).toBeLessThanOrEqual(MAX_REEL_THUMBNAIL_BYTES);
    expect(filters).toEqual(["scale='min(640,iw)':-2,thumbnail=12", "scale='min(480,iw)':-2,thumbnail=12"]);
    await unlink(generated.path);
  });

  it('removes a partial thumbnail file when ffmpeg fails', async () => {
    let outputPath = '';
    mockedExecFile.mockImplementation((_binary, args, _options, callback) => {
      outputPath = args[args.length - 1];
      writeFileSync(outputPath, Buffer.from('partial'));
      callback(new Error('ffmpeg failed'), '', '');
    });

    await expect(ReelMediaService.generateThumbnail('video.mp4', 1)).rejects.toThrow('ffmpeg failed');
    expect(existsSync(outputPath)).toBe(false);
  });
});
