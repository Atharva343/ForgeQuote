import { PrismaClient, UserRole, RfqStatus, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting ForgeQuote Database Seed ---');

  // 1. Seed standard users for RFQ ownership
  const estimatorRawPassword = process.env.SEED_ESTIMATOR_PASSWORD || 'ForgeQuote@2026';
  const salesHeadRawPassword = process.env.SEED_SALES_HEAD_PASSWORD || 'ForgeQuote@2026';

  const estimatorPasswordHash = await bcrypt.hash(estimatorRawPassword, 10);
  const salesHeadPasswordHash = await bcrypt.hash(salesHeadRawPassword, 10);

  const estimatorUser = await prisma.user.upsert({
    where: { email: 'estimator@forgequote.io' },
    update: {
      passwordHash: estimatorPasswordHash,
      isActive: true,
    },
    create: {
      name: 'Senior Estimator',
      email: 'estimator@forgequote.io',
      passwordHash: estimatorPasswordHash,
      role: UserRole.ESTIMATOR,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'saleshead@forgequote.io' },
    update: {
      passwordHash: salesHeadPasswordHash,
      isActive: true,
    },
    create: {
      name: 'Sales Head',
      email: 'saleshead@forgequote.io',
      passwordHash: salesHeadPasswordHash,
      role: UserRole.SALES_HEAD,
      isActive: true,
    },
  });

  console.log('✓ Users verified');

  // 2. Machine Rates for the supplied sample hourly rates
  const machineRatesData = [
    {
      operationCode: 'MACH-RATE-850',
      operationName: 'Precision Machining',
      machineName: 'Standard CNC Cell (₹850/hr)',
      hourlyRate: new Prisma.Decimal('850.00'),
    },
    {
      operationCode: 'MACH-RATE-1450',
      operationName: 'Heavy Forging Machining',
      machineName: 'Heavy Duty CNC VMC (₹1450/hr)',
      hourlyRate: new Prisma.Decimal('1450.00'),
    },
    {
      operationCode: 'MACH-RATE-950',
      operationName: 'Gear Blank Machining',
      machineName: 'High Precision CNC Turning (₹950/hr)',
      hourlyRate: new Prisma.Decimal('950.00'),
    },
  ];

  for (const mr of machineRatesData) {
    const existing = await prisma.machineRate.findFirst({
      where: { operationCode: mr.operationCode },
    });

    if (existing) {
      await prisma.machineRate.update({
        where: { id: existing.id },
        data: {
          hourlyRate: mr.hourlyRate,
          currency: 'INR',
        },
      });
    } else {
      await prisma.machineRate.create({
        data: {
          operationCode: mr.operationCode,
          operationName: mr.operationName,
          machineName: mr.machineName,
          hourlyRate: mr.hourlyRate,
          currency: 'INR',
          validFrom: new Date('2026-01-01T00:00:00Z'),
        },
      });
    }
  }

  console.log('✓ Machine rates verified');

  // 3. Customers & RFQs data definition
  const seedRfqs = [
    {
      rfqNumber: 'RFQ-2611-014',
      customerName: 'Company B',
      industry: 'Two-wheelers',
      title: 'Rear wheel spindle RFQ',
      partName: 'Rear wheel spindle',
      material: 'EN8',
      grossWeightKg: new Prisma.Decimal('0.61'),
      annualVolume: 180000,
      cycleTimeMinutes: new Prisma.Decimal('3.2'),
      machineCode: 'MACH-RATE-850',
      operationName: 'CNC Spindle Machining',
    },
    {
      rfqNumber: 'RFQ-2611-019',
      customerName: 'Company C',
      industry: 'Tractors',
      title: 'Hydraulic lift arm RFQ',
      partName: 'Hydraulic lift arm',
      material: '40Cr4 forging',
      grossWeightKg: new Prisma.Decimal('4.60'),
      annualVolume: 24000,
      cycleTimeMinutes: new Prisma.Decimal('11.5'),
      machineCode: 'MACH-RATE-1450',
      operationName: 'Forging Arm Machining',
    },
    {
      rfqNumber: 'RFQ-2611-023',
      customerName: 'Company D',
      industry: 'Drivetrains',
      title: 'Gear blank RFQ',
      partName: 'Gear blank',
      material: '20MnCr5',
      grossWeightKg: new Prisma.Decimal('1.48'),
      annualVolume: 60000,
      cycleTimeMinutes: new Prisma.Decimal('4.8'),
      machineCode: 'MACH-RATE-950',
      operationName: 'Gear Blank Turning',
    },
  ];

  for (const item of seedRfqs) {
    // Upsert Customer by name
    let customer = await prisma.customer.findFirst({
      where: { name: item.customerName },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: item.customerName,
          industry: item.industry,
        },
      });
    } else if (customer.industry !== item.industry) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { industry: item.industry },
      });
    }

    // Upsert RFQ
    const rfq = await prisma.rfq.upsert({
      where: { rfqNumber: item.rfqNumber },
      update: {
        title: item.title,
        customerId: customer.id,
        status: RfqStatus.ESTIMATING,
        ownerId: estimatorUser.id,
      },
      create: {
        rfqNumber: item.rfqNumber,
        title: item.title,
        customerId: customer.id,
        status: RfqStatus.ESTIMATING,
        ownerId: estimatorUser.id,
        receivedAt: new Date(),
      },
    });

    // Upsert Part
    let part = await prisma.rfqPart.findFirst({
      where: {
        rfqId: rfq.id,
        partName: item.partName,
      },
    });

    if (!part) {
      part = await prisma.rfqPart.create({
        data: {
          rfqId: rfq.id,
          partName: item.partName,
          material: item.material,
          grossWeightKg: item.grossWeightKg,
          annualVolume: item.annualVolume,
        },
      });
    } else {
      part = await prisma.rfqPart.update({
        where: { id: part.id },
        data: {
          material: item.material,
          grossWeightKg: item.grossWeightKg,
          annualVolume: item.annualVolume,
        },
      });
    }

    // Upsert Routing Operation
    const existingOp = await prisma.routingOperation.findFirst({
      where: {
        partId: part.id,
        sequence: 1,
      },
    });

    if (!existingOp) {
      await prisma.routingOperation.create({
        data: {
          partId: part.id,
          sequence: 1,
          operationName: item.operationName,
          machineCode: item.machineCode,
          setupTimeMinutes: new Prisma.Decimal('0.00'),
          cycleTimeMinutes: item.cycleTimeMinutes,
        },
      });
    } else {
      await prisma.routingOperation.update({
        where: { id: existingOp.id },
        data: {
          operationName: item.operationName,
          machineCode: item.machineCode,
          setupTimeMinutes: new Prisma.Decimal('0.00'),
          cycleTimeMinutes: item.cycleTimeMinutes,
        },
      });
    }

    console.log(`✓ Seeded ${item.rfqNumber}: ${item.partName} (${item.customerName})`);
  }

  console.log('--- ForgeQuote Seed Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Error during seed execution:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

