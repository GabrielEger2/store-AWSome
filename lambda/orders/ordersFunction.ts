import { DynamoDB, SNS } from "aws-sdk";
import { Order, OrderRepository } from "/opt/nodejs/ordersLayer";
import { Product, ProductRepository } from "/opt/nodejs/productsLayer";
import * as AWSXRay from "aws-xray-sdk"
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { CarrierType, OrderProductResponse, OrderRequest, OrderResponse, PaymentType, ShippingType } from "/opt/nodejs/ordersApiLayer";
import { OrderEvent, OrderEventType, Envelope } from "/opt/nodejs/orderEventsLayer";

AWSXRay.captureAWS(require('aws-sdk'));

const ordersDdb = process.env.ORDERS_DDB!;
const productsDdb = process.env.PRODUCTS_DDB!;
const orderEventsTopicArn = process.env.ORDERS_EVENTS_TOPIC_ARN!;

const ddbClient = new DynamoDB.DocumentClient();
const snsClient = new SNS();

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
            const orderId = event.queryStringParameters?.orderId;

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

        const eventResult = await sendOrderEvent(orderCreated, OrderEventType.CREATED, lambdaRequestId);
        console.log(`Order created event sent - OrderId: ${orderCreated.sk} - MessageId: ${eventResult.MessageId}`);

        return {
            statusCode: 201,
            body: JSON.stringify(convertToOrderResponse(orderCreated))
        };
    } else if (method === "DELETE") {
        const email = event.queryStringParameters!.email!;
        const orderId = event.queryStringParameters!.orderId!;

        const orderDelete = await orderRepository.deleteOrder(email, orderId);

        if (!orderDelete) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "Order not found" })
            };
        }

        const eventResult = await sendOrderEvent(orderDelete, OrderEventType.DELETED, lambdaRequestId);
        console.log(`Order deleted event sent - OrderId: ${orderDelete.sk} - MessageId: ${eventResult.MessageId}`);

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

function sendOrderEvent(order: Order, eventType: OrderEventType, lambdaRequestId: string): Promise<SNS.PublishResponse> {
    const productCodes: string[] = []
    order.products?.forEach((product) => {
        productCodes.push(product.code)
    })

    const orderEvent: OrderEvent = {
        email: order.pk,
        orderId: order.sk!,
        billing: order.billing,
        shipping: order.shipping,
        productCodes: productCodes,
        requestId: lambdaRequestId
    };

    const envelope: Envelope = {
        eventType: eventType,
        data: JSON.stringify(orderEvent),
    };

    return snsClient.publish({
        TopicArn: orderEventsTopicArn,
        Message: JSON.stringify(envelope),
        MessageAttributes: {
            eventType: {
                DataType: "String",
                StringValue: eventType
            }
        }
    }).promise();
}

function convertToOrderResponse (order: Order): OrderResponse {
    const orderProducts: OrderProductResponse[] = []
    order.products?.forEach((product) => {
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
        products: orderProducts.length > 0 ? orderProducts : undefined
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