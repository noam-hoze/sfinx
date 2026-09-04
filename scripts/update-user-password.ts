import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

// Load environment variables. Default to production (.env) unless --env=dev is passed.
const isDev = process.argv.includes('--env=dev');
const envFile = isDev ? '.env.local' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile), override: true });

async function main() {
  // Extract password from CLI argument (e.g. process.argv[2] or --password=...)
  let password = process.argv.find((arg) => arg.startsWith('--password='))?.split('=')[1];
  let email = process.argv.find((arg) => arg.startsWith('--email='))?.split('=')[1] || 'noam.hoze@gmail.com';

  // If password wasn't passed as --password=..., use first positional argument after script path
  if (!password) {
    const positionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
    if (positionalArgs.length > 0) {
      password = positionalArgs[0];
    }
  }

  if (!password) {
    console.error('❌ Error: Password parameter is required.');
    console.error('\nUsage:');
    console.error('  npx tsx scripts/update-user-password.ts <new_password> [--email=noam.hoze@gmail.com] [--env=prod|dev]');
    console.error('\nExamples:');
    console.error('  npx tsx scripts/update-user-password.ts "StrongPassword123!"');
    console.error('  npx tsx scripts/update-user-password.ts --password="StrongPassword123!" --env=prod');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(`❌ Error: DATABASE_URL is not defined in ${envFile}.`);
    process.exit(1);
  }

  console.log(`🔒 Updating password for user: ${email}`);
  console.log(`🌐 Target environment: ${isDev ? 'Development (.env.local)' : 'Production (.env)'}`);

  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ User '${email}' not found in database.`);
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
      },
    });

    console.log(`✅ Password successfully updated for ${email}.`);
  } catch (err) {
    console.error('❌ Failed to update user password in database:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
