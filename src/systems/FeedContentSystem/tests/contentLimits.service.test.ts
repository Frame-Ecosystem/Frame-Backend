import ReelService from '@systems/FeedContentSystem/services/reel.service';
import PostService from '@systems/FeedContentSystem/services/post.service';

describe('Feed content limits', () => {
  const reelService = new ReelService();
  const postService = new PostService();

  const fakeVideoFile = {
    fieldname: 'video',
    originalname: 'sample.mp4',
    encoding: '7bit',
    mimetype: 'video/mp4',
    size: 1,
    buffer: Buffer.from('video'),
  } as unknown as Express.Multer.File;

  it('rejects reel duration above 300 seconds', async () => {
    await expect(
      reelService.createReel('507f1f77bcf86cd799439011', 'client', { duration: 301 }, { video: [fakeVideoFile] }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_DURATION',
      message: 'Duration must be between 1 and 300 seconds',
    });
  });

  it('rejects non numeric reel duration', async () => {
    await expect(
      reelService.createReel('507f1f77bcf86cd799439011', 'client', { duration: Number.NaN }, { video: [fakeVideoFile] }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_DURATION',
      message: 'Duration is required and must be numeric',
    });
  });

  it('rejects posts with more than 20 images', async () => {
    const media = Array.from({ length: 21 }, (_, i) =>
      ({
        fieldname: 'media',
        originalname: `image-${i}.jpg`,
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1,
        buffer: Buffer.from('img'),
      }) as unknown as Express.Multer.File,
    );

    await expect(postService.createPost('507f1f77bcf86cd799439011', 'client', { text: 'hello' }, media)).rejects.toMatchObject({
      status: 400,
      code: 'POST_MEDIA_LIMIT_EXCEEDED',
      message: 'A post can contain at most 20 images',
    });
  });
});
