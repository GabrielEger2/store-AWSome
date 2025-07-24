#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack';
import { AwsomeStoreApiStack } from '../lib/awsome_storeApi-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const tags = {
  cost: "awsome-store",
  team: "Gabriel Eger",
}

const productsAppStack = new ProductsAppStack(app, 'ProductsApp', {
  tags: tags,
  env: env,
});

const awsomeStoreApiStack = new AwsomeStoreApiStack(app, 'AwsomeStoreApi', {
  productsFetchHandler: productsAppStack.productsFetchHandler,
  tags: tags,
  env: env,
}); 

awsomeStoreApiStack.addDependency(productsAppStack); 