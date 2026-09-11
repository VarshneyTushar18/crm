const Site = require("../models/appModels/Site");
const Job = require("../models/appModels/Job");
const {
  createSiteForJob,
  resolveJob,
  backfillJobSites,
  normalizeSiteText,
} = require("../utils/linkJobSite");

const attachJobsToSites = async (sites) => {
  const ids = sites.map((s) => s._id);
  const jobs = await Job.find({
    siteId: { $in: ids },
    removed: { $ne: true },
  })
    .select("jobId customer site siteId stage systemState")
    .lean();

  const bySite = {};
  for (const job of jobs) {
    const key = String(job.siteId);
    if (!bySite[key]) bySite[key] = [];
    bySite[key].push(job);
  }

  return sites.map((site) => {
    const linked = bySite[String(site._id)] || [];
    const primary = linked[0] || null;
    return {
      ...site,
      jobs: linked,
      job: primary,
      jobId: primary?.jobId || "",
      jobMongoId: primary?._id || null,
      customer: primary?.customer || "",
    };
  });
};

// GET /procurement/site/list
exports.list = async (req, res) => {
  try {
    await backfillJobSites();

    const filter = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true";
    }

    const sites = await Site.find(filter).sort({ createdAt: -1 }).lean();
    let result = await attachJobsToSites(sites);

    // Only show sites that are linked to at least one job
    result = result.filter((s) => (s.jobs || []).length > 0);

    if (req.query.jobId) {
      const jobRef = String(req.query.jobId).trim();
      result = result.filter(
        (s) =>
          String(s.jobMongoId) === jobRef ||
          String(s.jobId).toLowerCase() === jobRef.toLowerCase() ||
          (s.jobs || []).some(
            (j) =>
              String(j._id) === jobRef ||
              String(j.jobId).toLowerCase() === jobRef.toLowerCase()
          )
      );
    }

    return res.json({ success: true, result, message: "Site list" });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

// GET /procurement/site/read/:id
exports.read = async (req, res) => {
  try {
    const site = await Site.findById(req.params.id).lean();
    if (!site) {
      return res.status(404).json({ success: false, message: "Site not found" });
    }
    const [result] = await attachJobsToSites([site]);
    return res.json({ success: true, result, message: "Site fetched" });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

// POST /procurement/site/create
exports.create = async (req, res) => {
  try {
    const jobRef = req.body.jobId || req.body.jobMongoId || req.body.job;
    if (!jobRef) {
      return res.status(400).json({
        success: false,
        message: "Job is required when adding a site",
      });
    }

    const { site, job } = await createSiteForJob({
      name: req.body.name,
      code: req.body.code,
      city: req.body.city,
      address: req.body.address,
      notes: req.body.notes,
      jobRef,
    });

    const [result] = await attachJobsToSites([site.toObject()]);
    return res.status(201).json({
      success: true,
      result: { ...result, linkedJobId: job.jobId },
      message: "Site created and linked to job",
    });
  } catch (e) {
    const status = e.status || 400;
    return res.status(status).json({ success: false, message: e.message });
  }
};

// PATCH /procurement/site/update/:id
exports.update = async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);
    if (!site) {
      return res.status(404).json({ success: false, message: "Site not found" });
    }

    const { name, code, city, address, notes, isActive, jobId, jobMongoId, job } =
      req.body;

    if (name !== undefined) site.name = normalizeSiteText(name) || site.name;
    if (code !== undefined) site.code = normalizeSiteText(code);
    if (city !== undefined) site.city = normalizeSiteText(city);
    if (address !== undefined) site.address = normalizeSiteText(address);
    if (notes !== undefined) site.notes = normalizeSiteText(notes);
    if (isActive !== undefined) site.isActive = Boolean(isActive);

    await site.save();

    const jobRef = jobId || jobMongoId || job;
    if (jobRef) {
      const targetJob = await resolveJob(jobRef);
      if (!targetJob) {
        return res.status(400).json({
          success: false,
          message: "Selected job was not found",
        });
      }

      // Clear previous jobs pointing at this site (except the new target)
      await Job.updateMany(
        { siteId: site._id, _id: { $ne: targetJob._id } },
        { $set: { siteId: null } }
      );

      targetJob.siteId = site._id;
      targetJob.site =
        normalizeSiteText(site.address) ||
        normalizeSiteText(site.name) ||
        targetJob.site;
      await targetJob.save();
    }

    const lean = site.toObject();
    const [result] = await attachJobsToSites([lean]);
    return res.json({ success: true, result, message: "Site updated" });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

// DELETE /procurement/site/delete/:id
exports.remove = async (req, res) => {
  try {
    const site = await Site.findByIdAndDelete(req.params.id);
    if (!site) {
      return res.status(404).json({ success: false, message: "Site not found" });
    }

    await Job.updateMany({ siteId: site._id }, { $set: { siteId: null } });

    return res.json({ success: true, result: site, message: "Site deleted" });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};
