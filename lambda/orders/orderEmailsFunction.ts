import { Context, SNSMessage, SQSEvent } from "aws-lambda"
import * as AWSXray from "aws-xray-sdk"
import { AWSError, SES } from "aws-sdk";
import { Envelope, OrderEvent } from "/opt/nodejs/orderEventsLayer";
import { PromiseResult } from "aws-sdk/lib/request";

AWSXray.captureAWS(require("aws-sdk"))

const sesClient = new SES()

export async function handler(event: SQSEvent, context: Context): Promise<void> {
    const promises: Promise<PromiseResult<SES.SendEmailResponse, AWSError>>[] = [];

    event.Records.forEach(async record => {
        const body = JSON.parse(record.body) as SNSMessage;
        promises.push(sendOrderEmail(body));
    });

    await Promise.all(promises);

    return
}

function sendOrderEmail(body: SNSMessage) {
    const envelope = JSON.parse(body.Message) as Envelope;
    const event = JSON.parse(envelope.data) as OrderEvent;

    return sesClient.sendEmail({
        Destination: {
            ToAddresses: [event.email]
        },
        Message: {
            Body: {
                Text: {
                    Charset: "UTF-8",
                    Data: `We have received your order ${event.orderId}, totaling $${event.billing.totalPrice}, and it is currently being processed. Thank you for shopping with us!`
                }
            },
            Subject: {
                Charset: "UTF-8",
                Data: `Order Confirmation - ${event.orderId}`,
            }
        },
        Source: "eger.scheidt@gmail.com",
        ReplyToAddresses: ["eger.scheidt@gmail.com"]
    }).promise()
}
