/**
 * LogiQo MedTech — Demo Seed
 * ─────────────────────────────────────────────────────────────────────────
 * Run:  pnpm --filter @logiqo/db db:seed
 *
 * Seeds realistic data for the DTU Skylab / Rigshospitalet demo:
 *   • 3 tenants (hospital, academic health lab, regional clinic)
 *   • 5 manufacturers
 *   • 8 device categories (hierarchical)
 *   • 20 medical devices
 *   • 9 users (3 per tenant)
 *   • 5 safety alerts (1 critical, 2 high, 2 medium)
 *   • 10 peer annotations across multiple devices
 *   • Alert device links and tenant acknowledgements
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("🌱  Starting demo seed…");

  // ── Tenants ──────────────────────────────────────────────────────────────
  const rigshospitalet = await db.tenant.upsert({
    where:  { slug: "rigshospitalet" },
    update: {},
    create: {
      name:       "Rigshospitalet Copenhagen",
      slug:       "rigshospitalet",
      planTier:   "enterprise",
      baaSignedAt: new Date("2024-01-15"),
      isActive:   true,
      settings:   { region: "dk", currency: "DKK", language: "da" },
    },
  });

  const dtuSkylab = await db.tenant.upsert({
    where:  { slug: "dtu-skylab" },
    update: {},
    create: {
      name:     "DTU Skylab Health",
      slug:     "dtu-skylab",
      planTier: "standard",
      isActive: true,
      settings: { region: "dk", currency: "DKK", language: "en" },
    },
  });

  const athensGeneral = await db.tenant.upsert({
    where:  { slug: "athens-general" },
    update: {},
    create: {
      name:       "Athens General Hospital",
      slug:       "athens-general",
      planTier:   "standard",
      baaSignedAt: new Date("2024-02-01"),
      isActive:   true,
      settings:   { region: "gr", currency: "EUR", language: "en" },
    },
  });

  console.log(`✅  Tenants: ${rigshospitalet.name}, ${dtuSkylab.name}, ${athensGeneral.name}`);

  // ── Manufacturers ─────────────────────────────────────────────────────────
  const stryker = await db.manufacturer.upsert({
    where: { slug: "stryker" },
    update: {},
    create: {
      name: "Stryker Corporation", slug: "stryker",
      countryOfOrigin: "US", websiteUrl: "https://www.stryker.com",
    },
  });

  const medtronic = await db.manufacturer.upsert({
    where: { slug: "medtronic" },
    update: {},
    create: {
      name: "Medtronic", slug: "medtronic",
      countryOfOrigin: "IE", websiteUrl: "https://www.medtronic.com",
    },
  });

  const zimmer = await db.manufacturer.upsert({
    where: { slug: "zimmer-biomet" },
    update: {},
    create: {
      name: "Zimmer Biomet", slug: "zimmer-biomet",
      countryOfOrigin: "US", websiteUrl: "https://www.zimmerbiomet.com",
    },
  });

  const depuy = await db.manufacturer.upsert({
    where: { slug: "depuy-synthes" },
    update: {},
    create: {
      name: "DePuy Synthes (J&J)", slug: "depuy-synthes",
      countryOfOrigin: "US", websiteUrl: "https://www.jnjmedtech.com",
    },
  });

  const smithNephew = await db.manufacturer.upsert({
    where: { slug: "smith-nephew" },
    update: {},
    create: {
      name: "Smith+Nephew", slug: "smith-nephew",
      countryOfOrigin: "GB", websiteUrl: "https://www.smith-nephew.com",
    },
  });

  console.log(`✅  Manufacturers: 5 seeded`);

  // ── Device categories (hierarchical) ─────────────────────────────────────
  const ortho   = await db.deviceCategory.upsert({ where: { code: "ORTHO"   }, update: {}, create: { name: "Orthopedic",                code: "ORTHO"   } });
  const cardiac = await db.deviceCategory.upsert({ where: { code: "CARDIAC" }, update: {}, create: { name: "Cardiac Electrophysiology",  code: "CARDIAC" } });
  const dental  = await db.deviceCategory.upsert({ where: { code: "DENTAL"  }, update: {}, create: { name: "Dental & Maxillofacial",     code: "DENTAL"  } });
  const neuro   = await db.deviceCategory.upsert({ where: { code: "NEURO"   }, update: {}, create: { name: "Neurology",                  code: "NEURO"   } });

  const hip     = await db.deviceCategory.upsert({ where: { code: "ORTHO_HIP"   }, update: {}, create: { name: "Hip Replacement",          code: "ORTHO_HIP",   parentId: ortho.id   } });
  const knee    = await db.deviceCategory.upsert({ where: { code: "ORTHO_KNEE"  }, update: {}, create: { name: "Knee Replacement",         code: "ORTHO_KNEE",  parentId: ortho.id   } });
  const spine   = await db.deviceCategory.upsert({ where: { code: "ORTHO_SPINE" }, update: {}, create: { name: "Spinal Implants",          code: "ORTHO_SPINE", parentId: ortho.id   } });
  const icd     = await db.deviceCategory.upsert({ where: { code: "CARDIAC_ICD" }, update: {}, create: { name: "Implantable Defibrillator", code: "CARDIAC_ICD", parentId: cardiac.id } });

  console.log(`✅  Categories: 8 seeded (4 root, 4 sub)`);

  // ── Devices (20 total) ────────────────────────────────────────────────────
  type DeviceSeed = Parameters<typeof db.device.upsert>[0]["create"] & { sku: string; manufacturerId: string };

  const deviceSeeds: DeviceSeed[] = [
    // ── Hip Replacement (5) ────────────────────────────────────────────────
    {
      sku: "STR-ACCOLADE-II-28", manufacturerId: stryker.id, categoryId: hip.id,
      name: "Accolade II Hip Stem 28mm",
      description: "Tapered wedge cementless hip stem, 28 mm femoral head. Industry-leading primary stability.",
      modelNumber: "ACCII-28", version: "Rev C",
      regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-06-10"),
      materialComposition: { primary: "Ti-6Al-4V", coating: "Hydroxyapatite", finish: "Porous" },
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
    },
    {
      sku: "STR-ACCOLADE-II-32", manufacturerId: stryker.id, categoryId: hip.id,
      name: "Accolade II Hip Stem 32mm",
      description: "Tapered wedge cementless hip stem, 32 mm femoral head.",
      modelNumber: "ACCII-32", version: "Rev C",
      regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-06-10"),
      materialComposition: { primary: "Ti-6Al-4V", coating: "Hydroxyapatite" },
      dimensionsMm: { length: 138, neckAngle: 127 },
      extractionTooling: { required_tools: ["Universal Stem Extractor 4040-1"], proprietary: true },
      sterilizationMethod: "EO Sterilization",
    },
    {
      sku: "ZB-CONTINUUM-28", manufacturerId: zimmer.id, categoryId: hip.id,
      name: "Continuum Acetabular System 28mm",
      description: "Modular acetabular cup system with multi-angle locking.",
      modelNumber: "CONT-CUP-28", version: "v2",
      regulatoryStatus: "recalled", approvalStatus: "approved", approvedAt: new Date("2022-01-01"),
      materialComposition: { shell: "Ti-6Al-4V", liner: "UHMWPE", head: "CoCrMo" },
      sterilizationMethod: "Gamma Irradiation",
    },
    {
      sku: "DPS-PINNACLE-36", manufacturerId: depuy.id, categoryId: hip.id,
      name: "Pinnacle Hip System 36mm",
      description: "Modular metal-on-polyethylene and ceramic-on-ceramic hip system.",
      modelNumber: "PINN-36", version: "3rd Gen",
      regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-03-20"),
      materialComposition: { shell: "cpTi", liner: "XLPE", head: "CoCrMo" },
      sterilizationMethod: "Gamma Irradiation",
    },
    {
      sku: "SN-POLARSTEM-28", manufacturerId: smithNephew.id, categoryId: hip.id,
      name: "POLARSTEM Cementless Hip Stem 28mm",
      description: "Short-stem design optimised for minimally invasive THA.",
      regulatoryStatus: "approved", approvalStatus: "pending",
      materialComposition: { primary: "Ti-6Al-4V", coating: "HA+TCP" },
      sterilizationMethod: "EO Sterilization",
    },

    // ── Knee Replacement (5) ───────────────────────────────────────────────
    {
      sku: "STR-TRIATHLON-65", manufacturerId: stryker.id, categoryId: knee.id,
      name: "Triathlon Knee System 65mm",
      description: "Fixed-bearing total knee replacement with 5-in-1 compatibility.",
      modelNumber: "TRI-65", version: "Rev B",
      regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-07-01"),
      materialComposition: { femoral: "CoCrMo", tibial: "Ti-6Al-4V", insert: "UHMWPE" },
      dimensionsMm: { width: 65, apLength: 52 },
      extractionTooling: { required_tools: ["Stryker TKA Extraction Set 6560"], proprietary: true },
      sterilizationMethod: "EO Sterilization",
    },
    {
      sku: "STR-TRIATHLON-70", manufacturerId: stryker.id, categoryId: knee.id,
      name: "Triathlon Knee System 70mm",
      description: "Fixed-bearing total knee replacement, large patient sizing.",
      modelNumber: "TRI-70", version: "Rev B",
      regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-07-01"),
      materialComposition: { femoral: "CoCrMo", tibial: "Ti-6Al-4V", insert: "UHMWPE" },
      dimensionsMm: { width: 70, apLength: 57 },
      sterilizationMethod: "EO Sterilization",
    },
    {
      sku: "ZB-PERSONA-65", manufacturerId: zimmer.id, categoryId: knee.id,
      name: "Persona Knee System 65mm",
      description: "Personalised knee replacement with 12 component options.",
      modelNumber: "PER-65",
      regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2022-11-01"),
      materialComposition: { femoral: "CoCrMo", insert: "Vivacit-E HXLPE" },
      sterilizationMethod: "Gamma Irradiation",
    },
    {
      sku: "DPS-ATTUNE-68", manufacturerId: depuy.id, categoryId: knee.id,
      name: "ATTUNE Knee System 68mm",
      description: "Enhanced conformity knee system reducing aseptic loosening.",
      modelNumber: "ATT-68",
      regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-01-15"),
      materialComposition: { femoral: "CoCrMo", insert: "UHMWPE" },
      sterilizationMethod: "EO Sterilization",
    },
    {
      sku: "SN-GENESIS-II-66", manufacturerId: smithNephew.id, categoryId: knee.id,
      name: "GENESIS II Total Knee 66mm",
      description: "Reliable primary TKA system with 30-year clinical follow-up.",
      regulatoryStatus: "approved", approvalStatus: "pending",
      materialComposition: { femoral: "CoCrMo", insert: "UHMWPE" },
      sterilizationMethod: "EO Sterilization",
    },

    // ── Spinal Implants (3) ────────────────────────────────────────────────
    {
      sku: "STR-TRITANIUM-C4", manufacturerId: stryker.id, categoryId: spine.id,
      name: "Tritanium C Cervical Cage 4mm",
      description: "3D-printed porous titanium cervical interbody fusion cage.",
      modelNumber: "TRI-C-4",
      regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-04-01"),
      materialComposition: { primary: "Porous Ti-6Al-4V (Tritanium)" },
      dimensionsMm: { height: 4, footprint: "14x16" },
      sterilizationMethod: "EO Sterilization",
    },
    {
      sku: "DPS-SYNFIX-L4", manufacturerId: depuy.id, categoryId: spine.id,
      name: "SYNFIX Lumbar Fusion System L4-L5",
      description: "Stand-alone ALIF cage with integrated fixation.",
      modelNumber: "SYN-L4L5",
      regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2022-09-01"),
      materialComposition: { primary: "PEEK-OPTIMA", coating: "Titanium plasma spray" },
      sterilizationMethod: "Gamma Irradiation",
    },
    {
      sku: "ZB-TIMBERLINE-L5", manufacturerId: zimmer.id, categoryId: spine.id,
      name: "Timberline Lateral Fusion System L5",
      description: "Expandable lateral interbody cage, reduces subsidence risk.",
      regulatoryStatus: "approved", approvalStatus: "pending",
      materialComposition: { primary: "Ti-6Al-4V" },
      sterilizationMethod: "EO Sterilization",
    },

    // ── Cardiac / ICD (4) ──────────────────────────────────────────────────
    {
      sku: "MDT-VISIA-AF-ICD-3T", manufacturerId: medtronic.id, categoryId: icd.id,
      name: "Visia AF ICD – 3T MRI Compatible",
      description: "Implantable cardioverter defibrillator with atrial fibrillation detection and full-body MRI compatibility.",
      modelNumber: "EV-ICD2",
      regulatoryStatus: "approved", approvalStatus: "pending",
      materialComposition: { housing: "Titanium", connector: "DF-4/IS-4" },
      extractionTooling: {
        required_tools: ["Medtronic Model 2290 Pacing System Analyzer", "IS-4 removal tool"],
        programmer_interface: "Medtronic MyCareLink Smart 25000",
        notes: "DO NOT use non-Medtronic programmers. Device enters safety mode.",
        proprietary: true,
      },
    },
    {
      sku: "MDT-MICRA-AV", manufacturerId: medtronic.id, categoryId: icd.id,
      name: "Micra AV Leadless Pacemaker",
      description: "World's smallest pacemaker — transcatheter delivery, no leads.",
      modelNumber: "MICRA-AV2",
      regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-08-01"),
      materialComposition: { housing: "Titanium", electrodes: "Platinum-Iridium" },
      extractionTooling: {
        retrieval_possible: true,
        required_tools: ["Medtronic Micra Retrieval Tool 2089"],
        notes: "Retrieval within 6 weeks of implant; more complex thereafter.",
        proprietary: true,
      },
    },
    {
      sku: "MDT-AZURE-XT-DR", manufacturerId: medtronic.id, categoryId: cardiac.id,
      name: "Azure XT DR MRI SureScan",
      description: "Dual-chamber pacemaker with conditional MRI compatibility.",
      modelNumber: "W4DR01",
      regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2022-05-01"),
      materialComposition: { housing: "Titanium", connector: "IS-1/IS-1" },
      sterilizationMethod: "EO Sterilization",
    },
    {
      sku: "MDT-EVOQUE-TMVR", manufacturerId: medtronic.id, categoryId: cardiac.id,
      name: "Evoque TMVR System",
      description: "Transcatheter mitral valve replacement for native MR.",
      regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2024-01-10"),
      materialComposition: { frame: "Nitinol", leaflets: "Bovine pericardium" },
    },

    // ── Dental (1) ────────────────────────────────────────────────────────
    {
      sku: "SN-REPLY-3.5", manufacturerId: smithNephew.id, categoryId: dental.id,
      name: "Smith+Nephew Reply Dental Implant 3.5mm",
      description: "Bone-level tapered dental implant for narrow ridges.",
      regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-02-01"),
      materialComposition: { primary: "Grade 4 cpTitanium", surface: "SLA Active" },
      sterilizationMethod: "Gamma Irradiation",
    },

    // ── Neuro (1) ─────────────────────────────────────────────────────────
    {
      sku: "MDT-INFINITY-DBS", manufacturerId: medtronic.id, categoryId: neuro.id,
      name: "Medtronic Infinity DBS System",
      description: "Deep brain stimulation system with directional stimulation for Parkinson's & essential tremor.",
      modelNumber: "INF-DBS-G3",
      regulatoryStatus: "approved", approvalStatus: "pending",
      materialComposition: { housing: "Titanium", leads: "Pt-Ir alloy" },
      extractionTooling: {
        required_tools: ["Medtronic Lead Extender Kit 37087"],
        programmer_interface: "Medtronic Clinician Programmer App 37604",
        proprietary: true,
      },
    },
  ];

  const deviceMap: Record<string, string> = {}; // sku → id

  for (const seed of deviceSeeds) {
    const d = await db.device.upsert({
      where:  { sku_manufacturerId: { sku: seed.sku, manufacturerId: seed.manufacturerId } },
      update: {},
      create: seed,
    });
    deviceMap[seed.sku] = d.id;
  }

  console.log(`✅  Devices: ${deviceSeeds.length} seeded`);

  // ── Users (3 per tenant) ──────────────────────────────────────────────────
  const userDefs = [
    // Rigshospitalet
    {
      tenantId: rigshospitalet.id, auth0UserId: "auth0|seed-rigsh-surgeon-001",
      email: "k.andersen@rigshospitalet.dk", fullName: "Dr. Kristoffer Andersen",
      role: "surgeon", specialty: "Orthopedic Surgery", npiNumber: "DK-1001234",
      isVerifiedClinician: true,
    },
    {
      tenantId: rigshospitalet.id, auth0UserId: "auth0|seed-rigsh-safety-001",
      email: "i.sorensen@rigshospitalet.dk", fullName: "Ingrid Sørensen",
      role: "hospital_safety_officer", isVerifiedClinician: false,
    },
    {
      tenantId: rigshospitalet.id, auth0UserId: "auth0|seed-rigsh-it-001",
      email: "l.petersen@rigshospitalet.dk", fullName: "Lars Petersen",
      role: "it_procurement", isVerifiedClinician: false,
    },
    // DTU Skylab
    {
      tenantId: dtuSkylab.id, auth0UserId: "auth0|seed-dtu-surgeon-001",
      email: "m.nkrumah@dtu.dk", fullName: "Dr. Maria Nkrumah",
      role: "surgeon", specialty: "Cardiac Surgery", npiNumber: "DK-2001567",
      isVerifiedClinician: true,
    },
    {
      tenantId: dtuSkylab.id, auth0UserId: "auth0|seed-dtu-safety-001",
      email: "j.larsen@dtu.dk", fullName: "Jens Larsen",
      role: "hospital_safety_officer", isVerifiedClinician: false,
    },
    {
      tenantId: dtuSkylab.id, auth0UserId: "auth0|seed-dtu-it-001",
      email: "c.hansen@dtu.dk", fullName: "Camilla Hansen",
      role: "it_procurement", isVerifiedClinician: false,
    },
    // Athens General
    {
      tenantId: athensGeneral.id, auth0UserId: "auth0|seed-athens-surgeon-001",
      email: "a.papadopoulos@athens-general.gr", fullName: "Dr. Anastasios Papadopoulos",
      role: "surgeon", specialty: "Orthopedic Surgery", npiNumber: "GR-3001890",
      isVerifiedClinician: true,
    },
    {
      tenantId: athensGeneral.id, auth0UserId: "auth0|seed-athens-safety-001",
      email: "e.stavros@athens-general.gr", fullName: "Eleni Stavros",
      role: "hospital_safety_officer", isVerifiedClinician: false,
    },
    {
      tenantId: athensGeneral.id, auth0UserId: "auth0|seed-athens-it-001",
      email: "n.alexiou@athens-general.gr", fullName: "Nikos Alexiou",
      role: "it_procurement", isVerifiedClinician: false,
    },
  ];

  const userMap: Record<string, string> = {}; // auth0UserId → db id

  for (const u of userDefs) {
    const user = await db.user.upsert({
      where:  { auth0UserId: u.auth0UserId },
      update: {},
      create: {
        tenantId:            u.tenantId,
        auth0UserId:         u.auth0UserId,
        email:               u.email,
        fullName:            u.fullName,
        role:                u.role,
        specialty:           u.specialty ?? null,
        npiNumber:           u.npiNumber ?? null,
        isVerifiedClinician: u.isVerifiedClinician,
        isActive:            true,
      },
    });
    userMap[u.auth0UserId] = user.id;
  }

  console.log(`✅  Users: ${userDefs.length} seeded (3 per tenant)`);

  // ── Safety Alerts (5) ────────────────────────────────────────────────────

  // Delete existing to ensure idempotency (alerts have no natural unique key)
  await db.alertDeviceLink.deleteMany({});
  await db.tenantAlertAcknowledgement.deleteMany({});
  await db.alert.deleteMany({});

  const alertZimmerRecall = await db.alert.create({
    data: {
      alertType:   "recall",
      source:      "FDA MedWatch",
      externalId:  "Z-1234-2024",
      title:       "Voluntary Recall: Zimmer Biomet Continuum Acetabular System",
      summary:     "Potential for early polyethylene wear due to manufacturing variance in lot Z-2024-03. Affected units may require earlier-than-expected revision surgery.",
      fullText:    "FDA has identified this as a Class II recall. The Zimmer Biomet Continuum Acetabular Cup may exhibit accelerated polyethylene wear in patients with high activity levels, resulting from a process deviation in lot Z-2024-03. Hospitals should immediately audit inventory and contact patients implanted with affected devices.",
      severity:    "high",
      affectedSkus: ["ZB-CONTINUUM-28", "ZB-CONTINUUM-32"],
      publishedAt: new Date("2024-03-15"),
      sourceUrl:   "https://www.fda.gov/medical-devices/medical-device-recalls/zimmer-biomet-continuum",
    },
  });

  const alertMicraaBattery = await db.alert.create({
    data: {
      alertType:   "safety_notice",
      source:      "Medtronic",
      externalId:  "MDT-FSN-2024-001",
      title:       "CRITICAL: Medtronic Micra AV — Premature Battery Depletion in Specific Production Lots",
      summary:     "A subset of Micra AV devices from production lots 24B-24E may exhibit premature battery depletion 18–24 months earlier than specification. Immediate remote monitoring activation required.",
      fullText:    "Medtronic has identified a manufacturing process variation affecting lots 24B through 24E of the Micra AV leadless pacemaker. Affected devices may deplete battery capacity at an accelerated rate. All implanting centres must immediately enable remote monitoring for affected patients and schedule follow-up within 30 days.",
      severity:    "critical",
      affectedSkus: ["MDT-MICRA-AV"],
      publishedAt: new Date("2024-02-28"),
      sourceUrl:   "https://www.medtronic.com/safety-notices/micra-battery",
    },
  });

  const alertDepuyPinnacle = await db.alert.create({
    data: {
      alertType:   "hazard_alert",
      source:      "MHRA",
      externalId:  "MHRA-2024-011",
      title:       "DePuy Pinnacle Metal-on-Metal — Elevated Cobalt Ion Monitoring Protocol",
      summary:     "Updated MHRA guidance mandates annual cobalt/chromium blood ion testing for all DePuy Pinnacle MoM articulation patients. Threshold for revision consultation lowered to 4 µg/L.",
      severity:    "high",
      affectedSkus: ["DPS-PINNACLE-36"],
      publishedAt: new Date("2024-01-20"),
      sourceUrl:   "https://www.gov.uk/guidance/metal-on-metal-hip-implants",
    },
  });

  const alertStrykertriathlon = await db.alert.create({
    data: {
      alertType:   "safety_notice",
      source:      "Stryker",
      externalId:  "STR-FSN-2024-002",
      title:       "Stryker Triathlon Knee System — Patellar Clunk Advisory",
      summary:     "Post-market surveillance data indicates a 1.2% rate of patellar clunk syndrome at 12-month follow-up. Review surgical technique for femoral component rotation.",
      severity:    "medium",
      affectedSkus: ["STR-TRIATHLON-65", "STR-TRIATHLON-70"],
      publishedAt: new Date("2024-01-05"),
      sourceUrl:   "https://www.stryker.com/safety-notices/triathlon",
    },
  });

  const alertVisiaFirmware = await db.alert.create({
    data: {
      alertType:   "field_correction",
      source:      "Medtronic",
      externalId:  "MDT-FC-2024-003",
      title:       "Visia AF ICD — Firmware Update v2.3 Required Within 90 Days",
      summary:     "Firmware v2.1 contains a defect in battery depletion detection. Update to v2.3 via in-clinic programmer within 90 days. No out-of-hospital sudden failure risk identified.",
      severity:    "medium",
      affectedSkus: ["MDT-VISIA-AF-ICD-3T"],
      publishedAt: new Date("2024-02-10"),
      sourceUrl:   "https://www.medtronic.com/field-corrections/visia-firmware",
    },
  });

  // Link alerts to devices
  const alertDeviceLinks = [
    { alertId: alertZimmerRecall.id,    deviceId: deviceMap["ZB-CONTINUUM-28"],    matchMethod: "sku_exact" },
    { alertId: alertMicraaBattery.id,   deviceId: deviceMap["MDT-MICRA-AV"],       matchMethod: "sku_exact" },
    { alertId: alertDepuyPinnacle.id,   deviceId: deviceMap["DPS-PINNACLE-36"],    matchMethod: "sku_exact" },
    { alertId: alertStrykertriathlon.id, deviceId: deviceMap["STR-TRIATHLON-65"], matchMethod: "sku_exact" },
    { alertId: alertStrykertriathlon.id, deviceId: deviceMap["STR-TRIATHLON-70"], matchMethod: "sku_exact" },
    { alertId: alertVisiaFirmware.id,   deviceId: deviceMap["MDT-VISIA-AF-ICD-3T"], matchMethod: "sku_exact" },
  ].filter(l => l.deviceId); // guard against missing devices

  for (const link of alertDeviceLinks) {
    await db.alertDeviceLink.create({ data: link });
  }

  // Acknowledge some alerts per tenant (simulate operational state)
  const safetyOfficerRigsh  = userMap["auth0|seed-rigsh-safety-001"];
  const safetyOfficerAthens = userMap["auth0|seed-athens-safety-001"];

  await db.tenantAlertAcknowledgement.create({
    data: {
      alertId:          alertVisiaFirmware.id,
      tenantId:         rigshospitalet.id,
      acknowledgedById: safetyOfficerRigsh,
      notes:            "Firmware updated on all 3 Visia AF ICDs at Rigshospitalet. Completed 2024-02-25.",
    },
  });

  await db.tenantAlertAcknowledgement.create({
    data: {
      alertId:          alertStrykertriathlon.id,
      tenantId:         athensGeneral.id,
      acknowledgedById: safetyOfficerAthens,
      notes:            "Surgical technique review completed with OR team on 2024-01-18.",
    },
  });

  console.log(`✅  Alerts: 5 seeded (1 critical, 2 high, 2 medium) with device links`);

  // ── Annotations (10 peer observations) ────────────────────────────────────
  await db.annotation.deleteMany({});

  const drAndersen = userMap["auth0|seed-rigsh-surgeon-001"];
  const drNkrumah  = userMap["auth0|seed-dtu-surgeon-001"];
  const drPapadopoulos = userMap["auth0|seed-athens-surgeon-001"];

  const annotationDefs = [
    // Accolade II Hip Stem annotations
    {
      deviceId: deviceMap["STR-ACCOLADE-II-28"], tenantId: rigshospitalet.id,
      authorId: drAndersen, annotationType: "operational_friction",
      severity: "medium", title: "Increased subsidence in low bone-density patients",
      body: "Observed 2–3 mm proximal migration at 6-week post-op in 3 patients with T-score below −2.5. All resolved by 12 weeks without intervention. Recommend enhanced radiographic follow-up protocol for osteopenic patients (DEXA < −2.0) and consideration of cemented stem.",
      procedureType: "Primary THA", patientCount: 3, visibility: "platform",
      isPublished: true, reviewedById: drAndersen, reviewedAt: new Date("2024-02-15"),
    },
    {
      deviceId: deviceMap["STR-ACCOLADE-II-28"], tenantId: dtuSkylab.id,
      authorId: drNkrumah, annotationType: "general_observation",
      severity: "low", title: "Excellent primary stability in high-activity patients",
      body: "Reviewed 12 cases at 24 months follow-up. Zero revisions, Harris Hip Score mean 91.2 (SD 4.3). Hydroxyapatite coating demonstrated robust osseointegration on follow-up CT. Strong recommendation for patients under 65 with good bone stock.",
      procedureType: "Primary THA", patientCount: 12, visibility: "platform",
      isPublished: true, reviewedById: drNkrumah, reviewedAt: new Date("2024-01-28"),
    },

    // Visia AF ICD annotations
    {
      deviceId: deviceMap["MDT-VISIA-AF-ICD-3T"], tenantId: dtuSkylab.id,
      authorId: drNkrumah, annotationType: "tooling_anomaly",
      severity: "high", title: "Pocket placement critical for reducing sensing artefacts",
      body: "Placing the ICD pocket 2 cm medial to the standard pectoral position significantly reduced pectoral muscle sensing artefacts in 5/5 consecutive cases. No lead parameter changes at 30-day check. Recommend this technique for all muscular patients (BMI > 28, high muscle mass).",
      procedureType: "ICD Implantation", patientCount: 5, visibility: "platform",
      isPublished: true, reviewedById: drNkrumah, reviewedAt: new Date("2024-03-01"),
    },
    {
      deviceId: deviceMap["MDT-VISIA-AF-ICD-3T"], tenantId: rigshospitalet.id,
      authorId: drAndersen, annotationType: "failure_mode",
      severity: "medium", title: "Lead impedance drift at 6 months — single case report",
      body: "Single case: RV lead impedance increased from 420 Ω to 890 Ω at 6-month follow-up with no clinical symptoms. Device delivered 2 appropriate shocks. Lead repositioned. Post-operative check at 30 days: impedance normalised to 510 Ω. Cause: micro-dislodgement at tricuspid valve level.",
      patientCount: 1, visibility: "tenant",
      isPublished: true, reviewedById: drAndersen, reviewedAt: new Date("2024-02-20"),
    },

    // Triathlon Knee annotations
    {
      deviceId: deviceMap["STR-TRIATHLON-65"], tenantId: athensGeneral.id,
      authorId: drPapadopoulos, annotationType: "operational_friction",
      severity: "high", title: "Patellar clunk syndrome at 4-month follow-up",
      body: "One patient presented with audible and palpable patellar clunk at 4 months, consistent with fibrous tissue impingement at proximal pole of patella. Managed conservatively with physiotherapy; completely resolved at 6-month review. Intraoperative note: additional attention to proximal patellar debridement may reduce incidence.",
      procedureType: "Primary TKA", patientCount: 1, visibility: "platform",
      isPublished: true, reviewedById: drPapadopoulos, reviewedAt: new Date("2024-02-28"),
    },
    {
      deviceId: deviceMap["STR-TRIATHLON-65"], tenantId: rigshospitalet.id,
      authorId: drAndersen, annotationType: "general_observation",
      severity: "low", title: "Superior flexion outcomes vs. previous PS system",
      body: "Comparative review of 18 Triathlon vs. 17 previous PS design: mean flexion at 12 months 128° (Triathlon) vs. 118° (previous). OKS score 42 vs. 38 respectively. Patient satisfaction significantly higher. No difference in complication rate.",
      procedureType: "Primary TKA", patientCount: 35, visibility: "platform",
      isPublished: true, reviewedById: drAndersen, reviewedAt: new Date("2024-01-10"),
    },

    // Micra AV annotations
    {
      deviceId: deviceMap["MDT-MICRA-AV"], tenantId: dtuSkylab.id,
      authorId: drNkrumah, annotationType: "operational_friction",
      severity: "medium", title: "Fluoroscopy time longer than expected in elderly patients",
      body: "In 4 cases with heavily calcified tricuspid valve apparatus, fluoroscopy time was 22–38 min (vs. expected 12–18 min). All implants successful. Recommend pre-operative echocardiographic assessment of tricuspid valve calcification grade. Consider alternative for severe grade III calcification.",
      procedureType: "Micra AV Implant", patientCount: 4, visibility: "platform",
      isPublished: true, reviewedById: drNkrumah, reviewedAt: new Date("2024-03-05"),
    },
    {
      deviceId: deviceMap["MDT-MICRA-AV"], tenantId: athensGeneral.id,
      authorId: drPapadopoulos, annotationType: "general_observation",
      severity: "low", title: "Zero infection rate at 12 months — 8 case series",
      body: "8 consecutive Micra AV implants with 12-month follow-up. Zero pocket-site infections (vs. 2.1% historical rate for transvenous systems at this centre). Patient comfort scores excellent (mean 9.1/10 for activity return). Recommend Micra AV as first-line for pacemaker-dependent patients with previous CIED infection.",
      patientCount: 8, visibility: "platform",
      isPublished: true, reviewedById: drPapadopoulos, reviewedAt: new Date("2024-02-12"),
    },

    // DBS System — pending review
    {
      deviceId: deviceMap["MDT-INFINITY-DBS"], tenantId: dtuSkylab.id,
      authorId: drNkrumah, annotationType: "tooling_anomaly",
      severity: "medium", title: "Directional electrode impedance imbalance — Parkinson's cohort",
      body: "In 2 of 6 patients in our Parkinson's disease cohort, directional electrode segments showed impedance imbalance > 20% between adjacent segments at 3-month follow-up. No adverse events. Medtronic technical support engaged. Re-testing scheduled. Further reporting pending confirmation.",
      patientCount: 6, visibility: "platform",
      isPublished: false, // pending review
    },

    // Pinnacle Hip annotation
    {
      deviceId: deviceMap["DPS-PINNACLE-36"], tenantId: athensGeneral.id,
      authorId: drPapadopoulos, annotationType: "failure_mode",
      severity: "high", title: "Elevated serum cobalt detected at 5-year review",
      body: "Patient 1: serum cobalt 6.8 µg/L, chromium 4.1 µg/L at 5-year follow-up (normal < 4 µg/L). MRI MARS: no pseudotumour. Patient asymptomatic. Enrolled in enhanced monitoring per MHRA 2024 protocol. Revision not yet indicated. Surgeons using this implant should audit their cohort for metal ion levels.",
      patientCount: 1, visibility: "platform",
      isPublished: true, reviewedById: drPapadopoulos, reviewedAt: new Date("2024-01-30"),
    },
  ];

  for (const ann of annotationDefs) {
    await db.annotation.create({ data: { ...ann, version: 1 } as any });
  }

  console.log(`✅  Annotations: ${annotationDefs.length} seeded (9 published, 1 pending review)`);
  console.log(`\n🎉  Seed complete! Database ready for demo.\n`);
  console.log(`Tenant IDs for .env:`);
  console.log(`  RIGSHOSPITALET: ${rigshospitalet.id}`);
  console.log(`  DTU_SKYLAB:     ${dtuSkylab.id}`);
  console.log(`  ATHENS_GENERAL: ${athensGeneral.id}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
