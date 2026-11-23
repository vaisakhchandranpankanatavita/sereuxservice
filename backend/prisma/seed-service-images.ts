/* Loads the stock service art (assets/services) into the database as each service's image, so the apps get it from the host
   and the admin app can replace it. Skips services that already have an image. Run: npm run seed:service-images */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DIR = join(__dirname, '..', '..', 'assets', 'services');
const FILES: Record<string, string> = {
  plumbing: 'plumbing.png', electrical: 'electrical.png', 'ac repair': 'ac-repair.png', carpentry: 'carpentry.png',
  painting: 'painting.png', cleaning: 'cleaning.png', appliances: 'appliances.png', 'pest control': 'pest-control.png',
};

async function main() {
  for (const s of await prisma.service.findMany({ include: { image: { select: { serviceId: true } } } })) {
    const file = FILES[s.name.trim().toLowerCase()];
    if (!file || s.image) { console.log(`skip ${s.name}${s.image ? ' (has image)' : ' (no stock art)'}`); continue; }
    const data = readFileSync(join(DIR, file));
    await prisma.serviceImage.create({ data: { serviceId: s.id, data, type: 'image/png' } });
    await prisma.service.update({ where: { id: s.id }, data: { imageVersion: Math.floor(Date.now() / 1000) } });
    console.log(`loaded ${s.name} (${Math.round(data.length / 1024)} KB)`);
  }
}

main().finally(() => prisma.$disconnect());
