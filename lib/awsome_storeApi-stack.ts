import * as cdk from 'aws-cdk-lib';
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cwlogs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface AwsomeStoreApiStackProps extends cdk.StackProps {
    productsFetchHandler: lambdaNodeJS.NodejsFunction;
    productsAdminHandler: lambdaNodeJS.NodejsFunction;
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
  
    const productsFetchIntegration = new apigateway.LambdaIntegration(props.productsFetchHandler)

    // /products GET
    const productsResource = api.root.addResource("products");
    productsResource.addMethod("GET", productsFetchIntegration)

    // /products/{id} GET
    const productResource = productsResource.addResource("{id}");
    productResource.addMethod("GET", productsFetchIntegration)

    const productsAdminIntegration = new apigateway.LambdaIntegration(props.productsAdminHandler)

    // /products POST
    productsResource.addMethod("POST", productsAdminIntegration)

    // /products/{id} PUT
    productResource.addMethod("PUT", productsAdminIntegration)

    // /products/{id} DELETE
    productResource.addMethod("DELETE", productsAdminIntegration)
  }
}