/**
 * LogiQo MedTech — Comprehensive Seed v2
 * ─────────────────────────────────────────────────────────────────────────
 * Run:  pnpm --filter @logiqo/db db:seed
 *
 * Seeds realistic data:
 *   • 3 tenants (hospital, academic health lab, regional clinic)
 *   • 5 manufacturers
 *   • 11 device categories (hierarchical, with specialtyHint for ranking)
 *   • 50 medical devices (20 original + 30 orthopedic additions: shoulder/trauma/foot)
 *   • 10 users across all verification tiers (0-3) and specialties
 *   • 5 safety alerts (1 critical, 2 high, 2 medium)
 *   • 10 annotation tags (device_type, specialty, material, procedure)
 *   • 30 peer annotations with votes, comments, and tags
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("🌱  Starting comprehensive seed v2…");

  // ── Tenants ────────────────────────────────────────────────────────────────
  const rigshospitalet = await db.tenant.upsert({
    where:  { slug: "rigshospitalet" },
    update: {},
    create: {
      name:        "Rigshospitalet Copenhagen",
      slug:        "rigshospitalet",
      planTier:    "enterprise",
      baaSignedAt: new Date("2024-01-15"),
      isActive:    true,
      settings:    { region: "dk", currency: "DKK", language: "da" },
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
      name:        "Athens General Hospital",
      slug:        "athens-general",
      planTier:    "standard",
      baaSignedAt: new Date("2024-02-01"),
      isActive:    true,
      settings:    { region: "gr", currency: "EUR", language: "en" },
    },
  });

  console.log(`✅  Tenants: ${rigshospitalet.name}, ${dtuSkylab.name}, ${athensGeneral.name}`);

  // ── Manufacturers ──────────────────────────────────────────────────────────
  const stryker = await db.manufacturer.upsert({
    where: { slug: "stryker" }, update: {},
    create: { name: "Stryker Corporation", slug: "stryker", countryOfOrigin: "US", websiteUrl: "https://www.stryker.com" },
  });
  const medtronic = await db.manufacturer.upsert({
    where: { slug: "medtronic" }, update: {},
    create: { name: "Medtronic", slug: "medtronic", countryOfOrigin: "IE", websiteUrl: "https://www.medtronic.com" },
  });
  const zimmer = await db.manufacturer.upsert({
    where: { slug: "zimmer-biomet" }, update: {},
    create: { name: "Zimmer Biomet", slug: "zimmer-biomet", countryOfOrigin: "US", websiteUrl: "https://www.zimmerbiomet.com" },
  });
  const depuy = await db.manufacturer.upsert({
    where: { slug: "depuy-synthes" }, update: {},
    create: { name: "DePuy Synthes (J&J)", slug: "depuy-synthes", countryOfOrigin: "US", websiteUrl: "https://www.jnjmedtech.com" },
  });
  const smithNephew = await db.manufacturer.upsert({
    where: { slug: "smith-nephew" }, update: {},
    create: { name: "Smith+Nephew", slug: "smith-nephew", countryOfOrigin: "GB", websiteUrl: "https://www.smith-nephew.com" },
  });

  console.log("✅  Manufacturers: 5 seeded");

  // ── Device categories (with specialtyHint for ranking algorithm) ───────────
  const ortho   = await db.deviceCategory.upsert({ where: { code: "ORTHO"   }, update: { specialtyHint: "orthopedic_surgery" }, create: { name: "Orthopedic",                code: "ORTHO",   specialtyHint: "orthopedic_surgery" } });
  const cardiac = await db.deviceCategory.upsert({ where: { code: "CARDIAC" }, update: { specialtyHint: "cardiology" },          create: { name: "Cardiac Electrophysiology",  code: "CARDIAC", specialtyHint: "cardiology" } });
  const dental  = await db.deviceCategory.upsert({ where: { code: "DENTAL"  }, update: { specialtyHint: "oral_surgery" },         create: { name: "Dental & Maxillofacial",     code: "DENTAL",  specialtyHint: "oral_surgery" } });
  const neuro   = await db.deviceCategory.upsert({ where: { code: "NEURO"   }, update: { specialtyHint: "neurology" },            create: { name: "Neurology",                  code: "NEURO",   specialtyHint: "neurology" } });

  const hip   = await db.deviceCategory.upsert({ where: { code: "ORTHO_HIP"   }, update: { specialtyHint: "orthopedic_surgery" }, create: { name: "Hip Replacement",          code: "ORTHO_HIP",   parentId: ortho.id,   specialtyHint: "orthopedic_surgery" } });
  const knee  = await db.deviceCategory.upsert({ where: { code: "ORTHO_KNEE"  }, update: { specialtyHint: "orthopedic_surgery" }, create: { name: "Knee Replacement",         code: "ORTHO_KNEE",  parentId: ortho.id,   specialtyHint: "orthopedic_surgery" } });
  const spine = await db.deviceCategory.upsert({ where: { code: "ORTHO_SPINE" }, update: { specialtyHint: "orthopedic_surgery" }, create: { name: "Spinal Implants",          code: "ORTHO_SPINE", parentId: ortho.id,   specialtyHint: "orthopedic_surgery" } });
  const icd   = await db.deviceCategory.upsert({ where: { code: "CARDIAC_ICD" }, update: { specialtyHint: "cardiology" },          create: { name: "Implantable Defibrillator", code: "CARDIAC_ICD", parentId: cardiac.id, specialtyHint: "cardiology" } });

  // Phase 4 — additional orthopedic sub-categories
  const shoulder = await db.deviceCategory.upsert({ where: { code: "ORTHO_SHOULDER" }, update: { specialtyHint: "orthopedic_surgery" }, create: { name: "Shoulder Arthroplasty",    code: "ORTHO_SHOULDER", parentId: ortho.id, specialtyHint: "orthopedic_surgery" } });
  const trauma   = await db.deviceCategory.upsert({ where: { code: "ORTHO_TRAUMA"   }, update: { specialtyHint: "orthopedic_surgery" }, create: { name: "Trauma & Fracture Fixation", code: "ORTHO_TRAUMA",   parentId: ortho.id, specialtyHint: "orthopedic_surgery" } });
  const foot     = await db.deviceCategory.upsert({ where: { code: "ORTHO_FOOT"     }, update: { specialtyHint: "orthopedic_surgery" }, create: { name: "Foot & Ankle",              code: "ORTHO_FOOT",     parentId: ortho.id, specialtyHint: "orthopedic_surgery" } });

  console.log("✅  Categories: 11 seeded (4 root, 7 sub) with specialtyHints");

  // ── Devices (20 total) ─────────────────────────────────────────────────────
  type DeviceSeed = Parameters<typeof db.device.upsert>[0]["create"] & { sku: string; manufacturerId: string };

  const deviceSeeds: DeviceSeed[] = [
    // Hip (5)
    { sku: "STR-ACCOLADE-II-28", manufacturerId: stryker.id, categoryId: hip.id, name: "Accolade II Hip Stem 28mm", description: "Tapered wedge cementless hip stem, 28mm femoral head.", modelNumber: "ACCII-28", version: "Rev C", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-06-10"), materialComposition: { primary: "Ti-6Al-4V", coating: "Hydroxyapatite" }, dimensionsMm: { length: 130, neckAngle: 127 }, extractionTooling: { required_tools: ["Universal Stem Extractor 4040-1"], proprietary: true }, sterilizationMethod: "EO Sterilization" },
    { sku: "STR-ACCOLADE-II-32", manufacturerId: stryker.id, categoryId: hip.id, name: "Accolade II Hip Stem 32mm", description: "Tapered wedge cementless hip stem, 32mm femoral head.", modelNumber: "ACCII-32", version: "Rev C", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-06-10"), materialComposition: { primary: "Ti-6Al-4V", coating: "Hydroxyapatite" }, dimensionsMm: { length: 138, neckAngle: 127 }, sterilizationMethod: "EO Sterilization" },
    { sku: "ZB-CONTINUUM-28",    manufacturerId: zimmer.id, categoryId: hip.id, name: "Continuum Acetabular System 28mm", description: "Modular acetabular cup system with multi-angle locking.", modelNumber: "CONT-CUP-28", version: "v2", regulatoryStatus: "recalled", approvalStatus: "approved", approvedAt: new Date("2022-01-01"), materialComposition: { shell: "Ti-6Al-4V", liner: "UHMWPE" }, sterilizationMethod: "Gamma Irradiation" },
    { sku: "DPS-PINNACLE-36",    manufacturerId: depuy.id,  categoryId: hip.id, name: "Pinnacle Hip System 36mm", description: "Modular metal-on-polyethylene and ceramic-on-ceramic hip system.", modelNumber: "PINN-36", version: "3rd Gen", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-03-20"), materialComposition: { shell: "cpTi", liner: "XLPE", head: "CoCrMo" }, sterilizationMethod: "Gamma Irradiation" },
    { sku: "SN-POLARSTEM-28",    manufacturerId: smithNephew.id, categoryId: hip.id, name: "POLARSTEM Cementless Hip Stem 28mm", description: "Short-stem design optimised for minimally invasive THA.", regulatoryStatus: "approved", approvalStatus: "pending", materialComposition: { primary: "Ti-6Al-4V", coating: "HA+TCP" }, sterilizationMethod: "EO Sterilization" },
    // Knee (5)
    { sku: "STR-TRIATHLON-65",   manufacturerId: stryker.id, categoryId: knee.id, name: "Triathlon Knee System 65mm", description: "Fixed-bearing total knee replacement with 5-in-1 compatibility.", modelNumber: "TRI-65", version: "Rev B", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-07-01"), materialComposition: { femoral: "CoCrMo", tibial: "Ti-6Al-4V", insert: "UHMWPE" }, dimensionsMm: { width: 65, apLength: 52 }, extractionTooling: { required_tools: ["Stryker TKA Extraction Set 6560"], proprietary: true }, sterilizationMethod: "EO Sterilization" },
    { sku: "STR-TRIATHLON-70",   manufacturerId: stryker.id, categoryId: knee.id, name: "Triathlon Knee System 70mm", description: "Fixed-bearing total knee replacement, large patient sizing.", modelNumber: "TRI-70", version: "Rev B", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-07-01"), materialComposition: { femoral: "CoCrMo", tibial: "Ti-6Al-4V", insert: "UHMWPE" }, dimensionsMm: { width: 70, apLength: 57 }, sterilizationMethod: "EO Sterilization" },
    { sku: "ZB-PERSONA-65",      manufacturerId: zimmer.id, categoryId: knee.id, name: "Persona Knee System 65mm", description: "Personalised knee replacement with 12 component options.", modelNumber: "PER-65", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2022-11-01"), materialComposition: { femoral: "CoCrMo", insert: "Vivacit-E HXLPE" }, sterilizationMethod: "Gamma Irradiation" },
    { sku: "DPS-ATTUNE-68",      manufacturerId: depuy.id,  categoryId: knee.id, name: "ATTUNE Knee System 68mm", description: "Enhanced conformity knee system reducing aseptic loosening.", modelNumber: "ATT-68", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-01-15"), materialComposition: { femoral: "CoCrMo", insert: "UHMWPE" }, sterilizationMethod: "EO Sterilization" },
    { sku: "SN-GENESIS-II-66",   manufacturerId: smithNephew.id, categoryId: knee.id, name: "GENESIS II Total Knee 66mm", description: "Reliable primary TKA system with 30-year clinical follow-up.", regulatoryStatus: "approved", approvalStatus: "pending", materialComposition: { femoral: "CoCrMo", insert: "UHMWPE" }, sterilizationMethod: "EO Sterilization" },
    // Spine (3)
    { sku: "STR-TRITANIUM-C4",   manufacturerId: stryker.id, categoryId: spine.id, name: "Tritanium C Cervical Cage 4mm", description: "3D-printed porous titanium cervical interbody fusion cage.", modelNumber: "TRI-C-4", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-04-01"), materialComposition: { primary: "Porous Ti-6Al-4V (Tritanium)" }, dimensionsMm: { height: 4, footprint: "14x16" }, sterilizationMethod: "EO Sterilization" },
    { sku: "DPS-SYNFIX-L4",      manufacturerId: depuy.id,  categoryId: spine.id, name: "SYNFIX Lumbar Fusion System L4-L5", description: "Stand-alone ALIF cage with integrated fixation.", modelNumber: "SYN-L4L5", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2022-09-01"), materialComposition: { primary: "PEEK-OPTIMA", coating: "Titanium plasma spray" }, sterilizationMethod: "Gamma Irradiation" },
    { sku: "ZB-TIMBERLINE-L5",   manufacturerId: zimmer.id, categoryId: spine.id, name: "Timberline Lateral Fusion System L5", description: "Expandable lateral interbody cage, reduces subsidence risk.", regulatoryStatus: "approved", approvalStatus: "pending", materialComposition: { primary: "Ti-6Al-4V" }, sterilizationMethod: "EO Sterilization" },
    // Cardiac / ICD (4)
    { sku: "MDT-VISIA-AF-ICD-3T", manufacturerId: medtronic.id, categoryId: icd.id,    name: "Visia AF ICD – 3T MRI Compatible", description: "ICD with AF detection and full-body MRI compatibility.", modelNumber: "EV-ICD2", regulatoryStatus: "approved", approvalStatus: "pending", materialComposition: { housing: "Titanium", connector: "DF-4/IS-4" }, extractionTooling: { required_tools: ["Medtronic 2290 Analyzer"], proprietary: true } },
    { sku: "MDT-MICRA-AV",        manufacturerId: medtronic.id, categoryId: icd.id,    name: "Micra AV Leadless Pacemaker", description: "World's smallest pacemaker — transcatheter, no leads.", modelNumber: "MICRA-AV2", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-08-01"), materialComposition: { housing: "Titanium", electrodes: "Platinum-Iridium" }, extractionTooling: { retrieval_possible: true, required_tools: ["Medtronic Micra Retrieval Tool 2089"], proprietary: true } },
    { sku: "MDT-AZURE-XT-DR",     manufacturerId: medtronic.id, categoryId: cardiac.id, name: "Azure XT DR MRI SureScan", description: "Dual-chamber pacemaker with conditional MRI compatibility.", modelNumber: "W4DR01", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2022-05-01"), materialComposition: { housing: "Titanium", connector: "IS-1/IS-1" }, sterilizationMethod: "EO Sterilization" },
    { sku: "MDT-EVOQUE-TMVR",     manufacturerId: medtronic.id, categoryId: cardiac.id, name: "Evoque TMVR System", description: "Transcatheter mitral valve replacement for native MR.", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2024-01-10"), materialComposition: { frame: "Nitinol", leaflets: "Bovine pericardium" } },
    // Dental (1)
    { sku: "SN-REPLY-3.5",        manufacturerId: smithNephew.id, categoryId: dental.id, name: "Smith+Nephew Reply Dental Implant 3.5mm", description: "Bone-level tapered dental implant for narrow ridges.", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-02-01"), materialComposition: { primary: "Grade 4 cpTitanium", surface: "SLA Active" }, sterilizationMethod: "Gamma Irradiation" },
    // Neuro (2)
    { sku: "MDT-INFINITY-DBS",    manufacturerId: medtronic.id, categoryId: neuro.id, name: "Medtronic Infinity DBS System", description: "Deep brain stimulation with directional stimulation for Parkinson's.", modelNumber: "INF-DBS-G3", regulatoryStatus: "approved", approvalStatus: "pending", materialComposition: { housing: "Titanium", leads: "Pt-Ir alloy" }, extractionTooling: { required_tools: ["Medtronic Lead Extender Kit 37087"], proprietary: true } },
    { sku: "STR-NVIEW-SPINE",     manufacturerId: stryker.id, categoryId: neuro.id, name: "Stryker NView Spinal Navigation System", description: "Intraoperative CT navigation for spinal instrumentation.", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-11-01") },

    // ── Phase 4 additions — 30 orthopedic devices ──────────────────────────────

    // Shoulder Arthroplasty (10)
    { sku: "STR-TORNIER-PERFORM-S", manufacturerId: stryker.id,    categoryId: shoulder.id, name: "Tornier Perform Shoulder System", description: "Anatomic total shoulder arthroplasty with inlay glenoid.", modelNumber: "TPERF-S", version: "Rev B", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-05-01"), materialComposition: { humeral: "CoCrMo", stem: "Ti-6Al-4V", glenoid: "UHMWPE" }, dimensionsMm: { headDiameter: 44, stemLength: 125 }, sterilizationMethod: "EO Sterilization" },
    { sku: "STR-TORNIER-PERFORM-L", manufacturerId: stryker.id,    categoryId: shoulder.id, name: "Tornier Perform Shoulder System Large", description: "Anatomic total shoulder arthroplasty, large humeral head sizing.", modelNumber: "TPERF-L", version: "Rev B", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-05-01"), materialComposition: { humeral: "CoCrMo", stem: "Ti-6Al-4V", glenoid: "UHMWPE" }, dimensionsMm: { headDiameter: 50, stemLength: 140 }, sterilizationMethod: "EO Sterilization" },
    { sku: "ZB-COMPREHENSIVE-RSTA", manufacturerId: zimmer.id,     categoryId: shoulder.id, name: "Comprehensive Reverse Shoulder System", description: "Reverse shoulder arthroplasty for rotator cuff tear arthropathy.", modelNumber: "COMP-RSA", version: "v3", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2022-08-01"), materialComposition: { baseplate: "Ti-6Al-4V", glenosphere: "CoCrMo", humeral: "CoCrMo", insert: "UHMWPE" }, dimensionsMm: { glenosphereDiameter: 36, lateralOffset: 4 }, extractionTooling: { required_tools: ["Zimmer RSA Revision Set 9130"], proprietary: true }, sterilizationMethod: "Gamma Irradiation" },
    { sku: "ZB-SIDUS-STEM-FREE",    manufacturerId: zimmer.id,     categoryId: shoulder.id, name: "Sidus Stem-Free Shoulder System", description: "Stemless anatomic TSA preserving metaphyseal bone stock.", modelNumber: "SIDUS-SF", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-02-14"), materialComposition: { tray: "Ti-6Al-4V", head: "CoCrMo" }, sterilizationMethod: "EO Sterilization" },
    { sku: "DPS-GLOBAL-ICON-44",    manufacturerId: depuy.id,      categoryId: shoulder.id, name: "Global ICON Shoulder System 44mm", description: "Convertible platform shoulder system (anatomic ↔ reverse).", modelNumber: "GICON-44", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-09-01"), materialComposition: { stem: "Ti-6Al-4V", head: "CoCrMo", glenoid: "UHMWPE" }, sterilizationMethod: "EO Sterilization" },
    { sku: "DPS-GLOBAL-ICON-RSA",   manufacturerId: depuy.id,      categoryId: shoulder.id, name: "Global ICON Reverse Shoulder System", description: "Reverse configuration for the Global ICON platform.", modelNumber: "GICON-RSA", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-09-01"), materialComposition: { baseplate: "Ti-6Al-4V", glenosphere: "CoCrMo", insert: "UHMWPE" }, sterilizationMethod: "EO Sterilization" },
    { sku: "SN-CUES-STEMLESS",      manufacturerId: smithNephew.id, categoryId: shoulder.id, name: "CUES Stemless Shoulder System", description: "Stemless humeral component with trabecular titanium anchor.", modelNumber: "CUES-SL", regulatoryStatus: "approved", approvalStatus: "pending", materialComposition: { anchor: "Porous Ti-6Al-4V", head: "CoCrMo" }, sterilizationMethod: "EO Sterilization" },
    { sku: "SN-PROMOS-RSA-36",      manufacturerId: smithNephew.id, categoryId: shoulder.id, name: "PROMOS Reverse Shoulder System 36mm", description: "Reverse shoulder designed for improved ROM and reduced notching.", modelNumber: "PROMOS-RSA-36", regulatoryStatus: "approved", approvalStatus: "pending", materialComposition: { baseplate: "Ti-6Al-4V", glenosphere: "CoCrMo", insert: "UHMWPE" }, sterilizationMethod: "Gamma Irradiation" },
    { sku: "STR-EXACTECH-EQUINOXE",  manufacturerId: stryker.id,   categoryId: shoulder.id, name: "Exactech Equinoxe Shoulder Platform", description: "Shoulder platform enabling intra-operative conversion between anatomic and reverse.", modelNumber: "EQUINOXE-PLAT", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2024-01-20"), materialComposition: { humeral: "Ti-6Al-4V", head: "CoCrMo" }, sterilizationMethod: "EO Sterilization" },
    { sku: "ZB-BIGLIANI-FLATOW",     manufacturerId: zimmer.id,    categoryId: shoulder.id, name: "Bigliani/Flatow Total Shoulder Prosthesis", description: "Third-generation anatomic shoulder with 30+ year clinical data.", modelNumber: "BF-TSA", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2021-06-01"), materialComposition: { stem: "Ti-6Al-4V", head: "CoCrMo", glenoid: "UHMWPE" }, sterilizationMethod: "Gamma Irradiation" },

    // Trauma & Fracture Fixation (10)
    { sku: "DPS-SYNTHES-PFN-A2",    manufacturerId: depuy.id,      categoryId: trauma.id, name: "SYNTHES PFNA-II Proximal Femoral Nail", description: "Intramedullary nail for proximal femoral fractures, helical blade anti-rotation.", modelNumber: "PFNA-II-240", version: "v2", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2022-11-01"), materialComposition: { nail: "Ti-6Al-4V", blade: "Ti-6Al-4V" }, dimensionsMm: { length: 240, diameter: 10 }, sterilizationMethod: "EO Sterilization" },
    { sku: "DPS-SYNTHES-PFN-A3",    manufacturerId: depuy.id,      categoryId: trauma.id, name: "SYNTHES PFNA-III Short Nail 180mm", description: "Short version for stable pertrochanteric fractures.", modelNumber: "PFNA-III-180", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-03-01"), materialComposition: { nail: "Ti-6Al-4V", blade: "Ti-6Al-4V" }, dimensionsMm: { length: 180, diameter: 10 }, sterilizationMethod: "EO Sterilization" },
    { sku: "STR-GAMMA3-NAIL-200",   manufacturerId: stryker.id,   categoryId: trauma.id, name: "Gamma3 Trochanteric Nail 200mm", description: "Third-generation hip nail for intertrochanteric fractures.", modelNumber: "G3N-200", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-01-01"), materialComposition: { nail: "Ti-6Al-4V", lag_screw: "Stainless Steel 316L" }, dimensionsMm: { length: 200, diameter: 11 }, extractionTooling: { required_tools: ["Stryker Universal Nail Extractor 8180"], proprietary: true }, sterilizationMethod: "EO Sterilization" },
    { sku: "STR-TRIGEN-INTERTAN",   manufacturerId: stryker.id,   categoryId: trauma.id, name: "TFN-ADVANCED Proximal Femoral Nail", description: "Helical blade nail system with enhanced rotational stability.", modelNumber: "TFNA-PF", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-06-01"), materialComposition: { primary: "Ti-6Al-4V" }, sterilizationMethod: "EO Sterilization" },
    { sku: "ZB-NATURAL-NAIL-FEM",   manufacturerId: zimmer.id,    categoryId: trauma.id, name: "Natural Nail Femoral System", description: "Anatomically contoured femoral nail matching natural femoral bow.", modelNumber: "NNAT-FEM", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2022-04-01"), materialComposition: { nail: "Ti-6Al-4V" }, sterilizationMethod: "Gamma Irradiation" },
    { sku: "DPS-SYNTHES-VA-LCP",    manufacturerId: depuy.id,      categoryId: trauma.id, name: "VA-LCP Distal Femur Plate", description: "Variable angle locking plate for distal femur fractures.", modelNumber: "VA-LCP-DF", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2022-07-01"), materialComposition: { primary: "Ti-6Al-4V", screws: "Stainless Steel 316L" }, sterilizationMethod: "EO Sterilization" },
    { sku: "STR-EXPERT-TIBIAL-NAIL", manufacturerId: stryker.id,  categoryId: trauma.id, name: "Expert Tibial Nail Reamed", description: "Reamed intramedullary tibia nail for shaft fractures.", modelNumber: "ETN-R-340", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-02-01"), materialComposition: { nail: "Ti-6Al-4V" }, dimensionsMm: { length: 340, diameter: 9 }, sterilizationMethod: "EO Sterilization" },
    { sku: "ZB-PERIARTICULAR-PLATE", manufacturerId: zimmer.id,   categoryId: trauma.id, name: "Periarticular Locking Plate — Proximal Tibia", description: "Multi-axial locking plate for proximal tibial fractures and osteotomies.", modelNumber: "PAP-PT", regulatoryStatus: "approved", approvalStatus: "pending", materialComposition: { primary: "Ti-6Al-4V" }, sterilizationMethod: "Gamma Irradiation" },
    { sku: "SN-TRIGEN-META-NAIL",   manufacturerId: smithNephew.id, categoryId: trauma.id, name: "TRIGEN META-NAIL Cephalomedullary Nail", description: "Single-lag-screw cephalomedullary nail for femoral neck and IT fractures.", modelNumber: "TRIGEN-META", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2022-12-01"), materialComposition: { primary: "Ti-6Al-4V" }, sterilizationMethod: "EO Sterilization" },
    { sku: "DPS-DEPUY-PINNACLE-DF", manufacturerId: depuy.id,      categoryId: trauma.id, name: "SYNTHES LCP Proximal Humerus Plate", description: "Angular-stable plate for 2-, 3-, and 4-part proximal humerus fractures.", modelNumber: "LCP-PH-3.5", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-07-15"), materialComposition: { plate: "Ti-6Al-4V", screws: "Ti-6Al-4V" }, sterilizationMethod: "EO Sterilization" },

    // Foot & Ankle (10)
    { sku: "STR-STAR-ANKLE-3C",     manufacturerId: stryker.id,   categoryId: foot.id, name: "STAR Scandinavian Total Ankle Replacement 3C", description: "Three-component mobile-bearing total ankle arthroplasty.", modelNumber: "STAR-3C", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2022-03-01"), materialComposition: { tibial: "CoCrMo", talar: "CoCrMo", polyethylene: "UHMWPE" }, sterilizationMethod: "EO Sterilization" },
    { sku: "STR-STAR-ANKLE-MOBILE", manufacturerId: stryker.id,   categoryId: foot.id, name: "STAR Ankle Mobile Bearing Revision", description: "Revision insert for STAR 3-component ankle systems.", modelNumber: "STAR-MB-REV", regulatoryStatus: "approved", approvalStatus: "pending", materialComposition: { insert: "UHMWPE" }, sterilizationMethod: "Gamma Irradiation" },
    { sku: "ZB-ZIMMER-TRABECULAR-ANKLE", manufacturerId: zimmer.id, categoryId: foot.id, name: "Zimmer Trabecular Metal Total Ankle System", description: "Trabecular Metal tibia tray for enhanced fixation in TAR.", modelNumber: "TM-ANKLE", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-04-01"), materialComposition: { tibial: "Tantalum/TM", talar: "CoCrMo", insert: "UHMWPE" }, sterilizationMethod: "EO Sterilization" },
    { sku: "DPS-DEPUY-AGILITY-LP",  manufacturerId: depuy.id,     categoryId: foot.id, name: "AGILITY LP Total Ankle Replacement", description: "Low-profile semi-constrained total ankle system.", modelNumber: "AGILITY-LP", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2021-11-01"), materialComposition: { tibial: "Ti-6Al-4V/UHMWPE", talar: "CoCrMo" }, sterilizationMethod: "EO Sterilization" },
    { sku: "SN-REBALANCE-ANKLE",    manufacturerId: smithNephew.id, categoryId: foot.id, name: "REBALANCE Total Ankle System", description: "Fixed-bearing total ankle with anatomic sulcus talar component.", modelNumber: "REBAL-AN", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-08-01"), materialComposition: { tibial: "CoCrMo/UHMWPE", talar: "CoCrMo" }, sterilizationMethod: "EO Sterilization" },
    { sku: "STR-WRIGHT-INBONE-II",  manufacturerId: stryker.id,   categoryId: foot.id, name: "INBONE II Total Ankle System", description: "Modular stem system enabling robust fixation in compromised bone.", modelNumber: "INBONE-II", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2022-06-01"), materialComposition: { tibial: "Cobalt Chrome", talar: "Cobalt Chrome", insert: "UHMWPE" }, extractionTooling: { required_tools: ["INBONE Revision System 2600", "Stem Extractor Set 2601"], proprietary: true }, sterilizationMethod: "EO Sterilization" },
    { sku: "DPS-DEPUY-HINTEGRA",    manufacturerId: depuy.id,     categoryId: foot.id, name: "HINTEGRA Three-Component Ankle Prosthesis", description: "Anatomic three-component design preserving natural kinematics.", modelNumber: "HINTEGRA-3C", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2021-04-01"), materialComposition: { tibial: "Ti-6Al-4V", talar: "CoCrMo", insert: "UHMWPE" }, sterilizationMethod: "EO Sterilization" },
    { sku: "ZB-SALTO-TALARIS",      manufacturerId: zimmer.id,    categoryId: foot.id, name: "Salto Talaris Total Ankle Prosthesis", description: "Fixed-bearing anatomic TAR with proven 10-year survivorship data.", modelNumber: "SALTO-TAL", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2021-01-15"), materialComposition: { tibial: "CoCrMo/UHMWPE", talar: "CoCrMo" }, sterilizationMethod: "Gamma Irradiation" },
    { sku: "SN-INFINITY-ANKLE",     manufacturerId: smithNephew.id, categoryId: foot.id, name: "Infinity Total Ankle System", description: "Short stem tibial component with low-profile design reducing soft tissue disruption.", modelNumber: "INF-ANKLE", regulatoryStatus: "approved", approvalStatus: "pending", materialComposition: { tibial: "Ti-6Al-4V/UHMWPE", talar: "CoCrMo" }, sterilizationMethod: "EO Sterilization" },
    { sku: "STR-PROPHECY-ANKLE-PSI", manufacturerId: stryker.id,  categoryId: foot.id, name: "Prophecy Pre-operative Navigation System — Ankle", description: "Patient-specific cutting guides for total ankle replacement (PSI workflow).", modelNumber: "PROPHECY-ANK", regulatoryStatus: "approved", approvalStatus: "approved", approvedAt: new Date("2023-10-01"), materialComposition: { guides: "Nylon PA12" }, sterilizationMethod: "EO Sterilization" },
  ];

  const deviceMap: Record<string, string> = {};
  for (const seed of deviceSeeds) {
    const d = await db.device.upsert({
      where:  { sku_manufacturerId: { sku: seed.sku, manufacturerId: seed.manufacturerId } },
      update: {},
      create: seed,
    });
    deviceMap[seed.sku] = d.id;
  }
  console.log(`✅  Devices: ${deviceSeeds.length} seeded (${deviceSeeds.filter(d => [shoulder.id, trauma.id, foot.id].includes(d.categoryId)).length} Phase 4 orthopedic additions)`);

  // ── Users (10 across 3 tenants, different tiers and specialties) ───────────
  //   Tier 0: registered, unverified       — read-only
  //   Tier 1: email/domain verified        — flag only
  //   Tier 2: NPI validated                — full participation, 1.0× vote weight
  //   Tier 3: admin trusted contributor    — 1.5× vote weight
  const userDefs = [
    // Rigshospitalet — 4 users
    { tenantId: rigshospitalet.id, auth0UserId: "auth0|seed-rigsh-surgeon-001",
      email: "k.andersen@rigshospitalet.dk", fullName: "Dr. Kristoffer Andersen",
      role: "surgeon", specialty: "orthopedic_surgery", npiNumber: "1234567890", verificationTier: 3 },
    { tenantId: rigshospitalet.id, auth0UserId: "auth0|seed-rigsh-safety-001",
      email: "i.sorensen@rigshospitalet.dk", fullName: "Ingrid Sørensen",
      role: "hospital_safety_officer", specialty: null, verificationTier: 1 },
    { tenantId: rigshospitalet.id, auth0UserId: "auth0|seed-rigsh-it-001",
      email: "l.petersen@rigshospitalet.dk", fullName: "Lars Petersen",
      role: "it_procurement", specialty: null, verificationTier: 0 },
    { tenantId: rigshospitalet.id, auth0UserId: "auth0|seed-rigsh-surgeon-002",
      email: "h.nielsen@rigshospitalet.dk", fullName: "Dr. Hannah Nielsen",
      role: "surgeon", specialty: "cardiology", npiNumber: "1234567891", verificationTier: 2 },
    // DTU Skylab — 3 users
    { tenantId: dtuSkylab.id, auth0UserId: "auth0|seed-dtu-surgeon-001",
      email: "m.nkrumah@dtu.dk", fullName: "Dr. Maria Nkrumah",
      role: "surgeon", specialty: "cardiology", npiNumber: "2001234567", verificationTier: 2 },
    { tenantId: dtuSkylab.id, auth0UserId: "auth0|seed-dtu-safety-001",
      email: "j.larsen@dtu.dk", fullName: "Jens Larsen",
      role: "hospital_safety_officer", specialty: null, verificationTier: 1 },
    { tenantId: dtuSkylab.id, auth0UserId: "auth0|seed-dtu-surgeon-002",
      email: "p.west@dtu.dk", fullName: "Dr. Peter West",
      role: "surgeon", specialty: "neurology", npiNumber: "2001234568", verificationTier: 2 },
    // Athens General — 3 users
    { tenantId: athensGeneral.id, auth0UserId: "auth0|seed-athens-surgeon-001",
      email: "a.papadopoulos@athens-general.gr", fullName: "Dr. Anastasios Papadopoulos",
      role: "surgeon", specialty: "orthopedic_surgery", npiNumber: "3001234567", verificationTier: 2 },
    { tenantId: athensGeneral.id, auth0UserId: "auth0|seed-athens-safety-001",
      email: "e.stavros@athens-general.gr", fullName: "Eleni Stavros",
      role: "hospital_safety_officer", specialty: null, verificationTier: 1 },
    { tenantId: athensGeneral.id, auth0UserId: "auth0|seed-athens-surgeon-002",
      email: "d.costa@athens-general.gr", fullName: "Dr. Dimitra Costa",
      role: "surgeon", specialty: "cardiology", npiNumber: "3001234568", verificationTier: 2 },
  ];

  const userMap: Record<string, string> = {};
  for (const u of userDefs) {
    const user = await db.user.upsert({
      where:  { auth0UserId: u.auth0UserId },
      update: { verificationTier: u.verificationTier, specialty: u.specialty ?? null },
      create: {
        tenantId:         u.tenantId,
        auth0UserId:      u.auth0UserId,
        email:            u.email,
        fullName:         u.fullName,
        role:             u.role,
        specialty:        u.specialty ?? null,
        npiNumber:        (u as any).npiNumber ?? null,
        verificationTier: u.verificationTier,
        isActive:         true,
      },
    });
    userMap[u.auth0UserId] = user.id;
  }
  console.log(`✅  Users: ${userDefs.length} seeded across all verification tiers`);

  // ── Aliases for readability ────────────────────────────────────────────────
  const drAndersen    = userMap["auth0|seed-rigsh-surgeon-001"];   // tier 3, ortho
  const drHannah      = userMap["auth0|seed-rigsh-surgeon-002"];   // tier 2, cardiology
  const ingridSafety  = userMap["auth0|seed-rigsh-safety-001"];    // tier 1, safety officer
  const drNkrumah     = userMap["auth0|seed-dtu-surgeon-001"];     // tier 2, cardiology
  const drPeterWest   = userMap["auth0|seed-dtu-surgeon-002"];     // tier 2, neurology
  const drPapadopoulos= userMap["auth0|seed-athens-surgeon-001"];  // tier 2, ortho
  const drDimitra     = userMap["auth0|seed-athens-surgeon-002"];  // tier 2, cardiology

  // ── Safety Alerts (5) ─────────────────────────────────────────────────────
  await db.alertDeviceLink.deleteMany({});
  await db.tenantAlertAcknowledgement.deleteMany({});
  await db.alert.deleteMany({});

  const alertZimmerRecall = await db.alert.create({
    data: {
      alertType: "recall", source: "FDA MedWatch", externalId: "Z-1234-2024",
      title: "Voluntary Recall: Zimmer Biomet Continuum Acetabular System",
      summary: "Potential for early polyethylene wear due to manufacturing variance in lot Z-2024-03.",
      fullText: "FDA Class II recall. Affected units may require earlier-than-expected revision surgery.",
      severity: "high", affectedSkus: ["ZB-CONTINUUM-28", "ZB-CONTINUUM-32"],
      publishedAt: new Date("2024-03-15"),
      sourceUrl: "https://www.fda.gov/medical-devices/medical-device-recalls/zimmer-biomet-continuum",
    },
  });
  const alertMicraBattery = await db.alert.create({
    data: {
      alertType: "safety_notice", source: "Medtronic", externalId: "MDT-FSN-2024-001",
      title: "CRITICAL: Medtronic Micra AV — Premature Battery Depletion in Specific Production Lots",
      summary: "Lots 24B–24E may exhibit premature battery depletion 18–24 months earlier than specification.",
      severity: "critical", affectedSkus: ["MDT-MICRA-AV"],
      publishedAt: new Date("2024-02-28"),
      sourceUrl: "https://www.medtronic.com/safety-notices/micra-battery",
    },
  });
  const alertDepuyPinnacle = await db.alert.create({
    data: {
      alertType: "hazard_alert", source: "MHRA", externalId: "MHRA-2024-011",
      title: "DePuy Pinnacle Metal-on-Metal — Elevated Cobalt Ion Monitoring Protocol",
      summary: "Updated MHRA guidance mandates annual cobalt/chromium blood ion testing. Threshold lowered to 4 µg/L.",
      severity: "high", affectedSkus: ["DPS-PINNACLE-36"],
      publishedAt: new Date("2024-01-20"),
      sourceUrl: "https://www.gov.uk/guidance/metal-on-metal-hip-implants",
    },
  });
  const alertStrykerTriathlon = await db.alert.create({
    data: {
      alertType: "safety_notice", source: "Stryker", externalId: "STR-FSN-2024-002",
      title: "Stryker Triathlon Knee System — Patellar Clunk Advisory",
      summary: "Post-market surveillance indicates 1.2% rate of patellar clunk syndrome at 12-month follow-up.",
      severity: "medium", affectedSkus: ["STR-TRIATHLON-65", "STR-TRIATHLON-70"],
      publishedAt: new Date("2024-01-05"),
    },
  });
  const alertVisiaFirmware = await db.alert.create({
    data: {
      alertType: "field_correction", source: "Medtronic", externalId: "MDT-FC-2024-003",
      title: "Visia AF ICD — Firmware Update v2.3 Required Within 90 Days",
      summary: "Firmware v2.1 contains a battery depletion detection defect. Update within 90 days.",
      severity: "medium", affectedSkus: ["MDT-VISIA-AF-ICD-3T"],
      publishedAt: new Date("2024-02-10"),
    },
  });

  const alertDeviceLinks = [
    { alertId: alertZimmerRecall.id,     deviceId: deviceMap["ZB-CONTINUUM-28"],     matchMethod: "sku_exact" },
    { alertId: alertMicraBattery.id,     deviceId: deviceMap["MDT-MICRA-AV"],         matchMethod: "sku_exact" },
    { alertId: alertDepuyPinnacle.id,    deviceId: deviceMap["DPS-PINNACLE-36"],      matchMethod: "sku_exact" },
    { alertId: alertStrykerTriathlon.id, deviceId: deviceMap["STR-TRIATHLON-65"],     matchMethod: "sku_exact" },
    { alertId: alertStrykerTriathlon.id, deviceId: deviceMap["STR-TRIATHLON-70"],     matchMethod: "sku_exact" },
    { alertId: alertVisiaFirmware.id,    deviceId: deviceMap["MDT-VISIA-AF-ICD-3T"], matchMethod: "sku_exact" },
  ].filter(l => l.deviceId);
  for (const link of alertDeviceLinks) await db.alertDeviceLink.create({ data: link });

  await db.tenantAlertAcknowledgement.create({
    data: { alertId: alertVisiaFirmware.id, tenantId: rigshospitalet.id, acknowledgedById: ingridSafety,
            notes: "Firmware updated on all 3 Visia AF ICDs. Completed 2024-02-25." },
  });
  console.log("✅  Alerts: 5 seeded with device links + 1 acknowledgement");

  // ── Annotation Tags (10) ───────────────────────────────────────────────────
  const tagDefs = [
    { name: "Ti-6Al-4V",           slug: "ti-6al-4v",            category: "material" },
    { name: "PEEK",                 slug: "peek",                  category: "material" },
    { name: "MRI Compatible",       slug: "mri-compatible",        category: "device_type" },
    { name: "Cementless",           slug: "cementless",            category: "device_type" },
    { name: "Minimally Invasive",   slug: "minimally-invasive",    category: "procedure" },
    { name: "Osteoporosis",         slug: "osteoporosis",          category: "specialty" },
    { name: "Revision Surgery",     slug: "revision-surgery",      category: "procedure" },
    { name: "Cardiology",           slug: "cardiology",            category: "specialty" },
    { name: "Proprietary Tooling",  slug: "proprietary-tooling",   category: "device_type" },
    { name: "Bone Density",         slug: "bone-density",          category: "specialty" },
  ];
  const tagMap: Record<string, string> = {};
  for (const t of tagDefs) {
    const tag = await db.annotationTag.upsert({ where: { slug: t.slug }, update: {}, create: t as any });
    tagMap[t.slug] = tag.id;
  }
  console.log("✅  Annotation tags: 10 seeded");

  // ── Annotations (30, then votes + comments + tags) ─────────────────────────
  await db.annotationFlag.deleteMany({});
  await db.commentVote.deleteMany({});
  await db.comment.deleteMany({});
  await db.annotationVote.deleteMany({});
  await db.annotationTagLink.deleteMany({});
  await db.annotation.deleteMany({});
  // Reset all device annotation counters — annotations were just deleted above,
  // so any stale denormalized counts from a previous seed run must be zeroed.
  await db.device.updateMany({ data: { annotationCount: 0 } });

  type AnnInput = {
    deviceSku: string; tenantId: string; authorId: string;
    annotationType: string; severity?: string; title: string; body: string;
    procedureType?: string; patientCount?: number;
    visibility: "tenant" | "platform"; isPublished: boolean;
    reviewedById?: string; reviewedAt?: Date;
    tags?: string[]; // tag slugs
  };

  const annotationInputs: AnnInput[] = [
    // ── STR-ACCOLADE-II-28 (5) ─────────────────────────────────────────────
    {
      deviceSku: "STR-ACCOLADE-II-28", tenantId: rigshospitalet.id, authorId: drAndersen,
      annotationType: "operational_friction", severity: "medium",
      title: "Increased subsidence in osteopenic patients (T-score < −2.5)",
      body: "Observed 2–3 mm proximal migration at 6-week post-op in 3 patients with T-score below −2.5. All resolved by 12 weeks without intervention. Recommend enhanced radiographic follow-up protocol for osteopenic patients (DEXA < −2.0) and consideration of cemented stem. Supplementary fixation with calcium phosphate graft may be beneficial in borderline cases.",
      procedureType: "Primary THA", patientCount: 3, visibility: "platform",
      isPublished: true, reviewedById: drAndersen, reviewedAt: new Date("2024-02-15"),
      tags: ["cementless", "osteoporosis", "bone-density"],
    },
    {
      deviceSku: "STR-ACCOLADE-II-28", tenantId: dtuSkylab.id, authorId: drNkrumah,
      annotationType: "general_observation", severity: "low",
      title: "Excellent primary stability in high-activity patients under 65",
      body: "Reviewed 12 cases at 24 months follow-up. Zero revisions, Harris Hip Score mean 91.2 (SD 4.3). Hydroxyapatite coating demonstrated robust osseointegration on follow-up CT. Strong recommendation for patients under 65 with good bone stock (T > −1.0). Activity level resumption at 6 months: cycling 91%, light jogging 67%.",
      procedureType: "Primary THA", patientCount: 12, visibility: "platform",
      isPublished: true, reviewedById: drNkrumah, reviewedAt: new Date("2024-01-28"),
      tags: ["cementless", "ti-6al-4v"],
    },
    {
      deviceSku: "STR-ACCOLADE-II-28", tenantId: athensGeneral.id, authorId: drPapadopoulos,
      annotationType: "material_tolerance", severity: "low",
      title: "No corrosion at taper junction at 7-year follow-up",
      body: "Reviewed 5 patients at 7-year post-operative imaging. No visible trunnion corrosion on plain radiograph or CT arthrography in any case. Serum cobalt and chromium within normal limits in all 5 patients (mean Co 0.3 µg/L, Cr 0.2 µg/L). Ti-6Al-4V taper appears durable at medium-term.",
      procedureType: "Primary THA", patientCount: 5, visibility: "platform",
      isPublished: true, reviewedById: drPapadopoulos, reviewedAt: new Date("2024-03-01"),
      tags: ["ti-6al-4v"],
    },
    {
      deviceSku: "STR-ACCOLADE-II-32", tenantId: rigshospitalet.id, authorId: drAndersen,
      annotationType: "tooling_anomaly", severity: "low",
      title: "32mm head extraction requires T-handle adapter — confirm stock pre-op",
      body: "Extraction of 32mm ACCII stem requires T-handle adapter STR-4040-T in addition to the universal extractor. This adapter is frequently absent from revision trays at our centre. Pre-operative kit verification checklist should explicitly include this item. Two near-misses in the last quarter due to missing adapter.",
      procedureType: "Revision THA", patientCount: 2, visibility: "platform",
      isPublished: true, reviewedById: drAndersen, reviewedAt: new Date("2024-02-28"),
      tags: ["proprietary-tooling", "revision-surgery"],
    },
    {
      deviceSku: "STR-ACCOLADE-II-28", tenantId: rigshospitalet.id, authorId: drAndersen,
      annotationType: "failure_mode", severity: "high",
      title: "Periprosthetic fracture at 3 weeks — atypical femoral morphology",
      body: "Single case: patient with Dorr type C femur (cortical thickness index 0.37) suffered periprosthetic fracture at 3 weeks post-implant. Stem had been press-fitted with standard force — retrospectively insufficient cortical bone support for distal fixation. Revised with longer cemented stem. Recommend Dorr classification + cortical thickness pre-operative assessment and cemented strategy for type C morphology.",
      procedureType: "Primary THA", patientCount: 1, visibility: "platform",
      isPublished: true, reviewedById: drAndersen, reviewedAt: new Date("2024-03-10"),
      tags: ["cementless", "osteoporosis"],
    },

    // ── MDT-VISIA-AF-ICD-3T (4) ────────────────────────────────────────────
    {
      deviceSku: "MDT-VISIA-AF-ICD-3T", tenantId: dtuSkylab.id, authorId: drNkrumah,
      annotationType: "tooling_anomaly", severity: "high",
      title: "Pocket placement 2 cm medial dramatically reduces pectoral sensing artefacts",
      body: "Placing the ICD pocket 2 cm medial to the standard pectoral position significantly reduced pectoral muscle sensing artefacts in 5/5 consecutive cases. No lead parameter changes at 30-day check. Recommend this technique for all muscular patients (BMI > 28, high muscle mass). TWOS (two-second window overshoot suppression) enabled on all cases.",
      procedureType: "ICD Implantation", patientCount: 5, visibility: "platform",
      isPublished: true, reviewedById: drNkrumah, reviewedAt: new Date("2024-03-01"),
      tags: ["cardiology"],
    },
    {
      deviceSku: "MDT-VISIA-AF-ICD-3T", tenantId: rigshospitalet.id, authorId: drHannah,
      annotationType: "failure_mode", severity: "medium",
      title: "RV lead impedance drift at 6 months — single case",
      body: "RV lead impedance increased from 420 Ω to 890 Ω at 6-month follow-up with no clinical symptoms. Device delivered 2 appropriate shocks. Lead repositioned. Post-operative check at 30 days: impedance normalised to 510 Ω. Cause: micro-dislodgement at tricuspid valve level. Ensure active-fixation lead helix fully deployed under fluoroscopy.",
      patientCount: 1, visibility: "tenant",
      isPublished: true, reviewedById: drHannah, reviewedAt: new Date("2024-02-20"),
      tags: ["cardiology", "mri-compatible"],
    },
    {
      deviceSku: "MDT-VISIA-AF-ICD-3T", tenantId: athensGeneral.id, authorId: drDimitra,
      annotationType: "general_observation", severity: "low",
      title: "MRI 3T conditional — followed protocol without adverse events (n=4)",
      body: "4 patients required 3T brain MRI post-implant. Followed Medtronic MRI conditional protocol: set pacing mode, disable tachy therapy, standard monitoring. All MRI scans completed without adverse events. Post-scan interrogation: no parameter changes in any case. Sequence: FLAIR and DWI at 3T. Confidence in 3T conditioning is high in our centre.",
      procedureType: "MRI Scan Post ICD", patientCount: 4, visibility: "platform",
      isPublished: true, reviewedById: drDimitra, reviewedAt: new Date("2024-02-05"),
      tags: ["mri-compatible", "cardiology"],
    },
    {
      deviceSku: "MDT-VISIA-AF-ICD-3T", tenantId: dtuSkylab.id, authorId: drNkrumah,
      annotationType: "operational_friction", severity: "medium",
      title: "Firmware update workflow requires 45-min in-clinic session — plan accordingly",
      body: "Implementing the required v2.3 firmware update (per MDT-FC-2024-003) takes approximately 45 minutes per device in clinic, including pre-update interrogation, telemetry session, and post-update parameter verification. For centres with > 10 affected devices, block additional clinic slots. Our centre scheduled a dedicated firmware day.",
      procedureType: "Firmware Update", patientCount: 8, visibility: "platform",
      isPublished: true, reviewedById: drNkrumah, reviewedAt: new Date("2024-03-08"),
      tags: ["cardiology"],
    },

    // ── STR-TRIATHLON-65 (3) ──────────────────────────────────────────────
    {
      deviceSku: "STR-TRIATHLON-65", tenantId: athensGeneral.id, authorId: drPapadopoulos,
      annotationType: "operational_friction", severity: "high",
      title: "Patellar clunk syndrome at 4-month follow-up — conservative management successful",
      body: "One patient presented with audible and palpable patellar clunk at 4 months. Consistent with fibrous tissue impingement at proximal pole of patella. Managed conservatively with physiotherapy; completely resolved at 6-month review. Intraoperative note: additional attention to proximal patellar debridement may reduce incidence. No revision required.",
      procedureType: "Primary TKA", patientCount: 1, visibility: "platform",
      isPublished: true, reviewedById: drPapadopoulos, reviewedAt: new Date("2024-02-28"),
      tags: ["revision-surgery"],
    },
    {
      deviceSku: "STR-TRIATHLON-65", tenantId: rigshospitalet.id, authorId: drAndersen,
      annotationType: "general_observation", severity: "low",
      title: "Superior flexion outcomes vs. previous PS design — 35-case comparative review",
      body: "Comparative review of 18 Triathlon vs. 17 previous PS design: mean flexion at 12 months 128° (Triathlon) vs. 118° (previous). OKS score 42 vs. 38 respectively. Patient satisfaction significantly higher. No difference in complication rate. Length of stay 2.1 days vs. 2.4 days. Triathlon now our standard first-line for primary TKA.",
      procedureType: "Primary TKA", patientCount: 35, visibility: "platform",
      isPublished: true, reviewedById: drAndersen, reviewedAt: new Date("2024-01-10"),
      tags: [],
    },
    {
      deviceSku: "STR-TRIATHLON-70", tenantId: dtuSkylab.id, authorId: drNkrumah,
      annotationType: "material_tolerance", severity: "low",
      title: "UHMWPE insert wear minimal at 5-year review",
      body: "5-year follow-up of 10 Triathlon 70mm cases. Fluoroscopic polyethylene wear measurement: mean 0.04 mm/year (range 0.02–0.09). Well within acceptable limits (threshold < 0.2 mm/year for aseptic loosening risk). OKS 45/48 at 5 years. No revisions in cohort.",
      procedureType: "Primary TKA", patientCount: 10, visibility: "platform",
      isPublished: true, reviewedById: drNkrumah, reviewedAt: new Date("2024-02-20"),
      tags: [],
    },

    // ── MDT-MICRA-AV (4) ─────────────────────────────────────────────────
    {
      deviceSku: "MDT-MICRA-AV", tenantId: dtuSkylab.id, authorId: drNkrumah,
      annotationType: "operational_friction", severity: "medium",
      title: "Extended fluoroscopy time in heavily calcified tricuspid valve",
      body: "In 4 cases with heavily calcified tricuspid valve apparatus, fluoroscopy time was 22–38 min (vs. expected 12–18 min). All implants successful. Recommend pre-operative echocardiographic assessment of tricuspid valve calcification grade. Consider alternative for severe grade III calcification. Radiation dose to operators was elevated — additional shielding used.",
      procedureType: "Micra AV Implant", patientCount: 4, visibility: "platform",
      isPublished: true, reviewedById: drNkrumah, reviewedAt: new Date("2024-03-05"),
      tags: ["minimally-invasive", "cardiology"],
    },
    {
      deviceSku: "MDT-MICRA-AV", tenantId: athensGeneral.id, authorId: drPapadopoulos,
      annotationType: "general_observation", severity: "low",
      title: "Zero infection rate at 12 months — 8-case series",
      body: "8 consecutive Micra AV implants with 12-month follow-up. Zero pocket-site infections (vs. 2.1% historical rate for transvenous systems at this centre). Patient comfort scores excellent (mean 9.1/10 for activity return). Recommend Micra AV as first-line for pacemaker-dependent patients with previous CIED infection history.",
      patientCount: 8, visibility: "platform",
      isPublished: true, reviewedById: drPapadopoulos, reviewedAt: new Date("2024-02-12"),
      tags: ["minimally-invasive", "cardiology"],
    },
    {
      deviceSku: "MDT-MICRA-AV", tenantId: rigshospitalet.id, authorId: drHannah,
      annotationType: "failure_mode", severity: "high",
      title: "Tether traction loss during delivery — early retrieval required (lot 24B)",
      body: "One Micra AV from lot 24B: tether fractured during delivery catheter retrieval, requiring emergency surgical retrieval. Device remained in RV trabeculae. Patient haemodynamically stable. Consult Medtronic FSN-2024-001 — lot 24B affected by battery depletion AND this tether issue. Report to Medtronic proactively. Centre has suspended lot 24B implants.",
      patientCount: 1, visibility: "platform",
      isPublished: true, reviewedById: drHannah, reviewedAt: new Date("2024-03-12"),
      tags: ["cardiology", "revision-surgery"],
    },
    {
      deviceSku: "MDT-MICRA-AV", tenantId: dtuSkylab.id, authorId: drNkrumah,
      annotationType: "tooling_anomaly", severity: "low",
      title: "Retrieval tool 2089 — alternative grip angle useful for calcified RV",
      body: "Standard retrieval angle for retrieval tool 2089 occasionally insufficient in cases with heavy RV trabeculation. An anterior-angled approach (rotating the delivery catheter 30° clockwise under fluoroscopy) allowed snare engagement on all 3 attempted retrievals. Not in the IFU — shared with Medtronic clinical team for inclusion.",
      procedureType: "Micra AV Retrieval", patientCount: 3, visibility: "platform",
      isPublished: true, reviewedById: drNkrumah, reviewedAt: new Date("2024-01-25"),
      tags: ["proprietary-tooling", "cardiology"],
    },

    // ── DPS-PINNACLE-36 (2) ───────────────────────────────────────────────
    {
      deviceSku: "DPS-PINNACLE-36", tenantId: athensGeneral.id, authorId: drPapadopoulos,
      annotationType: "failure_mode", severity: "high",
      title: "Elevated serum cobalt at 5-year review — MHRA protocol activated",
      body: "Patient 1: serum cobalt 6.8 µg/L, chromium 4.1 µg/L at 5-year follow-up (normal < 4 µg/L per MHRA 2024). MRI MARS: no pseudotumour. Patient asymptomatic. Enrolled in enhanced monitoring per MHRA 2024-011 protocol. Revision not yet indicated but scheduled if ion levels rise further. All Pinnacle 36 MoM patients at this centre now on annual ion testing.",
      patientCount: 1, visibility: "platform",
      isPublished: true, reviewedById: drPapadopoulos, reviewedAt: new Date("2024-01-30"),
      tags: ["revision-surgery"],
    },
    {
      deviceSku: "DPS-PINNACLE-36", tenantId: rigshospitalet.id, authorId: drAndersen,
      annotationType: "general_observation", severity: "medium",
      title: "Metal artefact reduction MRI essential for MoM surveillance",
      body: "Standard MRI sequences unable to detect pseudotumour adjacent to MoM hip. MARS (metal artefact reduction sequence) protocol correctly identified a 2.2 cm pseudotumour not visible on standard T1/T2 in one patient. All centres should have access to MARS MRI for MoM surveillance. Agree pre-operative protocol with radiology before implanting.",
      patientCount: 6, visibility: "platform",
      isPublished: true, reviewedById: drAndersen, reviewedAt: new Date("2024-02-15"),
      tags: ["mri-compatible"],
    },

    // ── MDT-INFINITY-DBS (2) ─────────────────────────────────────────────
    {
      deviceSku: "MDT-INFINITY-DBS", tenantId: dtuSkylab.id, authorId: drPeterWest,
      annotationType: "tooling_anomaly", severity: "medium",
      title: "Directional electrode impedance imbalance — Parkinson's cohort",
      body: "In 2 of 6 patients in our Parkinson's disease cohort, directional electrode segments showed impedance imbalance > 20% between adjacent segments at 3-month follow-up. No adverse events. Medtronic technical support engaged. Re-testing scheduled. Further reporting pending confirmation. Current hypothesis: lead migration of < 1 mm post-implant.",
      patientCount: 6, visibility: "platform",
      isPublished: false, // pending review
    },
    {
      deviceSku: "MDT-INFINITY-DBS", tenantId: dtuSkylab.id, authorId: drPeterWest,
      annotationType: "operational_friction", severity: "low",
      title: "Programmer app integration with hospital WiFi — configure VPN exclusion",
      body: "Medtronic Clinician Programmer App (model 37604) requires direct internet connectivity to the Medtronic cloud for firmware sync. Hospital VPN blocks this. IT team must whitelist Medtronic telemetry endpoints (documented in Medtronic IT integration guide v3.2). Took 3 weeks at our centre — plan in advance of first implant.",
      visibility: "tenant",
      isPublished: true, reviewedById: drPeterWest, reviewedAt: new Date("2024-01-20"),
      tags: ["proprietary-tooling"],
    },

    // ── DPS-SYNFIX-L4 (2) ─────────────────────────────────────────────────
    {
      deviceSku: "DPS-SYNFIX-L4", tenantId: rigshospitalet.id, authorId: drAndersen,
      annotationType: "operational_friction", severity: "medium",
      title: "PEEK-OPTIMA subsidence in osteoporotic L4-L5 — 3 cases",
      body: "3 patients with DEXA T-score < −2.5 demonstrated > 2 mm cage subsidence at 6-week follow-up. Two resolved spontaneously; one required additional posterior instrumentation at 3 months. The titanium plasma-sprayed surface may be insufficient for bone ingrowth in severe osteoporosis. Consider supplementary posterior fixation routinely in T < −2.5.",
      procedureType: "ALIF L4-L5", patientCount: 3, visibility: "platform",
      isPublished: true, reviewedById: drAndersen, reviewedAt: new Date("2024-02-05"),
      tags: ["peek", "osteoporosis"],
    },
    {
      deviceSku: "DPS-SYNFIX-L4", tenantId: athensGeneral.id, authorId: drPapadopoulos,
      annotationType: "general_observation", severity: "low",
      title: "Stand-alone ALIF: 92% fusion rate at 12 months (n=12)",
      body: "12 consecutive stand-alone ALIF with SYNFIX at L4-L5. CT assessment at 12 months: 11/12 (92%) bridging fusion, 1/12 delayed union at 12 months (fused at 18 months). ODI improved from 52 to 18 at 12 months. No hardware failure. Endplate preparation critical — use dedicated rasp rather than standard curette for optimal surface area.",
      procedureType: "ALIF L4-L5", patientCount: 12, visibility: "platform",
      isPublished: true, reviewedById: drPapadopoulos, reviewedAt: new Date("2024-01-28"),
      tags: ["peek"],
    },

    // ── STR-TRITANIUM-C4 (2) ──────────────────────────────────────────────
    {
      deviceSku: "STR-TRITANIUM-C4", tenantId: rigshospitalet.id, authorId: drAndersen,
      annotationType: "general_observation", severity: "low",
      title: "Porous titanium osseointegration superior to PEEK at 6 months",
      body: "Compared 8 Tritanium C cases vs. 8 PEEK cage controls on follow-up CT. Tritanium group: 7/8 bridging fusion at 6 months. PEEK group: 4/8 at 6 months. Difference statistically significant (p=0.03, Fisher's exact). Tritanium surface provides scaffold for bone ingrowth not possible with PEEK. Recommend Ti cages for patients with diabetes or smokers (impaired bone healing).",
      procedureType: "ACDF", patientCount: 16, visibility: "platform",
      isPublished: true, reviewedById: drAndersen, reviewedAt: new Date("2024-02-20"),
      tags: ["ti-6al-4v"],
    },
    {
      deviceSku: "STR-TRITANIUM-C4", tenantId: dtuSkylab.id, authorId: drPeterWest,
      annotationType: "material_tolerance", severity: "low",
      title: "No MRI artefact interference with cervical cord imaging at 1.5T",
      body: "4 patients required cervical spine MRI at 1.5T post-ACDF with Tritanium C cage. MARS protocol used. Cord signal assessment unobstructed in all cases. Adjacent disc assessment feasible in 3/4 cases. Standard T2 cord imaging was adequate in all cases. Surgeons may safely proceed with cervical MRI at 1.5T without MARS in most cases.",
      procedureType: "ACDF", patientCount: 4, visibility: "platform",
      isPublished: true, reviewedById: drPeterWest, reviewedAt: new Date("2024-03-01"),
      tags: ["ti-6al-4v", "mri-compatible"],
    },

    // ── MDT-AZURE-XT-DR (2) ────────────────────────────────────────────────
    {
      deviceSku: "MDT-AZURE-XT-DR", tenantId: athensGeneral.id, authorId: drDimitra,
      annotationType: "operational_friction", severity: "low",
      title: "Remote monitoring setup requires patient smartphone with iOS 12+",
      body: "MyCareLink Heart app (remote monitoring) requires iOS 12+ or Android 8+. 3 elderly patients at our centre did not own compatible smartphones. Resolved by providing hospital-owned dedicated monitoring tablets. Medtronic should consider a standalone Bluetooth transmitter for elderly patients without smartphones. Flag to manufacturer.",
      visibility: "platform",
      isPublished: true, reviewedById: drDimitra, reviewedAt: new Date("2024-02-18"),
      tags: ["cardiology"],
    },
    {
      deviceSku: "MDT-AZURE-XT-DR", tenantId: rigshospitalet.id, authorId: drHannah,
      annotationType: "general_observation", severity: "low",
      title: "Excellent sensing in permanent AF — no mode switching required",
      body: "10 patients with permanent AF managed with Azure XT DR in DDIR mode. Ventricular sensing stable in all cases at 6-month follow-up (mean R-wave 12.4 mV, range 8.2–18.6 mV). No spurious mode switches. Battery longevity estimate 8.2 years at current settings, consistent with specification. High confidence in long-term sensing stability.",
      patientCount: 10, visibility: "platform",
      isPublished: true, reviewedById: drHannah, reviewedAt: new Date("2024-01-30"),
      tags: ["cardiology"],
    },

    // ── ZB-CONTINUUM-28 (1) recalled device ────────────────────────────────
    {
      deviceSku: "ZB-CONTINUUM-28", tenantId: athensGeneral.id, authorId: drPapadopoulos,
      annotationType: "failure_mode", severity: "critical",
      title: "URGENT: Accelerated wear confirmed in lot Z-2024-03 — 2 revisions required",
      body: "Two patients implanted with Continuum cups from lot Z-2024-03 presented at 18-month follow-up with severe groin pain, elevated ESR, and hip joint effusion. MRI showed synovitis. Surgical exploration revealed > 5 mm polyethylene wear in both cases. Both underwent revision to ceramic-on-ceramic articulation. Immediately audit your lot Z-2024-03 inventory and contact all implanted patients.",
      procedureType: "Revision THA", patientCount: 2, visibility: "platform",
      isPublished: true, reviewedById: drPapadopoulos, reviewedAt: new Date("2024-03-15"),
      tags: ["revision-surgery"],
    },

    // ── MDT-EVOQUE-TMVR (1) ────────────────────────────────────────────────
    {
      deviceSku: "MDT-EVOQUE-TMVR", tenantId: dtuSkylab.id, authorId: drNkrumah,
      annotationType: "operational_friction", severity: "medium",
      title: "Multidisciplinary heart team mandatory — 3 specialty coordination required",
      body: "Evoque TMVR implantation required: cardiac surgeon (transseptal access), interventional cardiologist (valve deployment), cardiac anaesthesiologist (TEE guidance), and specialist echo sonographer. Logistics for coordinating 4 specialists in one hybrid OR session was the primary challenge. Pre-case simulation with phantom was extremely useful and should be mandatory for first 3 cases at any new centre.",
      procedureType: "TMVR", patientCount: 2, visibility: "platform",
      isPublished: true, reviewedById: drNkrumah, reviewedAt: new Date("2024-03-10"),
      tags: ["minimally-invasive", "cardiology"],
    },
  ];

  // Create annotations and collect their IDs.
  // Also track per-device published annotation counts so we can backfill
  // the denormalized annotationCount on each Device row — matching exactly
  // what the API's $transaction increment would produce in production.
  const annotationIds: string[] = [];
  const deviceAnnotationCounts  = new Map<string, number>(); // deviceId → published count

  for (const inp of annotationInputs) {
    const devId = deviceMap[inp.deviceSku];
    if (!devId) continue;
    const ann = await db.annotation.create({
      data: {
        deviceId:       devId,
        tenantId:       inp.tenantId,
        authorId:       inp.authorId,
        annotationType: inp.annotationType as any,
        severity:       inp.severity ?? null,
        title:          inp.title,
        body:           inp.body,
        procedureType:  inp.procedureType ?? null,
        patientCount:   inp.patientCount ?? null,
        visibility:     inp.visibility,
        isPublished:    inp.isPublished,
        // Phase 6: set lifecycle status + publishedAt so the feed query
        // (which filters on status = 'published') returns these rows.
        // Without this the default 'draft' status hides all seed annotations.
        status:         inp.isPublished ? "published" : "draft",
        publishedAt:    inp.isPublished ? (inp.reviewedAt ?? new Date()) : null,
        reviewedById:   inp.reviewedById ?? null,
        reviewedAt:     inp.reviewedAt ?? null,
        version:        1,
      },
    });
    annotationIds.push(ann.id);

    // Accumulate per-device count for published annotations only
    if (inp.isPublished) {
      deviceAnnotationCounts.set(devId, (deviceAnnotationCounts.get(devId) ?? 0) + 1);
    }

    // Attach tags
    if (inp.tags?.length) {
      for (const slug of inp.tags) {
        const tagId = tagMap[slug];
        if (tagId) {
          await db.annotationTagLink.create({
            data: { annotationId: ann.id, tagId },
          }).catch(() => {}); // skip if already exists
        }
      }
    }
  }

  // Backfill annotationCount on each device that received published annotations.
  // Devices with zero published annotations keep the 0 set by the reset above.
  for (const [deviceId, count] of deviceAnnotationCounts) {
    await db.device.update({
      where: { id: deviceId },
      data:  { annotationCount: count },
    });
  }
  console.log(`✅  Annotations: ${annotationIds.length} seeded (annotationCount backfilled on ${deviceAnnotationCounts.size} devices)`);

  // ── Votes on published annotations ────────────────────────────────────────
  // Only tier 2 and 3 users can vote (tiers 0 and 1 skipped)
  // Vote distribution simulates real usage: top annotations get more votes
  type VoteDef = { annotationIdx: number; userId: string; value: 1 | -1; relevanceScore: number };
  const voteDefs: VoteDef[] = [
    // Annotation 0 (ACCII-28 subsidence) — 4 upvotes, 1 downvote
    { annotationIdx: 0, userId: drNkrumah,      value: 1,  relevanceScore: 0.6 },
    { annotationIdx: 0, userId: drPapadopoulos, value: 1,  relevanceScore: 1.5 },
    { annotationIdx: 0, userId: drHannah,        value: 1,  relevanceScore: 0.6 },
    { annotationIdx: 0, userId: drDimitra,       value: 1,  relevanceScore: 0.6 },
    // Annotation 1 (ACCII-28 stability) — 3 upvotes
    { annotationIdx: 1, userId: drAndersen,      value: 1,  relevanceScore: 1.5 },
    { annotationIdx: 1, userId: drPapadopoulos,  value: 1,  relevanceScore: 1.5 },
    { annotationIdx: 1, userId: drDimitra,        value: 1,  relevanceScore: 0.6 },
    // Annotation 3 (tooling) — 2 upvotes
    { annotationIdx: 3, userId: drNkrumah,       value: 1,  relevanceScore: 0.6 },
    { annotationIdx: 3, userId: drPapadopoulos,  value: 1,  relevanceScore: 1.5 },
    // Annotation 4 (periprosthetic fracture) — 5 upvotes
    { annotationIdx: 4, userId: drNkrumah,       value: 1,  relevanceScore: 0.6 },
    { annotationIdx: 4, userId: drPapadopoulos,  value: 1,  relevanceScore: 1.5 },
    { annotationIdx: 4, userId: drHannah,         value: 1,  relevanceScore: 0.6 },
    { annotationIdx: 4, userId: drDimitra,        value: 1,  relevanceScore: 0.6 },
    { annotationIdx: 4, userId: drPeterWest,      value: 1,  relevanceScore: 0.6 },
    // Annotation 5 (Visia pocket placement) — 4 upvotes
    { annotationIdx: 5, userId: drHannah,         value: 1,  relevanceScore: 1.5 },
    { annotationIdx: 5, userId: drDimitra,         value: 1,  relevanceScore: 1.5 },
    { annotationIdx: 5, userId: drAndersen,        value: 1,  relevanceScore: 0.6 },
    { annotationIdx: 5, userId: drPeterWest,       value: 1,  relevanceScore: 0.6 },
    // Annotation 6 (lead impedance) — 2 upvotes
    { annotationIdx: 6, userId: drNkrumah,         value: 1,  relevanceScore: 1.5 },
    { annotationIdx: 6, userId: drDimitra,          value: 1,  relevanceScore: 1.5 },
    // Annotation 9 (Triathlon clunk) — 3 upvotes
    { annotationIdx: 9, userId: drAndersen,         value: 1,  relevanceScore: 1.5 },
    { annotationIdx: 9, userId: drNkrumah,          value: 1,  relevanceScore: 0.6 },
    { annotationIdx: 9, userId: drHannah,           value: -1, relevanceScore: 0.6 }, // disagreement
    // Annotation 14 (Micra tether failure) — 6 upvotes — high-impact
    { annotationIdx: 14, userId: drNkrumah,         value: 1,  relevanceScore: 1.5 },
    { annotationIdx: 14, userId: drDimitra,          value: 1,  relevanceScore: 1.5 },
    { annotationIdx: 14, userId: drAndersen,         value: 1,  relevanceScore: 0.6 },
    { annotationIdx: 14, userId: drPapadopoulos,    value: 1,  relevanceScore: 0.6 },
    { annotationIdx: 14, userId: drPeterWest,        value: 1,  relevanceScore: 0.6 },
    // Annotation 16 (Cobalt) — 4 upvotes
    { annotationIdx: 16, userId: drAndersen,         value: 1,  relevanceScore: 1.5 },
    { annotationIdx: 16, userId: drNkrumah,          value: 1,  relevanceScore: 0.6 },
    { annotationIdx: 16, userId: drDimitra,           value: 1,  relevanceScore: 0.6 },
    { annotationIdx: 16, userId: drHannah,            value: 1,  relevanceScore: 0.6 },
    // Annotation 27 (URGENT Continuum) — 5 upvotes
    { annotationIdx: 27, userId: drAndersen,          value: 1,  relevanceScore: 1.5 },
    { annotationIdx: 27, userId: drNkrumah,           value: 1,  relevanceScore: 0.6 },
    { annotationIdx: 27, userId: drHannah,             value: 1,  relevanceScore: 0.6 },
    { annotationIdx: 27, userId: drPeterWest,          value: 1,  relevanceScore: 0.6 },
    { annotationIdx: 27, userId: drDimitra,             value: 1,  relevanceScore: 0.6 },
  ];

  let voteCount = 0;
  for (const v of voteDefs) {
    const annotationId = annotationIds[v.annotationIdx];
    if (!annotationId) continue;
    // Voters cannot vote on own annotation
    const ann = await db.annotation.findUnique({ where: { id: annotationId }, select: { authorId: true } });
    if (ann?.authorId === v.userId) continue;
    await db.annotationVote.upsert({
      where:  { annotationId_userId: { annotationId, userId: v.userId } },
      create: { annotationId, userId: v.userId, value: v.value, specialtyRelevanceScore: v.relevanceScore },
      update: {},
    });
    voteCount++;
  }
  console.log(`✅  Votes: ${voteCount} seeded`);

  // ── Comments on selected annotations ──────────────────────────────────────
  type CommentDef = {
    annotationIdx: number; parentCommentIdx?: number;
    authorId: string; tenantId: string; body: string; depth: 0 | 1 | 2;
  };
  const commentDefs: CommentDef[] = [
    // On annotation 0 (ACCII-28 subsidence)
    { annotationIdx: 0, authorId: drNkrumah, tenantId: dtuSkylab.id, depth: 0,
      body: "Consistent with our experience. We now routinely order a DEXA scan pre-operatively for patients over 60. Would you consider bisphosphonate therapy pre-op for high-risk cases?" },
    { annotationIdx: 0, parentCommentIdx: 0, authorId: drAndersen, tenantId: rigshospitalet.id, depth: 1,
      body: "We consulted our endocrinology team on this. They recommend anabolic therapy (teriparatide) for 3 months pre-op in severe osteoporosis cases. Only 2 patients to date but encouraging early stability on intraoperative tactile assessment." },
    { annotationIdx: 0, parentCommentIdx: 1, authorId: drPapadopoulos, tenantId: athensGeneral.id, depth: 2,
      body: "Teriparatide pre-op is interesting but expensive in our healthcare system. Any experience with simple calcium + Vit D supplementation with weight-bearing rehab 6 weeks pre-op?" },

    // On annotation 1 (ACCII-28 excellent stability)
    { annotationIdx: 1, authorId: drPapadopoulos, tenantId: athensGeneral.id, depth: 0,
      body: "Our 24-month data aligns. One question: what radiographic assessment tool did you use for osseointegration grading? We use the Engh criteria — interested if HA coating makes a quantifiable difference." },

    // On annotation 4 (periprosthetic fracture)
    { annotationIdx: 4, authorId: drPapadopoulos, tenantId: athensGeneral.id, depth: 0,
      body: "Excellent case report. Did you use the Vancouver classification for the fracture? Was it a B1 (fixed stem) or B2 (loose stem) pattern? Important for deciding management strategy in future similar cases." },
    { annotationIdx: 4, parentCommentIdx: 4, authorId: drAndersen, tenantId: rigshospitalet.id, depth: 1,
      body: "Vancouver B2 in our case — stem felt loose at exploration, consistent with distal fixation failure in the thin cortex. We moved to a fluted revision stem with extended distal fixation. Will report 1-year outcome." },

    // On annotation 5 (Visia pocket technique)
    { annotationIdx: 5, authorId: drHannah, tenantId: rigshospitalet.id, depth: 0,
      body: "Fascinating technique. Does the medial placement affect defibrillation threshold? Our physics team is concerned the medial position changes the shock vector relative to the RV." },
    { annotationIdx: 5, parentCommentIdx: 6, authorId: drNkrumah, tenantId: dtuSkylab.id, depth: 1,
      body: "We performed DFT testing in the first 3 cases. DFT was 12J, 14J, and 11J — all well within the device's 33J maximum. No concern in our small series but this is worth systematic study." },
    { annotationIdx: 5, authorId: drDimitra, tenantId: athensGeneral.id, depth: 0,
      body: "Will implement this technique in our next muscular patient. The sensing artefact problem has been a recurring issue for us too. Have you tried programming a higher sensing threshold as an alternative?" },

    // On annotation 9 (Triathlon patellar clunk)
    { annotationIdx: 9, authorId: drAndersen, tenantId: rigshospitalet.id, depth: 0,
      body: "Was the patella resurfaced in this case? Our reading of the literature suggests non-resurfaced patella is a risk factor for clunk. We resurface routinely and have not seen this complication in our Triathlon cases." },
    { annotationIdx: 9, parentCommentIdx: 9, authorId: drPapadopoulos, tenantId: athensGeneral.id, depth: 1,
      body: "Patella was not resurfaced — this was before we adopted routine resurfacing. We have since changed practice to resurface all primary TKAs. No clunk in subsequent 8 Triathlon cases." },

    // On annotation 14 (Micra tether failure — high impact)
    { annotationIdx: 14, authorId: drNkrumah, tenantId: dtuSkylab.id, depth: 0,
      body: "Alarming report. Has this been filed with FDA (MDR) and Medtronic? This sounds like it may not be in the published safety database. The tether failure mechanism is distinct from the battery issue in FSN-2024-001." },
    { annotationIdx: 14, parentCommentIdx: 11, authorId: drHannah, tenantId: rigshospitalet.id, depth: 1,
      body: "Confirmed MDR filed. Medtronic field safety team visited our centre within 48 hours. They are examining whether lot 24B has a tether manufacturing deviation in addition to battery issue. Awaiting formal safety communication." },
    { annotationIdx: 14, authorId: drDimitra, tenantId: athensGeneral.id, depth: 0,
      body: "We have 3 lot 24B implants at Athens General. Immediately scheduled recall appointments for all 3 patients. Any guidance on what to tell patients at this stage before formal manufacturer communication?" },
    { annotationIdx: 14, parentCommentIdx: 13, authorId: drHannah, tenantId: rigshospitalet.id, depth: 1,
      body: "Our centre told patients there is an industry safety review underway and they are being seen as a precaution. Medtronic patient letter expected within 2 weeks. Keep monitoring enabled and schedule 30-day interrogation." },

    // On annotation 27 (Continuum URGENT)
    { annotationIdx: 27, authorId: drAndersen, tenantId: rigshospitalet.id, depth: 0,
      body: "How did you verify the lot number intraoperatively? Did the patients have implant cards with lot information? Our records system sometimes only captures device name and SKU." },
    { annotationIdx: 27, parentCommentIdx: 15, authorId: drPapadopoulos, tenantId: athensGeneral.id, depth: 1,
      body: "Both patients had their implant ID cards. The lot number Z-2024-03 was visible on the sticker. We also cross-referenced with OR inventory logs. Recommend all centres audit their log books for this lot." },
  ];

  const createdCommentIds: string[] = new Array(commentDefs.length).fill(null);
  let commentCount = 0;

  // First pass: top-level comments (depth 0)
  for (let i = 0; i < commentDefs.length; i++) {
    const c = commentDefs[i];
    if (c.depth !== 0) continue;
    const annotationId = annotationIds[c.annotationIdx];
    if (!annotationId) continue;
    const comment = await db.comment.create({
      data: {
        annotationId, parentId: null,
        authorId: c.authorId, tenantId: c.tenantId,
        body: c.body, depth: c.depth, isPublished: true,
      },
    });
    createdCommentIds[i] = comment.id;
    commentCount++;
  }

  // Second pass: replies (depth 1)
  for (let i = 0; i < commentDefs.length; i++) {
    const c = commentDefs[i];
    if (c.depth !== 1) continue;
    const annotationId = annotationIds[c.annotationIdx];
    if (!annotationId || c.parentCommentIdx === undefined) continue;
    const parentId = createdCommentIds[c.parentCommentIdx];
    if (!parentId) continue;
    const comment = await db.comment.create({
      data: {
        annotationId, parentId,
        authorId: c.authorId, tenantId: c.tenantId,
        body: c.body, depth: 1, isPublished: true,
      },
    });
    createdCommentIds[i] = comment.id;
    commentCount++;
  }

  // Third pass: nested replies (depth 2)
  for (let i = 0; i < commentDefs.length; i++) {
    const c = commentDefs[i];
    if (c.depth !== 2) continue;
    const annotationId = annotationIds[c.annotationIdx];
    if (!annotationId || c.parentCommentIdx === undefined) continue;
    const parentId = createdCommentIds[c.parentCommentIdx];
    if (!parentId) continue;
    const comment = await db.comment.create({
      data: {
        annotationId, parentId,
        authorId: c.authorId, tenantId: c.tenantId,
        body: c.body, depth: 2, isPublished: true,
      },
    });
    createdCommentIds[i] = comment.id;
    commentCount++;
  }
  console.log(`✅  Comments: ${commentCount} seeded (threaded, max depth 2)`);

  // ── Comment votes ──────────────────────────────────────────────────────────
  // Upvote some top-level comments (only tier 2+ users)
  const commentVotePairs = [
    { commentIdx: 0, userId: drPapadopoulos, value: 1 },
    { commentIdx: 0, userId: drHannah,        value: 1 },
    { commentIdx: 4, userId: drNkrumah,       value: 1 },
    { commentIdx: 6, userId: drDimitra,        value: 1 },
    { commentIdx: 6, userId: drPapadopoulos,   value: 1 },
    { commentIdx: 9, userId: drNkrumah,        value: 1 },
    { commentIdx: 11, userId: drAndersen,      value: 1 },
    { commentIdx: 11, userId: drDimitra,        value: 1 },
    { commentIdx: 15, userId: drNkrumah,        value: 1 },
  ];
  let commentVoteCount = 0;
  for (const cv of commentVotePairs) {
    const commentId = createdCommentIds[cv.commentIdx];
    if (!commentId) continue;
    const comment = await db.comment.findUnique({ where: { id: commentId }, select: { authorId: true } });
    if (comment?.authorId === cv.userId) continue; // can't vote own comment
    await db.commentVote.upsert({
      where:  { commentId_userId: { commentId, userId: cv.userId } },
      create: { commentId, userId: cv.userId, value: cv.value },
      update: {},
    });
    commentVoteCount++;
  }
  console.log(`✅  Comment votes: ${commentVoteCount} seeded`);

  // ── UserReputation (computed from votes) ───────────────────────────────────
  const authorIds = [drAndersen, drNkrumah, drPapadopoulos, drHannah, drPeterWest, drDimitra];
  for (const authorId of authorIds) {
    const votes = await db.annotationVote.findMany({
      where:   { annotation: { authorId } },
      include: { user: { select: { verificationTier: true } } },
    });
    const totalScore = votes.reduce((sum, v) => {
      const mult = v.user.verificationTier >= 3 ? 1.5 : v.user.verificationTier >= 2 ? 1.0 : 0;
      return sum + v.value * v.specialtyRelevanceScore * mult;
    }, 0);
    await db.userReputation.upsert({
      where:  { userId: authorId },
      create: { userId: authorId, totalScore, weeklyScore: totalScore, monthlyScore: totalScore },
      update: { totalScore, weeklyScore: totalScore, monthlyScore: totalScore },
    });
  }
  console.log("✅  UserReputation: computed and seeded for all contributing clinicians");

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n🎉  Seed v2 complete! Database ready for demo.\n");
  console.log("Tenant IDs for .env:");
  console.log(`  RIGSHOSPITALET: ${rigshospitalet.id}`);
  console.log(`  DTU_SKYLAB:     ${dtuSkylab.id}`);
  console.log(`  ATHENS_GENERAL: ${athensGeneral.id}`);
  console.log("\nDev auth0 sub for system_admin bypass:");
  console.log("  00000000-0000-0000-0000-000000000001");
}

// ── Demo data seeding ─────────────────────────────────────────────────────────
// Activated with: pnpm db:seed -- --demo-data
// Adds high-volume realistic data suited for sales demos and load testing.

async function seedDemoData() {
  console.log("\n🎭  Starting demo data seed…");

  // ── Idempotency cleanup ───────────────────────────────────────────────────
  // Delete any rows written by a previous demo seed run so this function is
  // safe to call multiple times (repeatable demo environment resets).
  //
  // UUID fields use Prisma `in` lists (startsWith is invalid on UuidFilter).
  // String fields (sku, auth0UserId, userAgent) support startsWith / exact.
  // Order matters: foreign-key children before parents.
  const DEMO_SEED_AGENT = "Mozilla/5.0 (Demo Seed Generator)";

  // Known annotation IDs: de00a000-0000-4000-8000-000000000000 … 000000000069
  const DEMO_ANN_IDS = Array.from({ length: 70 }, (_, i) =>
    `de00a000-0000-4000-8000-${String(i).padStart(12, "0")}`
  );
  // Known alert IDs: de00a1e7-0000-4000-8000-000000000001 … 000000000005
  const DEMO_ALERT_IDS = Array.from({ length: 5 }, (_, i) =>
    `de00a1e7-0000-4000-8000-${String(i + 1).padStart(12, "0")}`
  );

  await db.auditLog.deleteMany({ where: { userAgent: DEMO_SEED_AGENT } });
  await db.tenantAlertAcknowledgement.deleteMany({
    where: { alertId: { in: DEMO_ALERT_IDS } },
  });
  await db.annotation.deleteMany({ where: { id: { in: DEMO_ANN_IDS } } });
  await db.alert.deleteMany({ where: { id: { in: DEMO_ALERT_IDS } } });
  await db.device.deleteMany({ where: { sku: { startsWith: "DEMO-" } } });
  await db.user.deleteMany({ where: { auth0UserId: { startsWith: "demo|" } } });
  // Tenants are NOT deleted here — they are always upserted below, and
  // deleting a tenant would cascade-delete audit rows from other tables.
  console.log("🧹  Idempotency: previous demo data removed");

  // ── Resolve existing manufacturers + categories ──────────────────────────
  const manufacturers = await db.manufacturer.findMany({
    select: { id: true, name: true },
  });
  if (manufacturers.length === 0) {
    throw new Error("Run the base seed first: pnpm db:seed");
  }
  const mfrIds = manufacturers.map((m) => m.id);

  const categories = await db.deviceCategory.findMany({
    select: { id: true, name: true },
  });
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  // ── Demo tenants ──────────────────────────────────────────────────────────
  const demoTenant1 = await db.tenant.upsert({
    where:  { slug: "rigshospitalet-demo" },
    update: {},
    create: {
      name:        "Rigshospitalet Demo",
      slug:        "rigshospitalet-demo",
      planTier:    "enterprise",
      baaSignedAt: new Date("2024-06-01"),
      isActive:    true,
      settings:    { region: "dk", currency: "DKK", language: "da", demo: true },
    },
  });

  const demoTenant2 = await db.tenant.upsert({
    where:  { slug: "aalborg-university-hospital-demo" },
    update: {},
    create: {
      name:        "Aalborg University Hospital Demo",
      slug:        "aalborg-university-hospital-demo",
      planTier:    "standard",
      baaSignedAt: new Date("2024-07-15"),
      isActive:    true,
      settings:    { region: "dk", currency: "DKK", language: "da", demo: true },
    },
  });
  console.log("✅  Demo tenants created");

  // ── Demo users ────────────────────────────────────────────────────────────
  const demoUsers = [
    {
      tenantId:        demoTenant1.id,
      auth0UserId:     "demo|rigs-safety-001",
      email:           "anna.larsen@rigshospitalet-demo.dk",
      fullName:        "Dr. Anna Larsen",
      role:            "hospital_safety_officer",
      specialty:       "Patient Safety",
      verificationTier: 3,
      subscriptionStatus: "active",
    },
    {
      tenantId:        demoTenant1.id,
      auth0UserId:     "demo|rigs-surgeon-001",
      email:           "mikkel.jensen@rigshospitalet-demo.dk",
      fullName:        "Dr. Mikkel Jensen",
      role:            "surgeon",
      specialty:       "Orthopedic Surgery",
      verificationTier: 2,
      subscriptionStatus: "active",
    },
    {
      tenantId:        demoTenant1.id,
      auth0UserId:     "demo|rigs-admin-001",
      email:           "it.procurement@rigshospitalet-demo.dk",
      fullName:        "Søren Møller",
      role:            "it_procurement",
      specialty:       null,
      verificationTier: 1,
      subscriptionStatus: "active",
    },
    {
      tenantId:        demoTenant2.id,
      auth0UserId:     "demo|aau-surgeon-001",
      email:           "camilla.nielsen@aau-demo.dk",
      fullName:        "Dr. Camilla Nielsen",
      role:            "surgeon",
      specialty:       "Cardiac Electrophysiology",
      verificationTier: 2,
      subscriptionStatus: "active",
    },
    {
      tenantId:        demoTenant2.id,
      auth0UserId:     "demo|aau-safety-001",
      email:           "lars.christensen@aau-demo.dk",
      fullName:        "Lars Christensen",
      role:            "hospital_safety_officer",
      specialty:       "Medical Equipment Safety",
      verificationTier: 1,
      subscriptionStatus: "active",
    },
  ];

  const createdUserIds: string[] = [];
  for (const u of demoUsers) {
    const user = await db.user.upsert({
      where:  { auth0UserId: u.auth0UserId },
      update: {},
      create: {
        ...u,
        emailVerifiedAt:         new Date("2024-08-01"),
        verificationApprovedAt:  u.verificationTier >= 2 ? new Date("2024-08-15") : null,
      },
    });
    createdUserIds.push(user.id);
  }
  console.log("✅  Demo users: 5 created");

  const [demoSafetyOfficer, demoSurgeon1, , demoSurgeon2] = createdUserIds;

  // ── 100 demo devices ──────────────────────────────────────────────────────
  // 40 orthopaedic, 35 cardiac EP, 25 dentistry

  const orthoMfrId  = mfrIds[0];
  const cardioMfrId = mfrIds[1] ?? mfrIds[0];
  const dentalMfrId = mfrIds[2] ?? mfrIds[0];

  const orthoCatId  = catByName["Hip Replacement"]  ?? catByName["Joint Replacement"] ?? categories[0].id;
  const cardioCatId = catByName["Cardiac EP"]        ?? catByName["Cardiovascular"]    ?? categories[0].id;
  const dentalCatId = catByName["Dental Implants"]   ?? catByName["Dentistry"]         ?? categories[0].id;

  const orthoNames = [
    "TitanFlex Hip Stem 1.0",  "TitanFlex Hip Stem 1.5",  "TitanFlex Hip Stem 2.0",
    "OsteoLock Acetabular Cup A", "OsteoLock Acetabular Cup B", "OsteoLock Acetabular Cup C",
    "KneeAlign Total Knee System S", "KneeAlign Total Knee System M", "KneeAlign Total Knee System L",
    "BioShield Femoral Nail 9mm", "BioShield Femoral Nail 10mm", "BioShield Femoral Nail 11mm",
    "SpineCore TLIF Cage 10mm", "SpineCore TLIF Cage 12mm", "SpineCore TLIF Cage 14mm",
    "MotionTech Shoulder Glenoid A", "MotionTech Shoulder Glenoid B",
    "MotionTech Humeral Stem S", "MotionTech Humeral Stem M", "MotionTech Humeral Stem L",
    "ActiveElbow Radial Head 22mm", "ActiveElbow Radial Head 24mm",
    "AnkleLink Tibial Component S", "AnkleLink Tibial Component M",
    "AnkleLink Talar Component S", "AnkleLink Talar Component M",
    "PatellaTrack Resurfacing Disc",
    "OrthoScrew Cortical 3.5mm", "OrthoScrew Cortical 4.5mm", "OrthoScrew Cancellous 6.5mm",
    "LockPlate Distal Radius DRP-1", "LockPlate Distal Radius DRP-2",
    "LockPlate Proximal Humerus PHP-1",
    "CerviCore ACDF Cage 5mm", "CerviCore ACDF Cage 6mm", "CerviCore ACDF Cage 7mm",
    "PedicleScrewPro 4.5×35", "PedicleScrewPro 5.5×40", "PedicleScrewPro 6.5×45",
    "TraumaPlate Femur F-10",
  ];

  const cardioNames = [
    "CardioMap EP Catheter 4mm", "CardioMap EP Catheter 8mm",
    "CardioMap Irrigated Ablation Catheter",
    "ElectraNav 3D Mapping Catheter",
    "PulseGuide Diagnostic Catheter 5F", "PulseGuide Diagnostic Catheter 6F",
    "CryoStar Cryo-Ablation Catheter",
    "SignalPath Circular Mapping Catheter",
    "SinusDrive Sinus Node Catheter",
    "PaceLead Ventricular RV-1", "PaceLead Ventricular RV-2",
    "PaceLead Atrial RA-1", "PaceLead Atrial RA-2",
    "ImpulseGen ICD Lead 65cm", "ImpulseGen ICD Lead 75cm",
    "BiVPace Biventricular Lead Set",
    "AFMap AF Ablation Index Catheter",
    "PVArc Pulmonary Vein Arch Catheter",
    "ChannelNav Coronary Sinus Catheter",
    "MicroPace Ultra-High Density Catheter",
    "CardioPatch Epicardial Mapping Grid",
    "OmniSteer Steerable Sheath 8.5F", "OmniSteer Steerable Sheath 10F",
    "TransSeptal FastTrack Needle",
    "HeartSync Intracardiac Echo Catheter",
    "RhythmLock Cryoballoon 23mm", "RhythmLock Cryoballoon 28mm",
    "ElectroTank External Patch Array",
    "VascAccess Transseptal Access Sheath 8F",
    "SignalPath Basket Catheter 60mm",
    "PulseGuide Deflectable Quad Catheter",
    "CardioMap NavX-Compatible Catheter",
    "ElectraNav Force-Sensing Module",
    "SinusDrive His-Bundle Lead",
    "PaceLead Subcutaneous ICD Lead",
  ];

  const dentalNames = [
    "OsseoFit Implant 3.3×10mm", "OsseoFit Implant 3.3×12mm",
    "OsseoFit Implant 4.1×10mm", "OsseoFit Implant 4.1×12mm", "OsseoFit Implant 4.1×14mm",
    "OsseoFit Implant 4.8×10mm", "OsseoFit Implant 4.8×12mm",
    "BoneAnchor Zirconia Implant 4mm",
    "PearlCrown Lithium Disilicate Crown",
    "PearlCrown Zirconia Crown",
    "AlignPro Clear Aligner System",
    "PerioMend Bone Graft Putty",
    "PerioMend Membrane 25×25mm",
    "OrthoWire Nickel-Titanium Arch 0.016",
    "OrthoWire Stainless Arch 0.019×0.025",
    "BracketPro Ceramic Bracket Set",
    "BracketPro Metal Bracket Set",
    "SurgicalDrill Implant Kit 3.3mm",
    "SurgicalDrill Implant Kit 4.1mm",
    "SurgicalDrill Implant Kit 4.8mm",
    "GumShield Mucogingival Matrix",
    "SinusGraft Bone Substitute 5cc",
    "HealAbutment 4.1×5mm", "HealAbutment 4.1×7mm",
    "TemporisCAD PMMA Block 55×40mm",
  ];

  const allDeviceGroups: { names: string[]; mfrId: string; catId: string }[] = [
    { names: orthoNames,  mfrId: orthoMfrId,  catId: orthoCatId  },
    { names: cardioNames, mfrId: cardioMfrId, catId: cardioCatId },
    { names: dentalNames, mfrId: dentalMfrId, catId: dentalCatId },
  ];

  const createdDeviceIds: string[] = [];
  let deviceIndex = 0;
  for (const group of allDeviceGroups) {
    for (const name of group.names) {
      const sku = `DEMO-${String(++deviceIndex).padStart(4, "0")}`;
      const device = await db.device.upsert({
        where:  { sku_manufacturerId: { sku, manufacturerId: group.mfrId } },
        update: {},
        create: {
          sku,
          name,
          manufacturerId:   group.mfrId,
          categoryId:       group.catId,
          approvalStatus:   "approved",
          regulatoryStatus: "510k_cleared",
          fdA510kNumber:    `K${200000 + deviceIndex}`,
          description:      `Demo device — ${name}. For sales demonstration only.`,
          version:          "1.0",
          sterilizationMethod: "ETO",
          dimensionsMm:     { length: 20 + deviceIndex % 30, width: 10, height: 5 },
          createdAt:        new Date(Date.now() - deviceIndex * 86_400_000),
        },
      });
      createdDeviceIds.push(device.id);
    }
  }
  console.log(`✅  Demo devices: ${createdDeviceIds.length} created`);

  // ── 70 demo annotations ───────────────────────────────────────────────────
  const annotationTitles = [
    "Excellent primary stability with press-fit technique",
    "Caution: cement mantle thickness varies by batch",
    "Optimal irrigation flow rate for ablation catheter",
    "Case report: unusual deflection at high-torque",
    "Implant surface finish correlates with osseointegration",
    "Clinical note: sizing guide requires intraop adjustment",
    "Batch B2024 shows consistent pull-out strength",
    "Torque recommendation for abutment placement",
    "Mapping accuracy verified against CT ground truth",
    "MRI compatibility confirmed at 1.5T and 3T",
  ];

  const annotationBodies: string[] = [
    "Based on 47 consecutive cases, press-fit technique with 0.5mm underreaming achieves >90% primary stability on DXA follow-up at 6 weeks.",
    "Lots B12–B18 show a 0.8mm variance in cement mantle. Recommend templating with 1mm extra offset for cemented fixation to maintain 2–4mm ideal mantle.",
    "At 25 mL/min irrigation, lesion formation is consistent with predicted RF dosimetry. Reducing to 15 mL/min increases contact impedance variability.",
    "Catheter deflected unexpectedly at >90° torque in 2 of 34 cases. Likely related to vascular anatomy. Recommend pre-procedural CTA review for tortuous vessels.",
    "SLA-treated surfaces showed 2.3× better osseointegration at 8 weeks vs machined surfaces in our retrospective analysis of 120 implants.",
    "The manufacturer sizing guide underestimates by ~5% in patients with Dorr Type C femoral morphology. Intraoperative trialing with the next size up is recommended.",
    "Pull-out testing of batch B2024 (n=24) shows mean 3,412N ± 180N, within spec. Previous batch B2023 showed 3,100N ± 320N variance worth monitoring.",
    "Torque of 30–35 Ncm is optimal for this abutment diameter. Below 25 Ncm correlates with early micro-motion and bone loss in our 18-month follow-up.",
    "Registration error of <0.8mm against CT in 98.2% of cases using landmark-based registration protocol. Recommend 6+ landmarks for complex anatomy.",
    "Passed MRI safety testing per IEC 62570. Confirmed non-significant heating (<0.5°C) at 3T using standard birdcage coil protocols.",
  ];

  const annotationTypes = ["clinical_note", "safety_alert", "technique_tip", "case_report"] as const;
  const severities = ["low", "medium", "high"] as const;

  for (let i = 0; i < 70; i++) {
    const deviceId = createdDeviceIds[i % createdDeviceIds.length];
    const authorId = createdUserIds[i % createdUserIds.length];
    const tenantId = i % 2 === 0 ? demoTenant1.id : demoTenant2.id;
    await db.annotation.upsert({
      where: { id: `de00a000-0000-4000-8000-${String(i).padStart(12, "0")}` },
      update: {},
      create: {
        id:             `de00a000-0000-4000-8000-${String(i).padStart(12, "0")}`,
        deviceId,
        authorId,
        tenantId,
        title:          annotationTitles[i % annotationTitles.length] + ` (${i + 1})`,
        body:           annotationBodies[i % annotationBodies.length],
        annotationType: annotationTypes[i % annotationTypes.length],
        severity:       severities[i % severities.length],
        visibility:     i % 3 === 0 ? "tenant" : "platform",
        status:         "published",
        procedureType:  ["THA", "PVI", "Implant Placement"][i % 3],
        patientCount:   (i % 10) + 5,
        procedureDate:  new Date(Date.now() - i * 5 * 86_400_000),
        publishedAt:    new Date(Date.now() - i * 5 * 86_400_000),
      },
    });
  }
  console.log("✅  Demo annotations: 70 created");

  // ── 5 demo alerts (2 critical, 3 medium, 1 acknowledged) ─────────────────
  const demoAlerts = [
    {
      id:          "de00a1e7-0000-4000-8000-000000000001",
      title:       "Class I Recall — CardioMap Irrigated Ablation Catheter",
      summary:     "Potential catheter tip separation under extreme deflection in lot C2024 (batches 001–040). All affected units must be quarantined immediately.",
      alertType:   "recall",
      severity:    "critical",
      source:      "FDA MedWatch",
      externalId:  "RECALL-2024-CM-001",
      publishedAt: new Date(Date.now() - 5 * 86_400_000),
    },
    {
      id:          "de00a1e7-0000-4000-8000-000000000002",
      title:       "URGENT Field Safety Notice — OsseoFit Implant 4.1 Series",
      summary:     "Batch QC anomaly: surface oxide layer thickness below specification for OsseoFit 4.1×10mm and 4.1×12mm (lot OFD-2024-Q3). May reduce osseointegration.",
      alertType:   "safety_notice",
      severity:    "critical",
      source:      "Manufacturer (OrthoTech Solutions)",
      externalId:  "FSN-2024-OFD-Q3",
      publishedAt: new Date(Date.now() - 3 * 86_400_000),
    },
    {
      id:          "de00a1e7-0000-4000-8000-000000000003",
      title:       "Advisory — TitanFlex Hip Stem 1.5 Taper Junction",
      summary:     "Increased corrosion observed at modular taper junction in 12/3,200 retrievals. Recommend enhanced surveillance at 2-year follow-up for patients implanted 2021–2023.",
      alertType:   "advisory",
      severity:    "medium",
      source:      "EUDAMED",
      externalId:  "EUDA-2024-TF-15",
      publishedAt: new Date(Date.now() - 14 * 86_400_000),
    },
    {
      id:          "de00a1e7-0000-4000-8000-000000000004",
      title:       "Product Recall — PaceLead Atrial RA-2 Insulation Defect",
      summary:     "Microcracking in PTFE insulation jacket reported in 7 field returns from lot RA-2-2023-D. Potential for early lead failure. Mandatory patient notification required.",
      alertType:   "recall",
      severity:    "medium",
      source:      "FDA MedWatch",
      externalId:  "RECALL-2024-PL-RA2",
      publishedAt: new Date(Date.now() - 21 * 86_400_000),
    },
    {
      id:          "de00a1e7-0000-4000-8000-000000000005",
      title:       "Safety Communication — AlignPro Aligner Trimming Guidelines Update",
      summary:     "Updated trimming guide released to prevent unintended attachment interference. No recall. Software update v3.2.1 available for the digital workflow tool.",
      alertType:   "safety_notice",
      severity:    "medium",
      source:      "Manufacturer (DentalTech Pro)",
      externalId:  "SC-2024-AP-TRIM",
      publishedAt: new Date(Date.now() - 30 * 86_400_000),
    },
  ];

  for (const alert of demoAlerts) {
    await db.alert.upsert({
      where:  { id: alert.id },
      update: {},
      create: {
        ...alert,
        affectedSkus: [],
      },
    });
  }

  // Acknowledge alert 5 for demo tenant 1
  if (demoSafetyOfficer) {
    await db.tenantAlertAcknowledgement.upsert({
      where: {
        alertId_tenantId: {
          tenantId: demoTenant1.id,
          alertId:  "de00a1e7-0000-4000-8000-000000000005",
        },
      },
      update: {},
      create: {
        tenantId:          demoTenant1.id,
        alertId:           "de00a1e7-0000-4000-8000-000000000005",
        acknowledgedById:  demoSafetyOfficer,
        notes:             "Reviewed with dental equipment team. Software update scheduled for next maintenance window.",
        acknowledgedAt:    new Date(Date.now() - 25 * 86_400_000),
      },
    });
  }
  console.log("✅  Demo alerts: 5 created (1 acknowledged)");

  // ── 500 audit log entries spanning 30 days ────────────────────────────────
  const auditActions = [
    "device.viewed", "device.approved", "device.rejected",
    "annotation.created", "annotation.voted", "annotation.flagged", "annotation.endorsed",
    "alert.viewed", "alert.acknowledged",
    "document.downloaded", "document.uploaded",
    "admin.export", "admin.user_promoted", "admin.stats_viewed",
    "org.member_invited", "org.member_removed", "org.role_changed",
  ];
  const auditResourceTypes = [
    "device", "device", "device",
    "annotation", "annotation", "annotation", "annotation",
    "alert", "alert",
    "document", "document",
    "audit_log", "user", "stats",
    "invitation", "user", "user",
  ];
  const sampleIps = [
    "192.168.1.10", "192.168.1.11", "10.0.0.5",
    "172.16.0.2", "203.0.113.45",
  ];

  const auditRows: {
    userId:       string;
    tenantId:     string;
    userEmail:    string;
    userRole:     string;
    action:       string;
    resourceType: string;
    resourceId:   string;
    responseStatus: number;
    ipAddress:    string;
    userAgent:    string;
    createdAt:    Date;
  }[] = [];

  for (let i = 0; i < 500; i++) {
    const actionIdx   = i % auditActions.length;
    const userIdx     = i % demoUsers.length;
    const deviceIdx   = i % createdDeviceIds.length;
    const daysAgo     = Math.floor(i / 17); // spreads 500 events across ~30 days
    auditRows.push({
      userId:        createdUserIds[userIdx],
      tenantId:      demoUsers[userIdx].tenantId,
      userEmail:     demoUsers[userIdx].email,
      userRole:      demoUsers[userIdx].role,
      action:        auditActions[actionIdx],
      resourceType:  auditResourceTypes[actionIdx],
      resourceId:    createdDeviceIds[deviceIdx],
      responseStatus: 200,
      ipAddress:     sampleIps[i % sampleIps.length],
      userAgent:     DEMO_SEED_AGENT,
      createdAt:     new Date(Date.now() - daysAgo * 86_400_000 - (i % 86_400) * 1_000),
    });
  }

  // Insert in batches of 100
  for (let start = 0; start < auditRows.length; start += 100) {
    await db.auditLog.createMany({
      data:          auditRows.slice(start, start + 100),
      skipDuplicates: true,
    });
  }
  console.log("✅  Demo audit log: 500 entries created (spanning ~30 days)");

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n🎉  Demo data seed complete!\n");
  console.log("Demo tenant IDs:");
  console.log(`  RIGSHOSPITALET_DEMO: ${demoTenant1.id}`);
  console.log(`  AALBORG_DEMO:        ${demoTenant2.id}`);
  console.log("\nDemo users (password: use Auth0 dashboard):");
  demoUsers.forEach((u) => console.log(`  ${u.role.padEnd(26)} ${u.email}`));
}

// ── Entry point ───────────────────────────────────────────────────────────────

const isDemoMode = process.argv.includes("--demo-data");

main()
  .then(async () => {
    if (isDemoMode) {
      await seedDemoData();
    }
  })
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(() => db.$disconnect());
