import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import LikeService from '@systems/FeedContentSystem/services/like.service';
import { parsePagination } from '@utils/validators';
import { asyncHandler } from '@utils/controller';

class LikeController {
  private likeService = new LikeService();

  /** POST /likes/:targetId — toggle like/unlike for the authenticated user. */
  public toggleLike = asyncHandler(async (req: RequestWithUser, res) => {
    const userId = req.user._id.toString();
    const { targetId } = req.params;

    const result = await this.likeService.toggleLike(userId, targetId);
    res.status(200).json({ success: true, data: result, message: result.liked ? 'Liked' : 'Unliked' });
  });

  /** GET /likes/me — all targets liked by the authenticated user. */
  public getMyLikes = asyncHandler(async (req: RequestWithUser, res) => {
    const userId = req.user._id.toString();
    const { page, limit } = parsePagination(req);

    const { likes, total } = await this.likeService.getMyLikes(userId, page, limit);
    res.status(200).json({ success: true, data: likes, total, page, limit, totalPages: Math.ceil(total / limit) });
  });

  /** GET /likes/check/:targetId — check if user has liked a target. */
  public hasLiked = asyncHandler(async (req: RequestWithUser, res) => {
    const userId = req.user._id.toString();
    const { targetId } = req.params;

    const liked = await this.likeService.hasLiked(userId, targetId);
    res.status(200).json({ success: true, data: { liked } });
  });

  /** GET /likes/target/:targetId — users who liked this target (auth required). */
  public getTargetLikers = asyncHandler(async (req: RequestWithUser, res) => {
    const { targetId } = req.params;
    const { page, limit } = parsePagination(req);

    const { likes, total } = await this.likeService.getTargetLikers(targetId, page, limit);
    res.status(200).json({ success: true, data: likes, total, page, limit, totalPages: Math.ceil(total / limit) });
  });
}

export default LikeController;
