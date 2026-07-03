import extraModel from '@systems/ExtrasSystem/models/extra.model';
import { Extra } from '@systems/ExtrasSystem/interfaces/extra.interface';
import { CreateExtraDto, UpdateExtraDto } from '@systems/ExtrasSystem/dtos/extras.dto';
import { HttpException, BadRequestException, NotFoundException, ConflictException, InternalServerException } from '@exceptions/HttpException';
import { isEmpty, handleMongooseError, escapeRegex } from '@utils/util';
import { logger } from '@utils/logger';

class ExtrasService {
  public extras = extraModel;

  private validateFreeCost(free: boolean, cost: number | undefined): void {
    if (!free && (cost === undefined || cost === null || cost <= 0)) {
      throw new BadRequestException(
        'Cost is required and must be greater than 0 when free is false',
        'COST_REQUIRED_FOR_PAID_EXTRA',
      );
    }
    if (free && cost !== undefined && cost !== null && cost > 0) {
      throw new BadRequestException(
        'Cost must not be set when free is true',
        'COST_NOT_ALLOWED_FOR_FREE_EXTRA',
      );
    }
  }

  private normalizeExtraName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w]/g, '');
  }

  public async getAll(page = 1, limit = 20, filter?: { category?: string; free?: boolean }): Promise<{ extras: Extra[]; total: number }> {
    try {
      const query: any = {};
      if (filter?.category) query.category = filter.category;
      if (filter?.free !== undefined) query.free = filter.free;

      const skip = (page - 1) * limit;
      const [extras, total] = await Promise.all([
        this.extras.find(query).populate('createdBy', 'name email').skip(skip).limit(limit).sort({ createdAt: -1 }),
        this.extras.countDocuments(query),
      ]);

      logger.info(`ExtrasService.getAll: retrieved ${extras.length} extras page=${page} limit=${limit}`);
      return { extras, total };
    } catch (error) {
      logger.error(`ExtrasService.getAll error: ${error.message}`, { stack: error.stack });
      throw new InternalServerException('Unable to retrieve extras at this time. Please try again later.');
    }
  }

  public async getById(extraId: string): Promise<Extra> {
    try {
      if (isEmpty(extraId)) {
        throw new BadRequestException('Extra ID is required', 'MISSING_EXTRA_ID');
      }

      const extra = await this.extras.findById(extraId).populate('createdBy', 'name email');

      if (!extra) {
        throw new NotFoundException('The requested extra could not be found', 'EXTRA_NOT_FOUND');
      }

      return extra;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ExtrasService.getById', {
        castMessage: 'Invalid extra ID format',
        fallbackMessage: 'Unable to retrieve extra at this time. Please try again later.',
        logMeta: { extraId },
      });
    }
  }

  public async create(data: CreateExtraDto, createdBy: string): Promise<Extra> {
    try {
      if (isEmpty(data) || !data.name || !data.category) {
        throw new BadRequestException('Extra name and category are required', 'MISSING_REQUIRED_FIELDS');
      }

      this.validateFreeCost(data.free, data.cost);

      const escapedName = escapeRegex(data.name.trim());
      const existing = await this.extras.findOne({ name: new RegExp(`^${escapedName}$`, 'i') });
      if (existing) {
        throw new ConflictException('An extra with this name already exists', 'EXTRA_NAME_EXISTS');
      }

      const normalizedName = this.normalizeExtraName(data.name);
      const escapedNormalizedName = escapeRegex(normalizedName);
      const existingNormalized = await this.extras.findOne({
        name: new RegExp(`^${escapedNormalizedName}$`, 'i'),
      });
      if (existingNormalized && this.normalizeExtraName(existingNormalized.name) === normalizedName) {
        throw new ConflictException('A similar extra already exists', 'EXTRA_SIMILAR_EXISTS');
      }

      const cost = data.free ? 0 : (data.cost ?? 0);

      const newExtra = await this.extras.create({
        ...data,
        name: data.name.trim().toLowerCase(),
        cost,
        createdBy,
      });

      logger.info(`ExtrasService.create: created extra ${newExtra._id} - ${data.name}`);
      return newExtra;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ExtrasService.create', {
        duplicateMessage: 'An extra with this information already exists.',
        fallbackMessage: 'Unable to create extra at this time. Please try again later.',
        logMeta: { data },
      });
    }
  }

  public async update(extraId: string, data: UpdateExtraDto): Promise<Extra> {
    try {
      if (isEmpty(extraId)) {
        throw new BadRequestException('Extra ID is required', 'MISSING_EXTRA_ID');
      }

      const existing = await this.extras.findById(extraId);
      if (!existing) {
        throw new NotFoundException('The requested extra could not be found', 'EXTRA_NOT_FOUND');
      }

      const free = data.free !== undefined ? data.free : existing.free;
      const cost = data.cost !== undefined ? data.cost : existing.cost;
      this.validateFreeCost(free, cost);

      const updateData: any = { ...data };

      if (data.name) {
        const escapedName = escapeRegex(data.name.trim());
        const duplicate = await this.extras.findOne({
          name: new RegExp(`^${escapedName}$`, 'i'),
          _id: { $ne: extraId },
        });
        if (duplicate) {
          throw new ConflictException('An extra with this name already exists', 'EXTRA_NAME_EXISTS');
        }
        updateData.name = data.name.trim().toLowerCase();
      }

      if (data.free !== undefined && data.free) {
        updateData.cost = 0;
      } else if (data.cost === 0) {
        updateData.free = true;
      }

      const updated = await this.extras.findByIdAndUpdate(extraId, updateData, { new: true }).populate('createdBy', 'name email');

      if (!updated) {
        throw new NotFoundException('The requested extra could not be found', 'EXTRA_NOT_FOUND');
      }

      logger.info(`ExtrasService.update: updated extra ${extraId}`);
      return updated;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ExtrasService.update', {
        castMessage: 'Invalid extra ID format',
        fallbackMessage: 'Unable to update extra at this time. Please try again later.',
        logMeta: { extraId },
      });
    }
  }

  public async delete(extraId: string): Promise<Extra> {
    try {
      if (isEmpty(extraId)) {
        throw new BadRequestException('Extra ID is required', 'MISSING_EXTRA_ID');
      }

      const deleted = await this.extras.findByIdAndDelete(extraId);

      if (!deleted) {
        throw new NotFoundException('The requested extra could not be found', 'EXTRA_NOT_FOUND');
      }

      logger.info(`ExtrasService.delete: deleted extra ${extraId}`);
      return deleted;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ExtrasService.delete', {
        castMessage: 'Invalid extra ID format',
        fallbackMessage: 'Unable to delete extra at this time. Please try again later.',
        logMeta: { extraId },
      });
    }
  }
}

export default ExtrasService;
