import { connectToDatabase } from '@/lib/db';
import User from '@/lib/db/models/user.model';

async function fixUserRoles() {
  try {
    await connectToDatabase();
    const result = await User.updateMany(
      { role: 'user' },
      { $set: { role: 'user' } }
    );
    console.log('Fixed roles:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error fixing roles:', error);
    process.exit(1);
  }
}

fixUserRoles();