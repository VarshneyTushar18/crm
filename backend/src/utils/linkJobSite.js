const Site = require("../models/appModels/Site");
const Job = require("../models/appModels/Job");

const normalizeSiteText = (value) => String(value || "").trim();

/**
 * Find or create a Site from free-text and link it to the job via siteId.
 * No-op when the job has neither site text nor an existing siteId.
 */
async function ensureSiteForJob(jobDoc, siteTextOverride) {
  if (!jobDoc) return null;

  const siteText = normalizeSiteText(
    siteTextOverride !== undefined ? siteTextOverride : jobDoc.site
  );

  if (!siteText && !jobDoc.siteId) return null;

  if (jobDoc.siteId) {
    if (siteText) {
      const existing = await Site.findById(jobDoc.siteId);
      if (existing) {
        const patch = {};
        // Keep Site in sync when job site text changes
        if (existing.address !== siteText) patch.address = siteText;
        if (!existing.name || existing.name === existing.address) {
          patch.name = siteText;
        }
        if (Object.keys(patch).length) {
          await Site.findByIdAndUpdate(jobDoc.siteId, { $set: patch });
        }
      }
    }
    if (siteText && !normalizeSiteText(jobDoc.site)) {
      jobDoc.site = siteText;
      await jobDoc.save();
    }
    return jobDoc.siteId;
  }

  let site = await Site.findOne({
    $or: [{ name: siteText }, { address: siteText }],
  });

  if (!site) {
    site = await Site.create({
      name: siteText,
      address: siteText,
    });
  }

  jobDoc.siteId = site._id;
  if (!normalizeSiteText(jobDoc.site)) {
    jobDoc.site = siteText;
  }
  await jobDoc.save();
  return site._id;
}

/**
 * Resolve a job by Mongo _id or human jobId string.
 */
async function resolveJob(jobRef) {
  if (!jobRef) return null;
  const ref = String(jobRef).trim();
  if (!ref) return null;

  if (/^[a-fA-F0-9]{24}$/.test(ref)) {
    const byId = await Job.findById(ref);
    if (byId) return byId;
  }

  return Job.findOne({ jobId: ref });
}

/**
 * Create a Site and attach it to a required job.
 */
async function createSiteForJob({ name, code, city, address, notes, jobRef }) {
  const job = await resolveJob(jobRef);
  if (!job) {
    const err = new Error("Job is required and must exist");
    err.status = 400;
    throw err;
  }

  const siteName = normalizeSiteText(name) || normalizeSiteText(address);
  if (!siteName) {
    const err = new Error("Site name is required");
    err.status = 400;
    throw err;
  }

  const site = await Site.create({
    name: siteName,
    code: normalizeSiteText(code),
    city: normalizeSiteText(city),
    address: normalizeSiteText(address) || siteName,
    notes: normalizeSiteText(notes),
  });

  job.siteId = site._id;
  job.site = normalizeSiteText(address) || siteName;
  await job.save();

  return { site, job };
}

/**
 * Backfill siteId for jobs that have free-text site but no siteId.
 */
async function backfillJobSites() {
  const jobs = await Job.find({
    removed: { $ne: true },
    $or: [{ siteId: null }, { siteId: { $exists: false } }],
    site: { $exists: true, $nin: [null, ""] },
  });

  for (const job of jobs) {
    await ensureSiteForJob(job);
  }
}

module.exports = {
  ensureSiteForJob,
  resolveJob,
  createSiteForJob,
  backfillJobSites,
  normalizeSiteText,
};
