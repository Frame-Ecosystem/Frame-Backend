import mongoose from 'mongoose';
import { BadRequestException, NotFoundException } from '@exceptions/HttpException';
import cartModel from '@systems/MarketplaceSystem/models/cart.model';
import productModel from '@systems/MarketplaceSystem/models/product.model';
import { Cart, ProductStatus } from '@systems/MarketplaceSystem/interfaces/marketplace.interface';

class CartService {
  private carts = cartModel;
  private products = productModel;

  /* ───────── Get Cart ───────── */

  public async getCart(userId: string): Promise<Cart> {
    let cart = await this.carts.findOne({ userId })
      .populate({
        path: 'items.productId',
        select: 'name slug price images stock variants status storeId',
        populate: { path: 'storeId', select: 'name slug status' },
      });

    if (!cart) {
      cart = await this.carts.create({ userId, items: [] });
    }

    return cart;
  }

  /* ───────── Add to Cart ───────── */

  public async addToCart(userId: string, productId: string, quantity: number, variantIndex?: number): Promise<Cart> {
    if (!mongoose.Types.ObjectId.isValid(productId)) throw new BadRequestException('Invalid product ID', 'INVALID_PRODUCT_ID');

    const product = await this.products.findById(productId);
    if (!product) throw new NotFoundException('Product not found', 'PRODUCT_NOT_FOUND');
    if (product.status !== ProductStatus.ACTIVE) throw new BadRequestException('Product is not available', 'PRODUCT_NOT_ACTIVE');

    // Verify stock
    let availableStock = product.stock;
    if (variantIndex !== undefined) {
      if (variantIndex < 0 || variantIndex >= product.variants.length) {
        throw new BadRequestException('Invalid variant', 'INVALID_VARIANT');
      }
      availableStock = product.variants[variantIndex].stock;
    }

    let cart = await this.carts.findOne({ userId });
    if (!cart) {
      cart = await this.carts.create({ userId, items: [] });
    }

    // Check if item already in cart
    const existingIndex = cart.items.findIndex(
      (item: any) =>
        item.productId.toString() === productId &&
        item.variantIndex === variantIndex,
    );

    if (existingIndex >= 0) {
      const newQuantity = (cart.items[existingIndex] as any).quantity + quantity;
      if (newQuantity > availableStock) {
        throw new BadRequestException('Not enough stock', 'INSUFFICIENT_STOCK');
      }
      (cart.items[existingIndex] as any).quantity = newQuantity;
    } else {
      if (quantity > availableStock) {
        throw new BadRequestException('Not enough stock', 'INSUFFICIENT_STOCK');
      }
      cart.items.push({
        productId,
        storeId: product.storeId,
        variantIndex,
        quantity,
      } as any);
    }

    await cart.save();
    return this.getCart(userId);
  }

  /* ───────── Update Cart Item ───────── */

  public async updateCartItem(userId: string, productId: string, quantity: number, variantIndex?: number): Promise<Cart> {
    if (!mongoose.Types.ObjectId.isValid(productId)) throw new BadRequestException('Invalid product ID', 'INVALID_PRODUCT_ID');

    const cart = await this.carts.findOne({ userId });
    if (!cart) throw new NotFoundException('Cart not found', 'CART_NOT_FOUND');

    const itemIndex = cart.items.findIndex(
      (item: any) =>
        item.productId.toString() === productId &&
        item.variantIndex === variantIndex,
    );

    if (itemIndex === -1) throw new NotFoundException('Item not in cart', 'ITEM_NOT_FOUND');

    if (quantity === 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      const product = await this.products.findById(productId);
      if (!product) throw new NotFoundException('Product not found', 'PRODUCT_NOT_FOUND');

      let availableStock = product.stock;
      if (variantIndex !== undefined) {
        availableStock = product.variants[variantIndex]?.stock || 0;
      }

      if (quantity > availableStock) {
        throw new BadRequestException('Not enough stock', 'INSUFFICIENT_STOCK');
      }

      (cart.items[itemIndex] as any).quantity = quantity;
    }

    await cart.save();
    return this.getCart(userId);
  }

  /* ───────── Remove from Cart ───────── */

  public async removeFromCart(userId: string, productId: string, variantIndex?: number): Promise<Cart> {
    if (!mongoose.Types.ObjectId.isValid(productId)) throw new BadRequestException('Invalid product ID', 'INVALID_PRODUCT_ID');

    const cart = await this.carts.findOne({ userId });
    if (!cart) throw new NotFoundException('Cart not found', 'CART_NOT_FOUND');

    cart.items = cart.items.filter(
      (item: any) =>
        !(item.productId.toString() === productId && item.variantIndex === variantIndex),
    ) as any;

    await cart.save();
    return this.getCart(userId);
  }

  /* ───────── Clear Cart ───────── */

  public async clearCart(userId: string): Promise<Cart> {
    const cart = await this.carts.findOne({ userId });
    if (!cart) throw new NotFoundException('Cart not found', 'CART_NOT_FOUND');

    cart.items = [] as any;
    await cart.save();
    return cart;
  }
}

export default CartService;
