import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { v4 as uuid } from "uuid";

export interface OrderProduct {
  code: string;
  price: number;
}

export interface Order {
  pk: string;
  sk?: string;
  createdAt?: number;
  shipping: {
    type: "URGENT" | "ECONOMIC",
    carrier: "UPS" | "FEDEX"
  }
  billing: {
    payment: "CASH" | "CREDIT_CARD" | "PAYPAL",
    totalPrice: number
  },
  products: OrderProduct[]
}

export class OrderRepository {
    private ddbClient: DocumentClient;
    private ordersDdb: string;

    constructor(ddbClient: DocumentClient, ordersDdb: string) {
        this.ddbClient = ddbClient;
        this.ordersDdb = ordersDdb;
    }

    async createOrder(order: Order): Promise<Order> {
        order.sk = `ORDER#${uuid()}`;
        order.createdAt = Date.now();

        await this.ddbClient.put({
            TableName: this.ordersDdb,
            Item: order
        }).promise();

        return order;
    }

    async getAllOrders(): Promise<Order[]> {
        const result = await this.ddbClient.scan({
            TableName: this.ordersDdb
        }).promise();

        return result.Items as Order[];
    }

    async getOrdersByEmail(email: string): Promise<Order[]> {
        const result = await this.ddbClient.query({
            TableName: this.ordersDdb,
            KeyConditionExpression: "pk = :email",
            ExpressionAttributeValues: {
                ":email": email
            }
        }).promise();

        return result.Items as Order[];
    }

    async getOrder(email: string, orderId: string): Promise<Order> {
        const result = await this.ddbClient.get({
            TableName: this.ordersDdb,
            Key: {
                pk: email,
                sk: orderId
            }
        }).promise();

        return result.Item as Order;
    }

    async deleteOrder(email: string, orderId: string): Promise<Order> {
        const result = await this.ddbClient.delete({
            TableName: this.ordersDdb,
            Key: {
                pk: email,
                sk: orderId
            },
            ReturnValues: "ALL_OLD"
        }).promise();

        return result.Attributes as Order;
    }
}