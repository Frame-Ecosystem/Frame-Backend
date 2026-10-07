import { mkdtemp, rm, stat, unlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import ReelService from '@systems/FeedContentSystem/services/reel.service';
import ReelMediaService from '@systems/FeedContentSystem/services/reelMedia.service';
import reelModel from '@systems/FeedContentSystem/models/reel.model';
import hashtagModel from '@systems/FeedContentSystem/models/hashtag.model';
import R2Service from '@shared/services/cloudflareR2.service';
import { MAX_REEL_THUMBNAIL_BYTES, MAX_REEL_VIDEO_BYTES } from '@systems/FeedContentSystem/contentLimits';

describe('Reel upload flow', () => {
  const service = new ReelService();
  let directory: string;
  let cleanupFiles: string[];
  let reelDocument: { _id: string; toObject: jest.Mock };

  const writeTempFile = async (name: string, contents: string): Promise<string> => {
    const path = join(directory, name);
    await writeFile(path, contents);
    cleanupFiles.push(path);
    return path;
  };

  const file = async (name: string, contents: string, mimetype: string): Promise<Express.Multer.File> => {
    const path = await writeTempFile(name, contents);
    const fileStats = await stat(path);
    return {
      fieldname: name === 'video.mp4' ? 'video' : 'thumbnail',
      originalname: name,
      encoding: '7bit',
      mimetype,
      size: fileStats.size,
      path,
    } as Express.Multer.File;
  };

  const mockPopulation = (result: unknown, failure?: Error) => {
    const query = {
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementation(() => (failure ? Promise.reject(failure) : Promise.resolve(result))),
    };
    jest.spyOn(reelModel, 'findById').mockReturnValue(query as any);
  };

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'frame-reel-test-'));
    cleanupFiles = [];
    reelDocument = { _id: 'reel-id', toObject: jest.fn().mockReturnValue({ _id: 'reel-id', persisted: true }) };

    jest.spyOn(ReelMediaService, 'getVideoMetadata').mockResolvedValue({ duration: 30, width: 720, height: 1280 });
    jest.spyOn(ReelMediaService, 'getImageMetadata').mockResolvedValue({ codec: 'mjpeg', width: 640, height: 640 });
    jest.spyOn(ReelMediaService, 'generateThumbnail').mockImplementation(async () => {
      const path = await writeTempFile('generated.jpg', 'jpeg-data');
      return { path, size: (await stat(path)).size };
    });
    jest.spyOn(R2Service, 'uploadReelVideoFile').mockResolvedValue({ url: 'https://cdn/video.mp4', publicId: 'video-key' });
    jest.spyOn(R2Service, 'uploadReelThumbnailFile').mockResolvedValue({ url: 'https://cdn/thumb.jpg', publicId: 'thumb-key' });
    jest.spyOn(R2Service, 'deleteImage').mockResolvedValue();
    jest.spyOn(reelModel, 'create').mockResolvedValue(reelDocument as never);
    jest.spyOn(hashtagModel, 'updateOne').mockReturnValue({ exec: jest.fn().mockResolvedValue({}) } as any);
    mockPopulation({ _id: 'reel-id', populated: true });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await Promise.all(cleanupFiles.map(path => unlink(path).catch(() => undefined)));
    await rm(directory, { recursive: true, force: true });
  });

  it('accepts a valid video under three minutes and stores metadata from the video itself', async () => {
    const video = await file('video.mp4', 'video-bytes', 'video/mp4');
    (ReelMediaService.getVideoMetadata as jest.Mock).mockResolvedValue({ duration: 179.5, width: 640, height: 360 });

    await service.createReel('author-id', 'client', { duration: 30 }, { video: [video] });

    expect(reelModel.create).toHaveBeenCalledWith(expect.objectContaining({ duration: 179.5 }));
    expect(ReelMediaService.getVideoMetadata).toHaveBeenCalledWith(video.path);
  });

  it('rejects a video whose probed duration exceeds three minutes', async () => {
    const video = await file('video.mp4', 'video-bytes', 'video/mp4');
    (ReelMediaService.getVideoMetadata as jest.Mock).mockResolvedValue({ duration: 180.01, width: 720, height: 1280 });

    await expect(service.createReel('author-id', 'client', { duration: 30 }, { video: [video] })).rejects.toMatchObject({
      code: 'INVALID_DURATION',
    });
    expect(R2Service.uploadReelVideoFile).not.toHaveBeenCalled();
  });

  it('rejects videos over 90 MiB before inspecting or uploading them', async () => {
    const video = {
      fieldname: 'video',
      originalname: 'large.mp4',
      encoding: '7bit',
      mimetype: 'video/mp4',
      size: MAX_REEL_VIDEO_BYTES + 1,
      path: join(directory, 'large.mp4'),
    } as Express.Multer.File;

    await expect(service.createReel('author-id', 'client', { duration: 30 }, { video: [video] })).rejects.toMatchObject({
      code: 'UPLOAD_FILE_TOO_LARGE',
    });
    expect(ReelMediaService.getVideoMetadata).not.toHaveBeenCalled();
  });

  it('rejects custom thumbnails over 5 MiB', async () => {
    const video = await file('video.mp4', 'video-bytes', 'video/mp4');
    const thumbnail = {
      fieldname: 'thumbnail',
      originalname: 'large.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: MAX_REEL_THUMBNAIL_BYTES + 1,
      path: join(directory, 'large.jpg'),
    } as Express.Multer.File;

    await expect(service.createReel('author-id', 'client', { duration: 30 }, { video: [video], thumbnail: [thumbnail] })).rejects.toMatchObject({
      code: 'THUMBNAIL_FILE_TOO_LARGE',
    });
  });

  it('uploads and persists a valid user-provided thumbnail', async () => {
    const video = await file('video.mp4', 'video-bytes', 'video/mp4');
    const thumbnail = await file('thumbnail.jpg', 'jpeg-data', 'image/jpeg');

    await service.createReel('author-id', 'client', { duration: 30 }, { video: [video], thumbnail: [thumbnail] });

    expect(R2Service.uploadReelThumbnailFile).toHaveBeenCalledWith(thumbnail.path, 'image/jpeg', thumbnail.size, expect.any(String));
    expect(ReelMediaService.generateThumbnail).not.toHaveBeenCalled();
    expect(reelModel.create).toHaveBeenCalledWith(expect.objectContaining({ thumbnailUrl: 'https://cdn/thumb.jpg' }));
    await expect(stat(video.path)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(stat(thumbnail.path)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('generates, stores, and cleans up a JPEG thumbnail when none is supplied', async () => {
    const video = await file('video.mp4', 'video-bytes', 'video/mp4');

    await service.createReel('author-id', 'client', { duration: 30 }, { video: [video] });

    expect(ReelMediaService.generateThumbnail).toHaveBeenCalledWith(video.path, 2);
    expect(R2Service.uploadReelThumbnailFile).toHaveBeenCalledWith(expect.any(String), 'image/jpeg', expect.any(Number), expect.any(String));
    expect(reelModel.create).toHaveBeenCalledWith(expect.objectContaining({ thumbnailUrl: 'https://cdn/thumb.jpg' }));
    await expect(stat(video.path)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(stat(join(directory, 'generated.jpg'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not store a generated thumbnail that exceeds 5 MiB', async () => {
    const video = await file('video.mp4', 'video-bytes', 'video/mp4');
    (ReelMediaService.generateThumbnail as jest.Mock).mockImplementation(async () => {
      const path = await writeTempFile('generated-too-large.jpg', 'placeholder');
      return { path, size: MAX_REEL_THUMBNAIL_BYTES + 1 };
    });

    await service.createReel('author-id', 'client', { duration: 30 }, { video: [video] });

    expect(R2Service.uploadReelThumbnailFile).not.toHaveBeenCalled();
    expect(reelModel.create).toHaveBeenCalledWith(expect.objectContaining({ thumbnailUrl: '', thumbnailPublicId: '' }));
    await expect(stat(join(directory, 'generated-too-large.jpg'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('creates the reel successfully without a thumbnail when generation fails', async () => {
    const video = await file('video.mp4', 'video-bytes', 'video/mp4');
    (ReelMediaService.generateThumbnail as jest.Mock).mockRejectedValue(new Error('ffmpeg failed'));

    await expect(service.createReel('author-id', 'client', { duration: 30 }, { video: [video] })).resolves.toEqual({
      _id: 'reel-id',
      populated: true,
    });

    expect(reelModel.create).toHaveBeenCalledWith(expect.objectContaining({ thumbnailUrl: '', thumbnailPublicId: '' }));
    expect(R2Service.deleteImage).not.toHaveBeenCalled();
    await expect(stat(video.path)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not report a saved reel as failed when hashtag sync and population fail', async () => {
    const video = await file('video.mp4', 'video-bytes', 'video/mp4');
    jest.spyOn(hashtagModel, 'updateOne').mockReturnValue({ exec: jest.fn().mockRejectedValue(new Error('hashtag store unavailable')) } as any);
    mockPopulation(undefined, new Error('population unavailable'));

    await expect(service.createReel('author-id', 'client', { duration: 30, hashtags: ['beauty'] }, { video: [video] })).resolves.toEqual({
      _id: 'reel-id',
      persisted: true,
    });

    expect(reelModel.create).toHaveBeenCalledTimes(1);
    expect(R2Service.deleteImage).not.toHaveBeenCalled();
    await expect(stat(video.path)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('cleans temporary files and uploaded storage objects when Reel persistence fails', async () => {
    const video = await file('video.mp4', 'video-bytes', 'video/mp4');
    jest.spyOn(reelModel, 'create').mockRejectedValue(new Error('database unavailable') as never);

    await expect(service.createReel('author-id', 'client', { duration: 30 }, { video: [video] })).rejects.toMatchObject({
      status: 500,
    });

    expect(R2Service.deleteImage).toHaveBeenCalledWith('video-key');
    expect(R2Service.deleteImage).toHaveBeenCalledWith('thumb-key');
    await expect(stat(video.path)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(stat(join(directory, 'generated.jpg'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
