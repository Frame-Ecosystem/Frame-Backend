import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import LikeService from '@systems/FeedContentSystem/services/like.service';
import { parsePagination } from '@utils/validators';
import { asyncHandler } from '@utils/controller';

class LikeController {
  private likeService = new LikeService();

  public toggleLike = asyncHandler(async (req: RequestWithUser, res) => {
    const userId = req.user._id.toString();
    const { targetId } = req.params;

    const result = await this.likeService.toggleLike(userId, targetId);
    res.status(200).json({ success: true, data: result, message: result.liked ? 'Liked' : 'Unliked' });
  }, 'toggleLike');

  public getMyLikes = asyncHandler(async (req: RequestWithUser, res) => {
    const userId = req.user._id.toString();
    const { page, limit } = parsePagination(req);

    const { likes, total } = await this.likeService.getMyLikes(userId, page, limit);
    res.status(200).json({ success: true, data: likes, total, page, limit, totalPages: Math.ceil(total / limit) });
  }, 'getMyLikes');

  public hasLiked = asyncHandler(async (req: RequestWithUser, res) => {
    const userId = req.user._id.toString();
    const { targetId } = req.params;

    const liked = await this.likeService.hasLiked(userId, targetId);
    res.status(200).json({ success: true, data: { liked } });
  }, 'hasLiked');

  public getTargetLikers = asyncHandler(async (req: RequestWithUser, res) => {
    const { targetId } = req.params;
    const { page, limit } = parsePagination(req);

    const { likes, total } = await this.likeService.getTargetLikers(targetId, page, limit);
    res.status(200).json({ success: true, data: likes, total, page, limit, totalPages: Math.ceil(total / limit) });
  }, 'getTargetLikers');
}

export default LikeController;
