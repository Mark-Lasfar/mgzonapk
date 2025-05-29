import { NextRequest, NextResponse } from 'next/server';
// import dbConnect from '@/lib/db/client';
import Score from '@/lib/db/models/score.model';
import User from '@/lib/db/models/user.model';
import { connectToDatabase } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const { userId, score } = await request.json();

    if (!userId || !score) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const newScore = new Score({ user: userId, score });
    await newScore.save();

    return NextResponse.json({ message: 'Score saved' }, { status: 201 });
  } catch (error) {
    console.error('Error saving score:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const scores = await Score.find()
      .populate('user', 'name')
      .sort({ score: -1 })
      .limit(5)
      .select('user score date');

    const formattedScores = scores.map((score) => ({
      username: score.user.name,
      score: score.score,
      date: score.date.toISOString(),
    }));

    return NextResponse.json(formattedScores);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}