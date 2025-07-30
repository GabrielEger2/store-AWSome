import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { ProductRepository } from "/opt/nodejs/productsLayer";
import { DynamoDB } from "aws-sdk";
import * as AWSXRay from "aws-xray-sdk";

AWSXRay.captureAWS(require('aws-sdk'));

const productsDdb = process.env.PRODUCTS_DDB!
const ddbClient = new DynamoDB.DocumentClient();

const productRepository = new ProductRepository(ddbClient, productsDdb);

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    if (event.resource === "/products") {
      const method = event.httpMethod;
      if (method === "GET") {
        try {
          const products = await productRepository.getAllProducts();

          return {
            statusCode: 200,
            body: JSON.stringify(products),
            headers: {
              "Content-Type": "application/json",
            },
          };
        } catch (error) {
          return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal Server Error" }),
            headers: {
              "Content-Type": "application/json",
            },
          };
        }
      } 
    } else if (event.resource === "/products/{id}") { 
      const method = event.httpMethod;

      if (method === "GET") {
        try {
          const productId = event.pathParameters!.id as string;
          const product = await productRepository.getProductById(productId);

          if (!product) {
            return {
              statusCode: 404,
              body: JSON.stringify({ message: `Product with id ${productId} not found` }),
              headers: {
                "Content-Type": "application/json",
              },
            };
          }

          return {
            statusCode: 200,
            body: JSON.stringify(product),
            headers: {
              "Content-Type": "application/json",
            },
          };
        } catch (error) {
          return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal Server Error" }),
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