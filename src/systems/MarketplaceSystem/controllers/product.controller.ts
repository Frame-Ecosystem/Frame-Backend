import { Response, NextFunction } from 'express';
import { RequestWithUser } from '@systems/AuthSystem/interfaces/auth.interface';
import ProductService from '@systems/MarketplaceSystem/services/product.service';

class ProductController {
  private productService = new ProductService();

  /* ───────── Public / Discovery ───────── */

  public discoverProducts = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { products, total } = await this.productService.discoverProducts(req.query as any);
      res.status(200).json({ data: products, count: total, message: 'Products retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public getProductById = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const product = await this.productService.getProductById(req.params.id);
      res.status(200).json({ data: product, message: 'Product retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public getStoreProducts = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { products, total } = await this.productService.getStoreProducts(req.params.storeId, req.query as any);
      res.status(200).json({ data: products, count: total, message: 'Products retrieved' });
    } catch (error) {
      next(error);
    }
  };

  /* ───────── Owner ───────── */

  public createProduct = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const product = await this.productService.createProduct(req.user._id.toString(), req.body);
      res.status(201).json({ data: product, message: 'Product created' });
    } catch (error) {
      next(error);
    }
  };

  public updateProduct = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const product = await this.productService.updateProduct(req.user._id.toString(), req.params.id, req.body);
      res.status(200).json({ data: product, message: 'Product updated' });
    } catch (error) {
      next(error);
    }
  };

  public uploadImages = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      if (!req.files || !(req.files as Express.Multer.File[]).length) {
        return res.status(400).json({ message: 'No files provided' });
      }
      const product = await this.productService.uploadProductImages(
        req.user._id.toString(),
        req.params.id,
        req.files as Express.Multer.File[],
      );
      res.status(200).json({ data: product, message: 'Images uploaded' });
    } catch (error) {
      next(error);
    }
  };

  public deleteImage = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const product = await this.productService.deleteProductImage(
        req.user._id.toString(),
        req.params.id,
        req.params.publicId,
      );
      res.status(200).json({ data: product, message: 'Image deleted' });
    } catch (error) {
      next(error);
    }
  };

  public deleteProduct = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      await this.productService.deleteProduct(req.user._id.toString(), req.params.id);
      res.status(200).json({ message: 'Product deleted' });
    } catch (error) {
      next(error);
    }
  };

  /* ───────── Admin ───────── */

  public adminGetProducts = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { products, total } = await this.productService.adminGetProducts(req.query as any);
      res.status(200).json({ data: products, count: total, message: 'Products retrieved' });
    } catch (error) {
      next(error);
    }
  };

  public adminUpdateProductStatus = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const product = await this.productService.adminUpdateProductStatus(req.params.id, req.body.status, req.body.reason);
      res.status(200).json({ data: product, message: 'Product status updated' });
    } catch (error) {
      next(error);
    }
  };
}

export default ProductController;
