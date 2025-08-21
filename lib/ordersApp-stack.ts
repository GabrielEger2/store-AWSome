import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs'; 
import * as lambdaEventSource from "aws-cdk-lib/aws-lambda-event-sources"

import { Construct } from 'constructs';

interface OrdersAppStackProps extends cdk.StackProps {
  productsDdb: dynamodb.Table;
  eventsDdb: dynamodb.Table;
}

export class OrdersAppStack extends cdk.Stack {
  readonly ordersHandler: lambdaNodeJS.NodejsFunction;

  constructor(scope: Construct, id: string, props: OrdersAppStackProps) {
    super(scope, id, props);

    const ordersDdb = new dynamodb.Table(this, 'OrdersDdb', {
        tableName: 'orders',
        partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const ordersLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersLayerVersionArn');
    const ordersLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersLayerVersionArn', ordersLayerArn);

    const ordersApiLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersApiLayerVersionArn');
    const ordersApiLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersApiLayerVersionArn', ordersApiLayerArn);

    const orderEventsRepositoryLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrderEventsRepositoryLayerVersionArn');
    const orderEventsRepositoryLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrderEventsRepositoryLayerVersionArn', orderEventsRepositoryLayerArn);

    const orderEventsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrderEventsLayerVersionArn');
    const orderEventsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrderEventsLayerVersionArn', orderEventsLayerArn);

    const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsLayerVersionArn');
    const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsLayerVersionArn', productsLayerArn);

    const ordersTopic = new sns.Topic(this, 'OrderEventsTopic', {
        displayName: 'Order events topic',
        topicName: 'order-events'
    });

    this.ordersHandler = new lambdaNodeJS.NodejsFunction(this, 'OrdersFunction', {
        functionName: "OrdersFunction",
        entry: "lambda/orders/ordersFunction.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 512,
        timeout: cdk.Duration.seconds(4),
        bundling: {
          minify: true,
          sourceMap: false, 
        },
        environment: {
            PRODUCTS_DDB: props.productsDdb.tableName,
            ORDERS_DDB: ordersDdb.tableName,
            ORDERS_EVENTS_TOPIC_ARN: ordersTopic.topicArn
        },
        layers: [ordersLayer, productsLayer, ordersApiLayer, orderEventsLayer],
        tracing: lambda.Tracing.ACTIVE,
        insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_333_0,
    })

    ordersDdb.grantReadWriteData(this.ordersHandler);
    props.productsDdb.grantReadData(this.ordersHandler);
    ordersTopic.grantPublish(this.ordersHandler);

    const orderEventsHandler = new lambdaNodeJS.NodejsFunction(this, 'OrderEventsFunction', {
        functionName: "OrderEventsFunction",
        entry: "lambda/orders/orderEventsFunction.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 512,
        timeout: cdk.Duration.seconds(4),
        bundling: {
          minify: true,
          sourceMap: false, 
        },
        environment: {
          EVENTS_DDB: props.eventsDdb.tableName,
        },
        layers: [orderEventsLayer, orderEventsRepositoryLayer],
        tracing: lambda.Tracing.ACTIVE,
        insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_333_0,
    })
    ordersTopic.addSubscription(new subs.LambdaSubscription(orderEventsHandler));

    const eventsDdbPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:PutItem'],
      resources: [props.eventsDdb.tableArn],
      conditions: {
        ['ForAllValues:StringLike']: {
          'dynamodb:LeadingKeys': ['#order_*']
        }
      }
    });

    orderEventsHandler.addToRolePolicy(eventsDdbPolicy);

    const billingHandler = new lambdaNodeJS.NodejsFunction(this, 'BillingFunction', {
      functionName: "BillingFunction",
      entry: "lambda/orders/billingFunction.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(4),
      bundling: {
        minify: true,
        sourceMap: false, 
      },
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_333_0,
    })
    ordersTopic.addSubscription(new subs.LambdaSubscription(billingHandler, {
      filterPolicy: {
        eventType: sns.SubscriptionFilter.stringFilter({
          allowlist: ['ORDER_CREATED']
        })
      }
    }))

    const orderEventsDlq = new sqs.Queue(this, 'OrderEventsDlq', {
      queueName: 'order-events-dlq',
      enforceSSL: false,
      encryption: sqs.QueueEncryption.UNENCRYPTED,
      retentionPeriod: cdk.Duration.days(10)
    })

    const orderEventsQueue = new sqs.Queue(this, 'OrderEventsQueue', {
      queueName: 'order-events',
      enforceSSL: false,
      encryption: sqs.QueueEncryption.UNENCRYPTED,
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: orderEventsDlq
      }
    })

    ordersTopic.addSubscription(new subs.SqsSubscription(orderEventsQueue, {
      filterPolicy: {
        eventType: sns.SubscriptionFilter.stringFilter({
          allowlist: ['ORDER_CREATED']
        })
      }
    }))

    const orderEmailsHandler = new lambdaNodeJS.NodejsFunction(this, 'OrderEmailsFunction', {
      functionName: "OrderEmailsFunction",
      entry: "lambda/orders/orderEmailsFunction.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(4),
      bundling: {
        minify: true,
        sourceMap: false, 
      },
      layers: [orderEventsLayer],
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_333_0,
    })
    orderEmailsHandler.addEventSource(new lambdaEventSource.SqsEventSource(orderEventsQueue, {
      batchSize: 5,
      enabled: true,
      maxBatchingWindow: cdk.Duration.minutes(1)
    }))
    orderEventsQueue.grantConsumeMessages(orderEmailsHandler);
  }
}