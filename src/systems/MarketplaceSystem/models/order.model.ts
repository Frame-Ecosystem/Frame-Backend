import { model, Schema, Document } from 'mongoose';
import { Order, OrderStatus, PaymentMethod, PaymentStatus } from '@systems/MarketplaceSystem/interfaces/marketplace.interface';

const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantIndex: { type: Number },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String, default: '' },
  },
  { _id: false },
);

const shippingAddressSchema = new Schema(
  {
    fullName: { type: String, required: true, maxlength: 100 },
    phone: { type: String, required: true, maxlength: 20 },
    address: { type: String, required: true, maxlength: 300 },
    city: { type: String, required: true, maxlength: 100 },
    state: { type: String, maxlength: 100 },
    zipCode: { type: String, maxlength: 20 },
    notes: { type: String, maxlength: 500 },
  },
  { _id: false },
);

const orderSchema: Schema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    shippingCost: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: Object.values(OrderStatus), default: OrderStatus.PENDING },
    paymentMethod: { type: String, enum: Object.values(PaymentMethod), required: true },
    paymentStatus: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING },
    shippingAddress: { type: shippingAddressSchema, required: true },
    trackingNumber: { type: String, default: '' },
    trackingUrl: { type: String, default: '' },
    notes: { type: String, maxlength: 500, default: '' },
    cancelReason: { type: String, maxlength: 500, default: '' },
    refundReason: { type: String, maxlength: 1000, default: '' },
    refundAmount: { type: Number, min: 0 },
    disputeReason: { type: String, maxlength: 1000, default: '' },
    disputeResolution: { type: String, maxlength: 1000, default: '' },
    estimatedDelivery: { type: Date },
    deliveredAt: { type: Date },
  },
  { timestamps: true },
);

orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ buyerId: 1, createdAt: -1 });
orderSchema.index({ storeId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ buyerId: 1, status: 1 });
orderSchema.index({ storeId: 1, status: 1 });

const orderModel = model<Order & Document>('Order', orderSchema);

export default orderModel;
