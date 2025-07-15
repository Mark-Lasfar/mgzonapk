import { NextRequest, NextResponse } from 'next/server';
import Score from '@/lib/db/models/score.model';
import User from '@/lib/db/models/user.model';
import { connectToDatabase } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    await connectToDatabase();
    const { username } = params;

    const user = await User.findOne({ name: username });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const score = await Score.findOne({ user: user._id })
      .sort({ score: -1 })
      .select('score date');

    if (!score) {
      return NextResponse.json({ error: 'No score found for user' }, { status: 404 });
    }

    return NextResponse.json({
      username: user.name,
      score: score.score,
      date: score.date.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching user score:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}