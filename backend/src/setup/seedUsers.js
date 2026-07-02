const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const DEFAULT_PASSWORDS = {
  admin: "Admin@123",
  worker: "Worker@123",
  customer: "Customer@123",
  siteEngineer: "SiteEngineer@123",
};

function formatDateToDDMMYYYY(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

const DEFAULT_USERS = [
  {
    role: "admin",
    name: "System Admin",
    email: "admin@crm.com",
    password: DEFAULT_PASSWORDS.admin,
  },
  {
    role: "worker",
    name: "Default Worker",
    email: "worker@crm.com",
    workerId: "W-1001",
    password: DEFAULT_PASSWORDS.worker,
    employee: {
      employeeId: "EMP123",
      phone: "+910000000101",
      designation: "Welder",
      department: "Fabrication",
      joiningDate: "01-01-2024",
      address: "Factory Floor, Unit A",
    },
  },
  {
    role: "worker",
    name: "Installation Specialist",
    email: "installer@crm.com",
    workerId: "W-1002",
    password: DEFAULT_PASSWORDS.worker,
    employee: {
      employeeId: "EMP124",
      phone: "+910000000102",
      designation: "Installer",
      department: "Installation",
      joiningDate: "15-02-2024",
      address: "Site Operations, Unit B",
    },
  },
  {
    role: "worker",
    name: "QC Inspector",
    email: "qc@crm.com",
    workerId: "W-1003",
    password: DEFAULT_PASSWORDS.worker,
    employee: {
      employeeId: "EMP125",
      phone: "+910000000103",
      designation: "QC Inspector",
      department: "Quality Control",
      joiningDate: "10-03-2024",
      address: "QC Lab, Unit C",
    },
  },
  {
    role: "worker",
    name: "Planning Engineer",
    email: "planner@crm.com",
    workerId: "W-1004",
    password: DEFAULT_PASSWORDS.worker,
    employee: {
      employeeId: "EMP126",
      phone: "+910000000104",
      designation: "Planner",
      department: "Planning",
      joiningDate: "20-04-2024",
      address: "Planning Office, Unit D",
    },
  },
  {
    role: "siteEngineer",
    name: "Site Engineer",
    email: "siteengineer@crm.com",
    password: DEFAULT_PASSWORDS.siteEngineer,
    employee: {
      employeeId: "EMP200",
      phone: "+910000000200",
      designation: "Site Engineer",
      department: "Planning",
      joiningDate: "01-06-2024",
      address: "Field Operations",
    },
  },
  {
    role: "customer",
    name: "Default Customer",
    email: "customer@crm.com",
    password: DEFAULT_PASSWORDS.customer,
    companyName: "Demo Customer Company",
    mobile: "+910000000001",
    customerRecord: {
      phone: "+910000000001",
      address: "123 Business Park, City Center",
      contactPerson: "Default Customer",
    },
  },
];

function buildUserPayload(User, entry, passwordHash) {
  const payload = {
    name: entry.name,
    email: entry.email.toLowerCase().trim(),
    password: passwordHash,
    role: entry.role,
    isActive: true,
  };

  if (entry.role === "worker" && entry.workerId) {
    payload.workerId = entry.workerId;
  }

  if (entry.role === "customer") {
    payload.companyName = entry.companyName;
    payload.mobile = entry.mobile;
  }

  if (User.schema?.paths?.enabled) payload.enabled = true;
  if (User.schema?.paths?.removed) payload.removed = false;
  if (User.schema?.paths?.status) payload.status = "Active";

  return payload;
}

async function ensureAuthUser(User, entry) {
  const email = entry.email.toLowerCase().trim();
  let user = null;

  if (entry.role === "worker" && entry.workerId) {
    user = await User.findOne({
      role: "worker",
      $or: [{ workerId: entry.workerId }, { email }],
    });
  } else {
    user = await User.findOne({ role: entry.role, email });
  }

  if (user) {
    return user;
  }

  const passwordHash = await bcrypt.hash(entry.password, 10);
  user = await User.create(buildUserPayload(User, entry, passwordHash));

  console.log(`✅ ${entry.role} user created: ${entry.role === "worker" ? entry.workerId : email}`);

  return user;
}

async function ensureEmployeeRecord(Employee, entry) {
  if (!entry.employee) return;

  const email = entry.email.toLowerCase().trim();
  let employee = await Employee.findOne({
    $or: [{ email }, { employeeId: entry.employee.employeeId }],
  });

  if (employee) {
    return employee;
  }

  employee = await Employee.create({
    employeeId: entry.employee.employeeId,
    name: entry.name,
    email,
    phone: entry.employee.phone,
    designation: entry.employee.designation,
    department: entry.employee.department,
    joiningDate: entry.employee.joiningDate,
    resignationDate: "",
    status: "Active",
    address: entry.employee.address || "",
  });

  console.log(`✅ Employee record created: ${entry.employee.employeeId} (${entry.name})`);

  return employee;
}

async function ensureCustomerRecord(Customer, user, entry) {
  if (entry.role !== "customer" || !entry.customerRecord) return;

  const email = entry.email.toLowerCase().trim();
  let customer = await Customer.findOne({
    $or: [{ email }, { user: user._id }, { portalEmail: email }],
  });

  if (customer) {
    if (!user.customer || String(user.customer) !== String(customer._id)) {
      user.customer = customer._id;
      await user.save();
    }
    if (!customer.user || String(customer.user) !== String(user._id)) {
      customer.user = user._id;
      await customer.save();
    }
    return customer;
  }

  customer = await Customer.create({
    name: entry.name,
    companyName: entry.companyName,
    email,
    mobile: entry.mobile,
    phone: entry.customerRecord.phone || entry.mobile,
    address: entry.customerRecord.address || "",
    contactPerson: entry.customerRecord.contactPerson || entry.name,
    portalEmail: email,
    portalInvitedAt: new Date(),
    status: "Active",
    user: user._id,
  });

  user.customer = customer._id;
  await user.save();

  console.log(`✅ Customer record created: ${email}`);

  return customer;
}

async function seedDefaultUsers() {
  const User = mongoose.models.User;
  const Employee = mongoose.models.Employee;
  const Customer = mongoose.models.Customer;

  if (!User) {
    throw new Error("User model not loaded");
  }

  console.log("🌱 Seeding default users...");

  for (const entry of DEFAULT_USERS) {
    try {
      const user = await ensureAuthUser(User, entry);

      if (Employee && entry.employee) {
        await ensureEmployeeRecord(Employee, entry);
      }

      if (Customer && entry.role === "customer") {
        await ensureCustomerRecord(Customer, user, entry);
      }
    } catch (err) {
      console.log(`⚠️ Seed skipped for ${entry.email}: ${err.message}`);
    }
  }

  console.log("🌱 Default user seed complete.");
  console.log("");
  console.log("Login credentials:");
  console.log("  Admin         → admin@crm.com / Admin@123");
  console.log("  Site Engineer → siteengineer@crm.com / SiteEngineer@123");
  console.log("  Employee      → W-1001..W-1004 / Worker@123 (or worker email)");
  console.log("  Customer      → customer@crm.com / Customer@123");
}

module.exports = {
  DEFAULT_USERS,
  DEFAULT_PASSWORDS,
  formatDateToDDMMYYYY,
  seedDefaultUsers,
};
