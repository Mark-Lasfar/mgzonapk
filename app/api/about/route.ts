import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Mock data or fetch from database
    const data = {
      intro: {
        title: 'About MGZon',
        description: 'We are a leading e-commerce platform.',
        integrationsDescription: 'We integrate with top services.',
      },
      developers: [],
      contactInfo: { email: 'support@mgzon.com', socialLinks: [] },
    };
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch about data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Save to database (e.g., MongoDB)
    return NextResponse.json({ message: 'About content updated' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update about data' }, { status: 500 });
  }
}