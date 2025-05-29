import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import WebhookModel from '@/lib/db/models/webhook.model'
import { auth } from '@/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()

    await connectToDatabase()

    const webhook = await WebhookModel.create({
      userId: session.user.id,
      url: body.url,
      events: body.events,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: webhook._id,
        url: webhook.url,
        events: webhook.events,
        secret: webhook.secret,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await connectToDatabase()

    const webhooks = await WebhookModel.find({
      userId: session.user.id,
    }).select('-secret')

    return NextResponse.json({
      success: true,
      data: webhooks,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    )
  }
}