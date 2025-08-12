#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack';
import { AwsomeStoreApiStack } from '../lib/awsome_storeApi-stack';
import { ProductsAppLayersStack } from '../lib/productsAppLayers-stack';
import { EventsDdbStack } from '../lib/eventsDdb-stack';
import { OrdersAppLayersStack } from '../lib/ordersAppLayers-stack';
import { OrdersAppStack } from '../lib/ordersApp-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const tags = {
  cost: "awsome-store",
  team: "Gabriel Eger",
}

const productsAppLayersStack = new ProductsAppLayersStack(app, 'ProductsAppLayers', {
  tags: tags,
  env: env,
});

const eventsDdbStack = new EventsDdbStack(app, 'EventsDdb', {
  tags: tags,
  env: env,
});

const productsAppStack = new ProductsAppStack(app, 'ProductsApp', {
  eventsDdb: eventsDdbStack.table,
  tags: tags,
  env: env,
});

const ordersAppLayersStack = new OrdersAppLayersStack(app, 'OrdersAppLayers', {
  tags: tags,
  env: env,
});

const ordersAppStack = new OrdersAppStack(app, 'OrdersApp', {
  productsDdb: productsAppStack.productsDdb,
  tags: tags,
  env: env,
});

productsAppStack.addDependency(productsAppLayersStack);
productsAppStack.addDependency(eventsDdbStack);
ordersAppStack.addDependency(ordersAppLayersStack);
ordersAppStack.addDependency(productsAppStack);

const awsomeStoreApiStack = new AwsomeStoreApiStack(app, 'AwsomeStoreApi', {
  productsFetchHandler: productsAppStack.productsFetchHandler,
  productsAdminHandler: productsAppStack.productsAdminHandler,
  ordersHandler: ordersAppStack.ordersHandler,
  tags: tags,
  env: env,
}); 

awsomeStoreApiStack.addDependency(productsAppStack); 
awsomeStoreApiStack.addDependency(ordersAppStack);