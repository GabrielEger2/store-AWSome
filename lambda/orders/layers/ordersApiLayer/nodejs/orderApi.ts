export enum PaymentType {
    CASH = "CASH",
    CREDIT_CARD = "CREDIT_CARD",
    PAYPAL = "PAYPAL"
}

export enum ShippingType {
    URGENT = "URGENT",
    ECONOMIC = "ECONOMIC"
}

export enum CarrierType {
    UPS = "UPS",
    FEDEX = "FEDEX"
}

export interface OrderRequest {
    email: string;
    productsIds: string[];
    payment: PaymentType;
    shipping: {
        type: ShippingType;
        carrier: CarrierType;
    }
}

export interface OrderProductResponse {
    code: string;
    price: number;
}

export interface OrderResponse {
    email: string;
    id: string;
    createdAt: number,
    billing: {
        payment: PaymentType,
        totalPrice: number
    }
    shipping: {
        type: ShippingType;
        carrier: CarrierType;
    },
    products: OrderProductResponse[];
}