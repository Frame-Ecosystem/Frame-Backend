import loungeExtraModel from '@systems/ExtrasSystem/models/loungeExtra.model';
import extraModel from '@systems/ExtrasSystem/models/extra.model';
import { LoungeExtra } from '@systems/ExtrasSystem/interfaces/extra.interface';
import { AdoptExtraDto, UpdateAdoptedExtraDto } from '@systems/ExtrasSystem/dtos/extras.dto';
import { HttpException, BadRequestException, NotFoundException, ConflictException, InternalServerException } from '@exceptions/HttpException';
import { isEmpty } from '@utils/util';
import { logger } from '@utils/logger';

class LoungeExtrasService {
  private loungeExtras = loungeExtraModel;
  private extras = extraModel;

  public async getByLounge(loungeId: string, page = 1, limit = 20): Promise<{ extras: LoungeExtra[]; total: number }> {
    try {
      const skip = (page - 1) * limit;
      const [extras, total] = await Promise.all([
        this.loungeExtras
          .find({ loungeId })
          .populate('extraId')
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 }),
        this.loungeExtras.countDocuments({ loungeId }),
      ]);

      logger.info(`LoungeExtrasService.getByLounge: retrieved ${extras.length} extras for lounge ${loungeId}`);
      return { extras, total };
    } catch (error) {
      logger.error(`LoungeExtrasService.getByLounge error: ${error.message}`, { loungeId, stack: error.stack });
      throw new InternalServerException('Unable to retrieve adopted extras at this time. Please try again later.');
    }
  }

  public async getAvailable(loungeId: string, page = 1, limit = 20): Promise<{ extras: any[]; total: number }> {
    try {
      const adopted = await this.loungeExtras.find({ loungeId }).distinct('extraId');

      const skip = (page - 1) * limit;
      const query = { _id: { $nin: adopted }, isActive: true };
      const [extras, total] = await Promise.all([
        extraModel.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
        extraModel.countDocuments(query),
      ]);

      logger.info(`LoungeExtrasService.getAvailable: retrieved ${extras.length} available extras for lounge ${loungeId}`);
      return { extras, total };
    } catch (error) {
      logger.error(`LoungeExtrasService.getAvailable error: ${error.message}`, { loungeId, stack: error.stack });
      throw new InternalServerException('Unable to retrieve available extras at this time. Please try again later.');
    }
  }

  public async adopt(loungeId: string, data: AdoptExtraDto): Promise<LoungeExtra> {
    try {
      if (isEmpty(data) || !data.extraId) {
        throw new BadRequestException('Extra ID is required to adopt an extra', 'MISSING_EXTRA_ID');
      }

      const extra = await this.extras.findById(data.extraId);
      if (!extra) {
        throw new NotFoundException('The requested extra could not be found', 'EXTRA_NOT_FOUND');
      }

      const existing = await this.loungeExtras.findOne({ loungeId, extraId: data.extraId });
      if (existing) {
        throw new ConflictException('This extra has already been adopted by your lounge', 'EXTRA_ALREADY_ADOPTED');
      }

      const adopted = await this.loungeExtras.create({
        loungeId,
        extraId: data.extraId,
        cost: data.cost,
        description: data.description || extra.description,
        isActive: true,
      });

      logger.info(`LoungeExtrasService.adopt: lounge ${loungeId} adopted extra ${data.extraId}`);
      return adopted;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeExtrasService.adopt error: ${error.message}`, { loungeId, data, stack: error.stack });
      throw new InternalServerException('Unable to adopt extra at this time. Please try again later.');
    }
  }

  public async update(adoptedId: string, loungeId: string, data: UpdateAdoptedExtraDto): Promise<LoungeExtra> {
    try {
      if (isEmpty(adoptedId)) {
        throw new BadRequestException('Adopted extra ID is required', 'MISSING_ADOPTED_ID');
      }

      const existing = await this.loungeExtras.findOne({ _id: adoptedId, loungeId });
      if (!existing) {
        throw new NotFoundException('Adopted extra not found', 'ADOPTED_EXTRA_NOT_FOUND');
      }

      const updated = await this.loungeExtras
        .findByIdAndUpdate(adoptedId, { $set: data }, { new: true })
        .populate('extraId');

      if (!updated) {
        throw new NotFoundException('Adopted extra not found', 'ADOPTED_EXTRA_NOT_FOUND');
      }

      logger.info(`LoungeExtrasService.update: updated adopted extra ${adoptedId} for lounge ${loungeId}`);
      return updated;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeExtrasService.update error: ${error.message}`, { adoptedId, loungeId, stack: error.stack });
      throw new InternalServerException('Unable to update adopted extra at this time. Please try again later.');
    }
  }

  public async remove(adoptedId: string, loungeId: string): Promise<LoungeExtra> {
    try {
      if (isEmpty(adoptedId)) {
        throw new BadRequestException('Adopted extra ID is required', 'MISSING_ADOPTED_ID');
      }

      const deleted = await this.loungeExtras.findOneAndDelete({ _id: adoptedId, loungeId });

      if (!deleted) {
        throw new NotFoundException('Adopted extra not found', 'ADOPTED_EXTRA_NOT_FOUND');
      }

      logger.info(`LoungeExtrasService.remove: removed adopted extra ${adoptedId} for lounge ${loungeId}`);
      return deleted;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeExtrasService.remove error: ${error.message}`, { adoptedId, loungeId, stack: error.stack });
      throw new InternalServerException('Unable to remove adopted extra at this time. Please try again later.');
    }
  }

  public async toggle(adoptedId: string, loungeId: string): Promise<LoungeExtra> {
    try {
      if (isEmpty(adoptedId)) {
        throw new BadRequestException('Adopted extra ID is required', 'MISSING_ADOPTED_ID');
      }

      const existing = await this.loungeExtras.findOne({ _id: adoptedId, loungeId });
      if (!existing) {
        throw new NotFoundException('Adopted extra not found', 'ADOPTED_EXTRA_NOT_FOUND');
      }

      const updated = await this.loungeExtras
        .findByIdAndUpdate(adoptedId, { isActive: !existing.isActive }, { new: true })
        .populate('extraId');

      if (!updated) {
        throw new NotFoundException('Adopted extra not found', 'ADOPTED_EXTRA_NOT_FOUND');
      }

      logger.info(`LoungeExtrasService.toggle: toggled adopted extra ${adoptedId} to isActive=${updated.isActive}`);
      return updated;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error(`LoungeExtrasService.toggle error: ${error.message}`, { adoptedId, loungeId, stack: error.stack });
      throw new InternalServerException('Unable to toggle adopted extra status at this time. Please try again later.');
    }
  }
}

export default LoungeExtrasService;
