import PostService from '@systems/FeedContentSystem/services/post.service';

describe('Feed content limits', () => {
  const postService = new PostService();

  it('rejects posts with more than 20 images', async () => {
    const media = Array.from(
      { length: 21 },
      (_, i) =>
        ({
          fieldname: 'media',
          originalname: `image-${i}.jpg`,
          encoding: '7bit',
          mimetype: 'image/jpeg',
          size: 1,
          buffer: Buffer.from('img'),
        } as unknown as Express.Multer.File),
    );

    await expect(postService.createPost('507f1f77bcf86cd799439011', 'client', { text: 'hello' }, media)).rejects.toMatchObject({
      status: 400,
      code: 'POST_MEDIA_LIMIT_EXCEEDED',
      message: 'A post can contain at most 20 images',
    });
  });
});
