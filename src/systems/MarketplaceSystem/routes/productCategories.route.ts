import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import ProductCategoriesController from '@systems/MarketplaceSystem/controllers/productCategories.controller';
import { CreateProductCategoryDto, UpdateProductCategoryDto } from '@systems/MarketplaceSystem/dtos/productCategories.dto';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { adminMiddleware } from '@middlewares/role.middleware';

/**
 * Product Categories — admin CRUD with public reads.
 *
 *  GET    /                  → list (auth) — supports ?activeOnly=true
 *  GET    /search?q=…        → search by name (auth)
 *  GET    /:categoryId       → fetch one (auth)
 *  POST   /                  → create (admin)
 *  PUT    /:categoryId       → update (admin)
 *  DELETE /:categoryId       → delete (admin, blocked if products reference it)
 */
class ProductCategoriesRoute implements Routes {
  public path = '/v1/marketplace/product-categories';
  public router = Router();
  public controller = new ProductCategoriesController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use(authMiddleware);

    // Public reads
    this.router.get('/', this.controller.getAllProductCategories);
    this.router.get('/search', this.controller.searchProductCategories);
    this.router.get('/:categoryId', this.controller.getProductCategoryById);

    // Admin mutations (csrf + validation)
    this.router.post(
      '/',
      adminMiddleware,
      csrfMiddleware,
      validationMiddleware(CreateProductCategoryDto, 'body'),
      this.controller.createProductCategory,
    );

    this.router.put(
      '/:categoryId',
      adminMiddleware,
      csrfMiddleware,
      validationMiddleware(UpdateProductCategoryDto, 'body'),
      this.controller.updateProductCategory,
    );

    this.router.delete('/:categoryId', adminMiddleware, csrfMiddleware, this.controller.deleteProductCategory);
  }
}

export default ProductCategoriesRoute;
