import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Seed tenant
  const tenant = await db.tenant.upsert({
    where: { slug: "pilot-hospital" },
    update: {},
    create: {
      name: "Pilot Hospital Network",
      slug: "pilot-hospital",
      planTier: "enterprise",
      isActive: true,
    },
  });
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);

  // Seed manufacturers
  const stryker = await db.manufacturer.upsert({
    where: { slug: "stryker" },
    update: {},
    create: {
      name: "Stryker Corporation",
      slug: "stryker",
      countryOfOrigin: "US",
      websiteUrl: "https://www.stryker.com",
    },
  });

  const medtronic = await db.manufacturer.upsert({
    where: { slug: "medtronic" },
    update: {},
    create: {
      name: "Medtronic",
      slug: "medtronic",
      countryOfOrigin: "US",
      websiteUrl: "https://www.medtronic.com",
    },
  });

  const zimmer = await db.manufacturer.upsert({
    where: { slug: "zimmer-biomet" },
    update: {},
    create: {
      name: "Zimmer Biomet",
      slug: "zimmer-biomet",
      countryOfOrigin: "US",
      websiteUrl: "https://www.zimmerbiomet.com",
    },
  });
  console.log(`Manufacturers seeded: ${stryker.name}, ${medtronic.name}, ${zimmer.name}`);

  // Seed device categories
  const orthoCat = await db.deviceCategory.upsert({
    where: { code: "ORTHO" },
    update: {},
    create: { name: "Orthopedic", code: "ORTHO" },
  });

  const cardiacCat = await db.deviceCategory.upsert({
    where: { code: "CARDIAC" },
    update: {},
    create: { name: "Cardiac Electrophysiology", code: "CARDIAC" },
  });

  const hipCat = await db.deviceCategory.upsert({
    where: { code: "ORTHO_HIP" },
    update: {},
    create: {
      name: "Hip Replacement",
      code: "ORTHO_HIP",
      parentId: orthoCat.id,
    },
  });
  console.log("Device categories seeded");

  // Seed sample devices
  await db.device.upsert({
    where: { sku_manufacturerId: { sku: "STR-ACCOLADE-II-28", manufacturerId: stryker.id } },
    update: {},
    create: {
      sku: "STR-ACCOLADE-II-28",
      manufacturerId: stryker.id,
      categoryId: hipCat.id,
      name: "Accolade II Hip Stem 28mm",
      description: "Tapered wedge cementless hip stem, 28mm femoral head",
      modelNumber: "ACCII-28",
      version: "Rev C",
      regulatoryStatus: "approved",
      approvalStatus: "approved",
      materialComposition: {
        primary: "Ti-6Al-4V",
        coating: "Hydroxyapatite",
        finish: "Porous",
      },
      dimensionsMm: { length: 130, neckAngle: 127 },
      extractionTooling: {
        required_tools: ["Stryker Revision Hip System Extractor", "Universal Stem Extractor 4040-1"],
        notes: "Requires T-handle adapter STR-4040-T for sizes 28mm+",
        proprietary: true,
      },
      compatibilityMatrix: {
        compatible_with: ["STR-ACCOLADE-II-LINER", "STR-RESTORATION-MODULAR"],
        incompatible_with: ["ZB-CONTINUUM-STEM"],
      },
      sterilizationMethod: "EO Sterilization",
      approvedById: null,
      approvedAt: new Date(),
    },
  });

  await db.device.upsert({
    where: { sku_manufacturerId: { sku: "MDT-VISIA-AF-ICD-3T", manufacturerId: medtronic.id } },
    update: {},
    create: {
      sku: "MDT-VISIA-AF-ICD-3T",
      manufacturerId: medtronic.id,
      categoryId: cardiacCat.id,
      name: "Visia AF ICD – 3T MRI Compatible",
      description: "Implantable cardioverter defibrillator with atrial fibrillation detection",
      modelNumber: "EV-ICD2",
      regulatoryStatus: "approved",
      approvalStatus: "pending",
      materialComposition: {
        housing: "Titanium",
        connector: "DF-4/IS-4",
      },
      extractionTooling: {
        required_tools: ["Medtronic Model 2290 Pacing System Analyzer", "IS-4 removal tool"],
        programmer_interface: "Medtronic MyCareLink Smart 25000",
        notes: "DO NOT use non-Medtronic programmers. Device will enter safety mode.",
        proprietary: true,
      },
    },
  });
  console.log("Sample devices seeded");

  // Seed a test alert
  await db.alert.create({
    data: {
      alertType: "recall",
      source: "FDA MedWatch",
      externalId: "Z-1234-2024",
      title: "Voluntary Recall: Zimmer Biomet Continuum Acetabular System",
      summary: "Potential for early polyethylene wear due to manufacturing variance in lot Z-2024-03.",
      severity: "high",
      affectedSkus: ["ZB-CONTINUUM-28", "ZB-CONTINUUM-32"],
      publishedAt: new Date("2024-03-15"),
      sourceUrl: "https://www.fda.gov/medical-devices/medical-device-recalls",
    },
  });
  console.log("Sample alert seeded");

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
