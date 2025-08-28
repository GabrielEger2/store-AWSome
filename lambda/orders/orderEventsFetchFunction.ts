import { DynamoDB } from "aws-sdk";
import * as AWSXray from "aws-xray-sdk";
import { OrderEventDdb, OrderEventRepository } from "/opt/nodejs/orderEventsRepositoryLayer";
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
AWSXray.captureAWS(require('aws-sdk'));

const eventsDdb = process.env.EVENTS_DDB!;

const ddbClient = new DynamoDB.DocumentClient();
const orderEventsRepository = new OrderEventRepository(ddbClient, eventsDdb);

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    const email = event.queryStringParameters!.email!;
    const eventType = event.queryStringParameters!.eventType;

    try {
        if (eventType) {
            const orderEvents = await orderEventsRepository.getOrderEventByEmailAndEventType(email, eventType);
            return {
                statusCode: 200,
                body: JSON.stringify(orderEvents ? convertOrderEvents([orderEvents]) : []),
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            };
        } 

        const orderEvents = await orderEventsRepository.getOrderEventsByEmail(email);
        return {
            statusCode: 200,
            body: JSON.stringify(orderEvents ? convertOrderEvents(orderEvents) : []),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        };
    } catch (error) {
        console.error('Error fetching order events:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal server error' }),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        };
    }
}

function convertOrderEvents(orderEvents: OrderEventDdb[]) {
    return orderEvents.map((event) => {
        return {
            email: event.email,
            createdAt: event.createdAt,
            eventType: event.eventType,
            requestId: event.requestId,
            orderId: event.info.orderId,
            productCodes: event.info.productCodes,
        }
    });
}