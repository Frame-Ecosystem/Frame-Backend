import { NextFunction, Response } from 'express';
import SearchService from '@systems/FeedContentSystem/services/search.service';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import { SearchType, SEARCH_TYPE_VALUES } from '@systems/FeedContentSystem/interfaces/search.interface';
import { BadRequestException } from '@exceptions/HttpException';

class SearchController {
  private searchService = new SearchService();

  public ultraSearch = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const q = (req.query.q as string) || '';
      const type = (req.query.type as string) || SearchType.ALL;
      const userId = req.user._id.toString();

      if (!q.trim()) {
        throw new BadRequestException('Search query is required', 'SEARCH_QUERY_REQUIRED');
      }

      if (!SEARCH_TYPE_VALUES.includes(type as SearchType)) {
        throw new BadRequestException(`Invalid search type. Must be one of: ${SEARCH_TYPE_VALUES.join(', ')}`, 'INVALID_SEARCH_TYPE');
      }

      const results = await this.searchService.search(q, type as SearchType, userId);

      res.setHeader('Cache-Control', 'private, no-cache');
      res.setHeader('Vary', 'Authorization');
      res.status(200).json({ data: results, message: 'Search completed' });
    } catch (error) {
      next(error);
    }
  };
}

export default SearchController;
