import { DynamoDB } from "aws-sdk";
import { Order, OrderProduct, OrderRepository } from "/opt/nodejs/ordersLayer";
import { Product, ProductRepository } from "/opt/nodejs/productsLayer";
import * as AWSXRay from "aws-xray-sdk"
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { CarrierType, OrderProductResponse, OrderRequest, OrderResponse, PaymentType, ShippingType } from "/opt/nodejs/ordersApiLayer";

AWSXRay.captureAWS(require('aws-sdk'));

const ordersDdb = process.env.ORDERS_DDB!;
const productsDdb = process.env.PRODUCTS_DDB!;

const ddbClient = new DynamoDB.DocumentClient();

const orderRepository = new OrderRepository(ddbClient, ordersDdb);
const productRepository = new ProductRepository(ddbClient, productsDdb);

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    const method = event.httpMethod;
    const apiRequestId = event.requestContext.requestId
    const lambdaRequestId = context.awsRequestId;

    console.log(`API Gateway RequestId: ${apiRequestId} - LambdaRequestId: ${lambdaRequestId}`);

    if (method === "GET") {
        if (event.queryStringParameters) {
            const email = event.queryStringParameters?.email;
            const orderId = event.queryStringParameters?.id;

            if (email) {
                if (orderId) {
                    const order = await orderRepository.getOrder(email, orderId);

                    if (!order) {
                        return {
                            statusCode: 404,
                            body: JSON.stringify({ message: "Order not found" })
                        };
                    }

                    return {
                        statusCode: 200,
                        body: JSON.stringify(convertToOrderResponse(order))
                    };
                } else {
                    const orders = await orderRepository.getOrdersByEmail(email);
                    return {
                        statusCode: 200,
                        body: JSON.stringify(orders.map(convertToOrderResponse))
                    };
                }
            }
        } else {
            const orders = await orderRepository.getAllOrders();
            return {
                statusCode: 200,
                body: JSON.stringify(orders.map(convertToOrderResponse))
            };
        }
    } else if (method === "POST") {
        const orderRequest = JSON.parse(event.body!) as OrderRequest;
        orderRequest.email = orderRequest.email.toLowerCase();
        const products = await productRepository.getProductsByIds(orderRequest.productsIds);

        if (products.length !== orderRequest.productsIds.length) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "Some products not found" })
            };
        }

        const order = buildOrder(orderRequest, products);
        const orderCreated = await orderRepository.createOrder(order);

        return {
            statusCode: 201,
            body: JSON.stringify(convertToOrderResponse(orderCreated))
        };
    } else if (method === "DELETE") {
        const email = event.queryStringParameters!.email!;
        const orderId = event.queryStringParameters!.id!;

        const orderDelete = await orderRepository.deleteOrder(email, orderId)

        if (!orderDelete) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "Order not found" })
            };
        }

        return {
            statusCode: 204,
            body: JSON.stringify({})
        };
    }
    
    return {
        statusCode: 405,
        body: JSON.stringify({ message: "Method Not Allowed" }),
    };
}

function convertToOrderResponse (order: Order): OrderResponse {
    const orderProducts: OrderProductResponse[] = []
    order.products.forEach((product) => {
        orderProducts.push({
            code: product.code,
            price: product.price
        })
    })

    const orderResponse: OrderResponse = {
        email: order.pk,
        id: order.sk!,
        createdAt: order.createdAt!,
        billing: {
            payment: order.billing.payment as PaymentType,
            totalPrice: order.billing.totalPrice
        },
        shipping: {
            type: order.shipping.type as ShippingType,
            carrier: order.shipping.carrier as CarrierType
        },
        products: orderProducts
    }

    return orderResponse;
}

function buildOrder(orderRequest: OrderRequest, products: Product[]): Order {
    const orderProducts: OrderProductResponse[] = []
    let totalPrice = 0;

    products.forEach(product => {
        totalPrice += product.price;
        orderProducts.push({
            code: product.code,
            price: product.price
        });
    });

    const order: Order = {
        pk: orderRequest.email,
        billing: {
            payment: orderRequest.payment,
            totalPrice
        },
        shipping: {
            type: orderRequest.shipping.type,
            carrier: orderRequest.shipping.carrier
        },
        products: orderProducts
    }

    return order
}