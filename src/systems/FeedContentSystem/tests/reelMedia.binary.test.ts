import { execFileSync } from 'child_process';
import { mkdtemp, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import ffmpegPath from 'ffmpeg-static';
import ReelMediaService from '@systems/FeedContentSystem/services/reelMedia.service';
import { MAX_REEL_THUMBNAIL_BYTES } from '@systems/FeedContentSystem/contentLimits';

describe('Bundled FFmpeg Reel processing', () => {
  it('probes an actual video and generates a size-limited JPEG thumbnail', async () => {
    if (!ffmpegPath) throw new Error('Bundled FFmpeg executable is not available for this platform');

    const directory = await mkdtemp(join(tmpdir(), 'frame-reel-binary-test-'));
    const videoPath = join(directory, 'sample.mp4');
    let thumbnailPath: string | undefined;

    try {
      execFileSync(
        ffmpegPath,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-f',
          'lavfi',
          '-i',
          'testsrc=duration=2:size=320x240:rate=10',
          '-c:v',
          'mpeg4',
          '-pix_fmt',
          'yuv420p',
          '-y',
          videoPath,
        ],
        { timeout: 30_000 },
      );

      await expect(ReelMediaService.getVideoMetadata(videoPath)).resolves.toMatchObject({
        duration: 2,
        width: 320,
        height: 240,
      });

      const thumbnail = await ReelMediaService.generateThumbnail(videoPath, 0.2);
      thumbnailPath = thumbnail.path;
      expect(thumbnail.size).toBeLessThanOrEqual(MAX_REEL_THUMBNAIL_BYTES);
      await expect(stat(thumbnail.path)).resolves.toMatchObject({ size: thumbnail.size });
      await expect(ReelMediaService.getImageMetadata(thumbnail.path)).resolves.toMatchObject({
        codec: 'mjpeg',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
      if (thumbnailPath) await rm(thumbnailPath, { force: true });
    }
  }, 90_000);
});
