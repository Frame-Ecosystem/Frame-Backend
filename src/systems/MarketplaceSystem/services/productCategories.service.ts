import slugify from 'slugify';
import productCategoryModel from '@systems/MarketplaceSystem/models/productCategory.model';
import { ProductCategory } from '@systems/MarketplaceSystem/interfaces/productCategory.interface';
import { CreateProductCategoryDto, UpdateProductCategoryDto } from '@systems/MarketplaceSystem/dtos/productCategories.dto';
import { HttpException, BadRequestException, NotFoundException, ConflictException } from '@exceptions/HttpException';
import { isEmpty, handleMongooseError } from '@utils/util';
import { logger } from '@utils/logger';

class ProductCategoriesService {
  private categories = productCategoryModel;

  /* ───────── Slug helper ───────── */

  private async generateUniqueSlug(name: string, ignoreId?: string): Promise<string> {
    const base = slugify(name, { lower: true, strict: true }) || 'category';
    let slug = base;
    let counter = 0;
    // eslint-disable-next-line no-await-in-loop
    while (await this.categories.exists({ slug, ...(ignoreId && { _id: { $ne: ignoreId } }) })) {
      counter += 1;
      slug = `${base}-${counter}`;
    }
    return slug;
  }

  /* ───────── Create ───────── */

  public async createProductCategory(data: CreateProductCategoryDto): Promise<ProductCategory> {
    try {
      if (isEmpty(data) || !data.name) {
        throw new BadRequestException('Category name is required', 'MISSING_CATEGORY_NAME');
      }

      const trimmedName = data.name.trim();
      const existing = await this.categories.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } });
      if (existing) {
        throw new ConflictException('Product category name already exists', 'CATEGORY_NAME_EXISTS');
      }

      const slug = await this.generateUniqueSlug(trimmedName);

      const created = await this.categories.create({
        ...data,
        name: trimmedName,
        slug,
      });

      logger.info(`ProductCategoriesService.create: created category ${created._id} (${slug})`);
      return created.toObject() as ProductCategory;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ProductCategoriesService.create', {
        duplicateMessage: 'A product category with this name or slug already exists.',
        fallbackMessage: 'Unable to create product category at this time.',
        logMeta: { data },
      });
    }
  }

  /* ───────── Read ───────── */

  public async getAllProductCategories(opts: { activeOnly?: boolean } = {}): Promise<ProductCategory[]> {
    try {
      const filter: any = {};
      if (opts.activeOnly) filter.isActive = true;
      const cats = await this.categories.find(filter).sort({ displayOrder: 1, name: 1 }).lean();
      return cats as ProductCategory[];
    } catch (error) {
      handleMongooseError(error, 'ProductCategoriesService.getAll', {
        fallbackMessage: 'Unable to retrieve product categories.',
      });
    }
  }

  public async getProductCategoryById(id: string): Promise<ProductCategory> {
    try {
      if (isEmpty(id)) throw new BadRequestException('Category ID is required', 'MISSING_CATEGORY_ID');
      const cat = await this.categories.findById(id).lean();
      if (!cat) throw new NotFoundException('Product category not found', 'CATEGORY_NOT_FOUND');
      return cat as ProductCategory;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ProductCategoriesService.getById', {
        castMessage: 'Invalid product category ID format',
        fallbackMessage: 'Unable to retrieve product category.',
        logMeta: { id },
      });
    }
  }

  public async searchProductCategories(query: string): Promise<ProductCategory[]> {
    try {
      if (isEmpty(query)) throw new BadRequestException('Search query is required', 'MISSING_QUERY');
      const cats = await this.categories
        .find({ name: { $regex: query, $options: 'i' } })
        .sort({ displayOrder: 1, name: 1 })
        .lean();
      return cats as ProductCategory[];
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ProductCategoriesService.search', {
        fallbackMessage: 'Unable to search product categories.',
        logMeta: { query },
      });
    }
  }

  /* ───────── Update ───────── */

  public async updateProductCategory(id: string, data: UpdateProductCategoryDto): Promise<ProductCategory> {
    try {
      if (isEmpty(id) || isEmpty(data)) {
        throw new BadRequestException('Category ID and update payload are required', 'MISSING_REQUIRED_FIELDS');
      }

      const update: any = { ...data };

      if (data.name) {
        const trimmedName = data.name.trim();
        const dupe = await this.categories.findOne({
          name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
          _id: { $ne: id },
        });
        if (dupe) throw new ConflictException('Product category name already exists', 'CATEGORY_NAME_EXISTS');
        update.name = trimmedName;
        update.slug = await this.generateUniqueSlug(trimmedName, id);
      }

      const updated = await this.categories.findByIdAndUpdate(id, update, { new: true }).lean();
      if (!updated) throw new NotFoundException('Product category not found', 'CATEGORY_NOT_FOUND');

      logger.info(`ProductCategoriesService.update: updated category ${id}`);
      return updated as ProductCategory;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ProductCategoriesService.update', {
        duplicateMessage: 'A product category with this name or slug already exists.',
        castMessage: 'Invalid product category ID format',
        fallbackMessage: 'Unable to update product category.',
        logMeta: { id, data },
      });
    }
  }

  /* ───────── Delete ───────── */

  public async deleteProductCategory(id: string): Promise<ProductCategory> {
    try {
      if (isEmpty(id)) throw new BadRequestException('Category ID is required', 'MISSING_CATEGORY_ID');

      const usage = await this.checkCategoryUsage(id);
      if (usage > 0) {
        throw new ConflictException(
          `Cannot delete category — it is currently used by ${usage} product${usage === 1 ? '' : 's'}. Reassign or hide the category instead.`,
          'CATEGORY_IN_USE',
        );
      }

      const deleted = await this.categories.findByIdAndDelete(id).lean();
      if (!deleted) throw new NotFoundException('Product category not found', 'CATEGORY_NOT_FOUND');

      logger.info(`ProductCategoriesService.delete: deleted category ${id}`);
      return deleted as ProductCategory;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleMongooseError(error, 'ProductCategoriesService.delete', {
        castMessage: 'Invalid product category ID format',
        fallbackMessage: 'Unable to delete product category.',
        logMeta: { id },
      });
    }
  }

  /* ───────── Helpers ───────── */

  /** Count how many products currently reference a category. Dynamic import avoids cyclic deps. */
  private async checkCategoryUsage(categoryId: string): Promise<number> {
    try {
      const productModel = (await import('@systems/MarketplaceSystem/models/product.model')).default;
      return productModel.countDocuments({ categoryId });
    } catch (error) {
      logger.error(`ProductCategoriesService.checkCategoryUsage: ${error?.message || error}`);
      return 0;
    }
  }

  /** Idempotent existence check used by product create/update validation. */
  public async assertCategoryExists(categoryId: string): Promise<void> {
    const exists = await this.categories.exists({ _id: categoryId });
    if (!exists) {
      throw new BadRequestException('The specified product category does not exist', 'INVALID_CATEGORY_ID');
    }
  }
}

export default ProductCategoriesService;
