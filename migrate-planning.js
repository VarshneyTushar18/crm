const mongoose = require("mongoose");
const Job = require("./src/models/appModels/Job");
require("dotenv").config();

async function migrate() {
  try {
    await mongoose.connect(process.env.DATABASE || "mongodb://localhost:27017/idurar");
    console.log("Connected to MongoDB...");

    // we will find all jobs and check if clientApproval contains planning data
    const jobs = await Job.find({});
    let migratedCount = 0;

    for (const job of jobs) {
      if (job.workflowEvents) {
        let changed = false;
        
        // Check if old "Planning" data is stuck inside clientApproval
        const ca = job.workflowEvents.clientApproval;
        if (ca && (ca.completedBy === "Planning Module" || ca.approvalDate)) {
          // It's Planning data! Move it to planning stage
          if (!job.workflowEvents.planning) job.workflowEvents.planning = {};
          
          Object.assign(job.workflowEvents.planning, ca);
          
          // Reset client approval so it's clean
          job.workflowEvents.clientApproval = {
            isCompleted: false
          };
          
          changed = true;
        }

        // The user also mentioned: "if IFC approved client approval is completed and drafting is also completed"
        // Let's sync past completed drafting records with client Approval
        if (job.workflowEvents.drafting && job.workflowEvents.drafting.isCompleted && job.workflowEvents.clientApproval) {
           if (!job.workflowEvents.clientApproval.isCompleted) {
               job.workflowEvents.clientApproval.isCompleted = true;
               job.workflowEvents.clientApproval.completedAt = job.workflowEvents.drafting.completedAt || new Date();
               job.workflowEvents.clientApproval.completedBy = "Drafting Module (IFC)";
               changed = true;
           }
        }

        if (changed) {
          job.markModified("workflowEvents");
          await job.save();
          console.log(`Migrated job ${job.jobId}`);
          migratedCount++;
        }
      }
    }

    console.log(`Migration complete. Jobs migrated: ${migratedCount}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrate();
