/* Create or promote a provider login and link it to a Provider row:
   PRO_EMAIL=you@x.com PRO_PASSWORD=... PRO_PROVIDER_ID=1 npm run pro:create */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/common/password';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.PRO_EMAIL?.trim().toLowerCase();
  const password = process.env.PRO_PASSWORD;
  const providerId = Number(process.env.PRO_PROVIDER_ID);
  if (!email || !password || password.length < 8 || !providerId) {
    throw new Error('Set PRO_EMAIL, PRO_PASSWORD (8+ chars) and PRO_PROVIDER_ID (an existing Provider.id).');
  }
  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider) throw new Error(`No Provider with id ${providerId}. Create one in the admin app first.`);

  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    user = await prisma.user.update({ where: { email }, data: { role: 'PROVIDER' } });
    console.log(`Promoted ${email} to PROVIDER (password unchanged).`);
  } else {
    user = await prisma.user.create({
      data: { email, name: process.env.PRO_NAME ?? provider.name, phone: process.env.PRO_PHONE ?? '0000000000', passwordHash: await hashPassword(password), role: 'PROVIDER' },
    });
    console.log(`Created provider login ${email}.`);
  }
  await prisma.provider.update({ where: { id: providerId }, data: { userId: user.id } });
  console.log(`Linked ${email} to Provider #${providerId} (${provider.name}).`);
}

main().finally(() => prisma.$disconnect());
