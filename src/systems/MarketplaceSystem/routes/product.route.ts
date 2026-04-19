import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import authMiddleware from '@middlewares/auth.middleware';
import csrfMiddleware from '@middlewares/csrf.middleware';
import validationMiddleware from '@middlewares/validation.middleware';
import { adminMiddleware } from '@middlewares/role.middleware';
import upload from '@middlewares/imageUpload.middleware';
import ProductController from '@systems/MarketplaceSystem/controllers/product.controller';
import { CreateProductDto, UpdateProductDto } from '@systems/MarketplaceSystem/dtos/product.dto';

class ProductRoute implements Routes {
  public path = '/v1/marketplace/products';
  public router = Router();
  public controller = new ProductController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Public / Discovery
    this.router.get('/discover', this.controller.discoverProducts);
    this.router.get('/store/:storeId', this.controller.getStoreProducts);
    this.router.get('/:id', this.controller.getProductById);

    // Authenticated owner
    this.router.post('/', authMiddleware, csrfMiddleware, validationMiddleware(CreateProductDto, 'body'), this.controller.createProduct);
    this.router.put('/:id', authMiddleware, csrfMiddleware, validationMiddleware(UpdateProductDto, 'body'), this.controller.updateProduct);
    this.router.post('/:id/images', authMiddleware, csrfMiddleware, upload.array('images', 10), this.controller.uploadImages);
    this.router.delete('/:id/images/:publicId', authMiddleware, csrfMiddleware, this.controller.deleteImage);
    this.router.delete('/:id', authMiddleware, csrfMiddleware, this.controller.deleteProduct);

    // Admin
    this.router.get('/admin/all', authMiddleware, adminMiddleware, this.controller.adminGetProducts);
    this.router.put('/admin/:id/status', authMiddleware, adminMiddleware, csrfMiddleware, this.controller.adminUpdateProductStatus);
  }
}

export default ProductRoute;
