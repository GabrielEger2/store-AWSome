import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { v4 as uui } from 'uuid';

export interface Product {
    id: string;
    productName: string;
    code: string;
    price: number;
    model: string;
}

export class ProductRepository {
    private ddbClient: DocumentClient;
    private productsDdb: string;

    constructor(ddbClient: DocumentClient, productsDdb: string) {
        this.ddbClient = ddbClient;
        this.productsDdb = productsDdb;
    }

    async getAllProducts(): Promise<Product[]> {
        const result = await this.ddbClient.scan({
            TableName: this.productsDdb
        }).promise();

        return result.Items as Product[];
    }

    async getProductById(id: string): Promise<Product> {
        const result = await this.ddbClient.get({
            TableName: this.productsDdb,
            Key: { id }
        }).promise();

        if (!result.Item) {
            throw new Error(`Product with id ${id} not found`);
        }

        return result.Item as Product;
    }

    async createProduct(product: Omit<Product, 'id'>): Promise<Product> {
        const newProduct: Product = {
            ...product,
            id: uui()
        };

        await this.ddbClient.put({
            TableName: this.productsDdb,
            Item: newProduct
        }).promise();

        return newProduct;
    }

    async deleteProduct(id: string): Promise<Product> {
        const result = await this.ddbClient.delete({
            TableName: this.productsDdb,
            Key: { id },
            ReturnValues: 'ALL_OLD'
        }).promise();

        if (!result.Attributes) {
            throw new Error(`Product with id ${id} not found`);
        }

        return result.Attributes as Product;
    }

    async updateProduct(id: string, product: Product): Promise<Product> {
        const result = await this.ddbClient.update({
            TableName: this.productsDdb,
            Key: { id },
            ConditionExpression: 'attribute_exists(id)',
            ReturnValues: 'UPDATE_NEW',
            UpdateExpression: 'set productName = :productName, code = :code, price = :price, model = :model',
            ExpressionAttributeValues: {
                ':productName': product.productName,
                ':code': product.code,
                ':price': product.price,
                ':model': product.model
            }
        }).promise();

        if (!result.Attributes) {
            throw new Error(`Product with id ${id} not found`);
        }

        return result.Attributes as Product;
    }
}