import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import { Construct } from "constructs"

export class ProductsAppStack extends cdk.Stack {
  readonly productsFetchHandler: lambdaNodejs.NodejsFunction
  
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    this.productsFetchHandler = new lambdaNodejs.NodejsFunction(this, "ProductsFetchFunction", {
      functionName: "ProductsFetchFunction",
      entry: "lambda/products/productsFetchFunction.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      bundling: {
        minify: true,
        sourceMap: false,
      },
    })
  }
} 