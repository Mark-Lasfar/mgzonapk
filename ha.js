const bcrypt = require('bcryptjs');

const password = 'elasfar691458';
const hashedPassword = '$2a$10$83X3Lqw11MTi2cKj1bIJGuciqgQGL6jOOtJ6clSFMt4vroBevmg3u';

bcrypt.compare(password, hashedPassword).then(isMatch => {
  console.log('Password match:', isMatch);
});