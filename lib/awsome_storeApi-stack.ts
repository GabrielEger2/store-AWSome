import * as cdk from 'aws-cdk-lib';
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cwlogs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface AwsomeStoreApiStackProps extends cdk.StackProps {
    productsFetchHandler: lambdaNodeJS.NodejsFunction;
    productsAdminHandler: lambdaNodeJS.NodejsFunction;
    ordersHandler: lambdaNodeJS.NodejsFunction;
}

export class AwsomeStoreApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AwsomeStoreApiStackProps) {
    super(scope, id, props);

    const logGroup = new cwlogs.LogGroup(this, "AwsomeStoreApiLogGroup")
    const api = new apigateway.RestApi(this, "AwsomeStoreApi", {
      restApiName: "AwsomeStoreApi",
      cloudWatchRole: true,
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
            httpMethod: true,
            ip: false,
            protocol: true,
            requestTime: true,
            resourcePath: true,
            responseLength: true,
            status: true,
            caller: true,
            user: false,
        }),
      }
    });
  
    this.createProductsService(props, api);
    this.createOrdersService(props, api);
  }

  private createProductsService(props: AwsomeStoreApiStackProps, api: apigateway.RestApi) {
    const productsFetchIntegration = new apigateway.LambdaIntegration(props.productsFetchHandler);

    const productsResource = api.root.addResource("products");
    const productResource = productsResource.addResource("{id}");
    
    // /products GET
    productsResource.addMethod("GET", productsFetchIntegration);

    // /products/{id} GET
    productResource.addMethod("GET", productsFetchIntegration);

    const productsAdminIntegration = new apigateway.LambdaIntegration(props.productsAdminHandler);

    // /products POST
    productsResource.addMethod("POST", productsAdminIntegration);

    // /products/{id} PUT
    productResource.addMethod("PUT", productsAdminIntegration);

    // /products/{id} DELETE
    productResource.addMethod("DELETE", productsAdminIntegration);
  }

  private createOrdersService(props: AwsomeStoreApiStackProps, api: apigateway.RestApi) {
    const ordersIntegration = new apigateway.LambdaIntegration(props.ordersHandler);

    const ordersResource = api.root.addResource("orders");

    // /orders GET
    // /orders?email GET
    // /orders?email&orderId GET
    ordersResource.addMethod('GET', ordersIntegration);
    
    // /orders POST    
    ordersResource.addMethod("POST", ordersIntegration);

    const orderDeletionValidator = new apigateway.RequestValidator(this, 'OrderDeletionValidator', {
      restApi: api,
      requestValidatorName: 'OrderDeletionValidator',
      validateRequestParameters: true
    });

    // /orders?email&orderId DELETE
    ordersResource.addMethod("DELETE", ordersIntegration, {
      requestParameters: {
        'method.request.querystring.orderId': true,
        'method.request.querystring.email': true,
      },
      requestValidator: orderDeletionValidator
    });
  }
}