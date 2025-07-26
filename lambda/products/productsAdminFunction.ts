import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Product, ProductRepository } from "/opt/nodejs/productsLayer";
import { DynamoDB } from "aws-sdk";

const productsDdb = process.env.PRODUCTS_DDB!
const ddbClient = new DynamoDB.DocumentClient();

const productRepository = new ProductRepository(ddbClient, productsDdb);

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    const lambdaRequestId = context.awsRequestId;
    const apiRequestId = event.requestContext.requestId;

    console.log(`API Gateway Request ID: ${apiRequestId} - Lambda Request ID: ${lambdaRequestId}`);

    if (event.resource === "/products") {
        const method = event.httpMethod;
        if (method === "POST") {
            const product = JSON.parse(event.body!) as Product
            const productCreated = await productRepository.createProduct(product);

            return {
                statusCode: 201,
                body: JSON.stringify(productCreated),
                headers: {
                    "Content-Type": "application/json",
                },
            };
        }
    } else if (event.resource === "/products/{id}") {
        const method = event.httpMethod;
        const productId = event.pathParameters!.id;

        if (method === "PUT") {
            const product = JSON.parse(event.body!) as Product;

            try {
                const productUpdated = await productRepository.updateProduct(productId!, product);
                
                return {
                    statusCode: 200,
                    body: JSON.stringify(productUpdated),
                    headers: {
                        "Content-Type": "application/json",
                    },
                };
            } catch (ConditionalCheckFailedException) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ message: `Product with id ${productId} not found` }),
                    headers: {
                        "Content-Type": "application/json",
                    },
                };
            }
        } else if (method === "DELETE") {
            try {
                const deletedProduct = await productRepository.deleteProduct(productId!);

                return {
                    statusCode: 200,
                    body: JSON.stringify(deletedProduct),
                    headers: {
                        "Content-Type": "application/json",
                    },
                };
            } catch (error) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ message: `Product with id ${productId} not found` }),
                    headers: {
                        "Content-Type": "application/json",
                    },
                };
            }
        }
    }

    return {
        statusCode: 405,
        body: JSON.stringify({ message: "Method Not Allowed" }),
        headers: {
            "Content-Type": "application/json",
        },
    };
}