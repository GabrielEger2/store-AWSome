import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    if (event.resource === "/products") {
      const method = event.httpMethod;
      
      if (method === "GET") {
        const products = [
          { id: 1, name: "Product A", price: 100 },
          { id: 2, name: "Product B", price: 200 },
        ];

        return {
          statusCode: 200,
          body: JSON.stringify(products),
          headers: {
            "Content-Type": "application/json",
          },
        };
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