import { NextFunction, Request, Response } from 'express';
import ProductCategoriesService from '@systems/MarketplaceSystem/services/productCategories.service';
import { CreateProductCategoryDto, UpdateProductCategoryDto } from '@systems/MarketplaceSystem/dtos/productCategories.dto';
import { ProductCategory } from '@systems/MarketplaceSystem/interfaces/productCategory.interface';

class ProductCategoriesController {
  private categoriesService = new ProductCategoriesService();

  /** GET /  — public list. Query `?activeOnly=true` for buyer-facing dropdowns. */
  public getAllProductCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const categories: ProductCategory[] = await this.categoriesService.getAllProductCategories({ activeOnly });
      res.status(200).json({
        data: categories,
        count: categories.length,
        message: 'Product categories retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /search?q=… — public search by name */
  public searchProductCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query: string = (req.query.q as string) || '';
      const categories: ProductCategory[] = await this.categoriesService.searchProductCategories(query);
      res.status(200).json({
        data: categories,
        count: categories.length,
        message: 'Product categories search completed successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /:categoryId — public read */
  public getProductCategoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category: ProductCategory = await this.categoriesService.getProductCategoryById(req.params.categoryId);
      res.status(200).json({ data: category, message: 'Product category retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** POST / — admin only */
  public createProductCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data: CreateProductCategoryDto = req.body;
      const created: ProductCategory = await this.categoriesService.createProductCategory(data);
      res.status(201).json({ data: created, message: 'Product category created successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** PUT /:categoryId — admin only */
  public updateProductCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data: UpdateProductCategoryDto = req.body;
      const updated: ProductCategory = await this.categoriesService.updateProductCategory(req.params.categoryId, data);
      res.status(200).json({ data: updated, message: 'Product category updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  /** DELETE /:categoryId — admin only */
  public deleteProductCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deleted: ProductCategory = await this.categoriesService.deleteProductCategory(req.params.categoryId);
      res.status(200).json({ data: deleted, message: 'Product category deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}

export default ProductCategoriesController;
