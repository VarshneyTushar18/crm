import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Tag,
  Card,
  Row,
  Col,
  Typography,
  Divider,
  message,
  Empty,
  Space,
  Popconfirm,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "./employeeApi";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea, Search } = Input;

const DEPARTMENTS = [
  "Fabrication",
  "Installation",
  "Quality Control",
  "Planning",
  "Drafting",
  "Site Measurement",
  "Admin",
  "HR",
];

const DESIGNATIONS = [
  "Welder",
  "Installer",
  "Supervisor",
  "Manager",
  "Engineer",
  "QC Inspector",
  "Planner",
  "Draftsman",
  "HR Executive",
  "Admin Executive",
];

export default function Employee() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [editingEmployee, setEditingEmployee] = useState(null);
  const [searchText, setSearchText] = useState("");

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);

      const res = await getEmployees();
      const result = Array.isArray(res?.result) ? res.result : [];

      setEmployees(result);
    } catch (error) {
      setEmployees([]);
      message.error(
        error?.response?.data?.message || "Failed to fetch employees"
      );
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((item) => item.status === "Active").length;
    const inactive = employees.filter(
      (item) => item.status === "Inactive"
    ).length;

    return { total, active, inactive };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    if (!q) return employees;

    return employees.filter((item) => {
      const name = item?.name?.toLowerCase() || "";
      const employeeId = item?.employeeId?.toLowerCase() || "";

      return name.includes(q) || employeeId.includes(q);
    });
  }, [employees, searchText]);

  const handleCreateEmployee = async () => {
    try {
      const values = await createForm.validateFields();

      const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        designation: values.designation,
        department: values.department,
        joiningDate: values.joiningDate
          ? values.joiningDate.format("DD-MM-YYYY")
          : "",
        status: values.status,
        address: values.address || "",
      };

      const res = await createEmployee(payload);

      if (res?.success) {
        message.success(res?.message || "Employee created successfully");
        createForm.resetFields();
        setIsCreateModalOpen(false);
        fetchEmployees();
      } else {
        message.error(res?.message || "Failed to create employee");
      }
    } catch (error) {
      if (error?.errorFields) return;

      message.error(
        error?.response?.data?.message || "Failed to create employee"
      );
    }
  };

  const openEditModal = (record) => {
    setEditingEmployee(record);

    editForm.setFieldsValue({
      name: record.name,
      email: record.email,
      phone: record.phone,
      designation: record.designation,
      department: record.department,
      joiningDate: record.joiningDate
        ? dayjs(record.joiningDate, "DD-MM-YYYY")
        : null,
      resignationDate: record.resignationDate
        ? dayjs(record.resignationDate, "DD-MM-YYYY")
        : null,
      status: record.status,
      address: record.address,
    });

    setIsEditModalOpen(true);
  };

  const handleUpdateEmployee = async () => {
    try {
      const values = await editForm.validateFields();

      let resignationDate = "";

      if (values.status === "Inactive") {
        resignationDate = dayjs().format("DD-MM-YYYY");
      }

      if (values.status === "Active") {
        resignationDate = "";
      }

      const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        designation: values.designation,
        department: values.department,
        joiningDate: values.joiningDate
          ? values.joiningDate.format("DD-MM-YYYY")
          : "",
        resignationDate,
        status: values.status,
        address: values.address || "",
      };

      const res = await updateEmployee(editingEmployee._id, payload);

      if (res?.success) {
        setIsEditModalOpen(false);
        setEditingEmployee(null);
        editForm.resetFields();

        message.success(
          values.status === "Inactive"
            ? "Employee marked as inactive and resignation date updated automatically"
            : res?.message || "Employee updated successfully"
        );

        fetchEmployees();
      } else {
        message.error(res?.message || "Failed to update employee");
      }
    } catch (error) {
      if (error?.errorFields) return;

      message.error(
        error?.response?.data?.message || "Failed to update employee"
      );
    }
  };

  const handleDeleteEmployee = async (id) => {
    try {
      const res = await deleteEmployee(id);

      if (res?.success) {
        message.success(res?.message || "Employee deleted successfully");
        fetchEmployees();
      } else {
        message.error(res?.message || "Failed to delete employee");
      }
    } catch (error) {
      message.error(
        error?.response?.data?.message || "Failed to delete employee"
      );
    }
  };

  const columns = [
    {
      title: "Employee ID",
      dataIndex: "employeeId",
      width: 130,
    },
    {
      title: "Name",
      dataIndex: "name",
      width: 180,
    },
    {
      title: "Email",
      dataIndex: "email",
      width: 240,
    },
    {
      title: "Phone",
      dataIndex: "phone",
      width: 140,
    },
    {
      title: "Designation",
      dataIndex: "designation",
      width: 160,
    },
    {
      title: "Department",
      dataIndex: "department",
      width: 160,
    },
    {
      title: "Joining Date",
      dataIndex: "joiningDate",
      width: 140,
      render: (value) => value || "-",
    },
    {
      title: "Resignation Date",
      dataIndex: "resignationDate",
      width: 150,
      render: (value) => value || "-",
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (value) => (
        <Tag color={value === "Active" ? "green" : "red"}>{value}</Tag>
      ),
    },
    {
      title: "Action",
      width: 180,
      fixed: "right",
      render: (_, record) => (
        <Space wrap>
          <Button type="link" onClick={() => openEditModal(record)}>
            Edit
          </Button>

          <Popconfirm
            title="Delete Employee"
            description="Are you sure you want to delete this employee?"
            onConfirm={() => handleDeleteEmployee(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <Row justify="space-between" align="middle" gutter={[16, 16]}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Employee Management
          </Title>
          <Text type="secondary">
            Create and manage employee records under HR module
          </Text>
        </Col>

        <Col>
          <Button type="primary" onClick={() => setIsCreateModalOpen(true)}>
            + Create Employee
          </Button>
        </Col>
      </Row>

      <Divider />

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Text type="secondary">Total Employees</Text>
            <Title level={4} style={{ margin: "8px 0 0" }}>
              {summary.total}
            </Title>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={8}>
          <Card>
            <Text type="secondary">Active Employees</Text>
            <Title level={4} style={{ margin: "8px 0 0", color: "#389e0d" }}>
              {summary.active}
            </Title>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={8}>
          <Card>
            <Text type="secondary">Inactive Employees</Text>
            <Title level={4} style={{ margin: "8px 0 0", color: "#cf1322" }}>
              {summary.inactive}
            </Title>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 20 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12} lg={10}>
            <Search
              allowClear
              placeholder="Search by employee name or employee ID"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={(value) => setSearchText(value)}
            />
          </Col>

          <Col xs={24} md={12} lg={14}>
            <Text type="secondary">
              Search example: <b>Rahul</b> or <b>EMP123</b>
            </Text>
          </Col>
        </Row>
      </Card>

      {filteredEmployees.length ? (
        <Table
          rowKey="_id"
          loading={loading}
          columns={columns}
          dataSource={filteredEmployees}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1600 }}
        />
      ) : (
        <Card>
          <Empty
            description={
              searchText
                ? "No employee found for this search"
                : "No employees found"
            }
          />
        </Card>
      )}

      <Modal
        title="Create Employee"
        open={isCreateModalOpen}
        onOk={handleCreateEmployee}
        onCancel={() => {
          setIsCreateModalOpen(false);
          createForm.resetFields();
        }}
        okText="Create"
        width={760}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ status: "Active" }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Employee ID">
                <Input value="Auto-generated by backend (e.g. EMP123)" disabled />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Employee Name"
                name="name"
                rules={[{ required: true, message: "Please enter employee name" }]}
              >
                <Input placeholder="Enter employee name" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  { required: true, message: "Please enter email" },
                  { type: "email", message: "Please enter valid email" },
                ]}
              >
                <Input placeholder="Enter email" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Phone Number"
                name="phone"
                rules={[
                  { required: true, message: "Please enter phone number" },
                  {
                    pattern: /^[0-9]{10}$/,
                    message: "Phone number must be 10 digits",
                  },
                ]}
              >
                <Input placeholder="Enter 10 digit number" maxLength={10} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Designation"
                name="designation"
                rules={[{ required: true, message: "Please select designation" }]}
              >
                <Select placeholder="Select designation">
                  {DESIGNATIONS.map((item) => (
                    <Option key={item} value={item}>
                      {item}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Department"
                name="department"
                rules={[{ required: true, message: "Please select department" }]}
              >
                <Select placeholder="Select department">
                  {DEPARTMENTS.map((item) => (
                    <Option key={item} value={item}>
                      {item}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Joining Date"
                name="joiningDate"
                rules={[{ required: true, message: "Please select joining date" }]}
              >
                <DatePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Status"
                name="status"
                rules={[{ required: true, message: "Please select status" }]}
              >
                <Select>
                  <Option value="Active">Active</Option>
                  <Option value="Inactive">Inactive</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="Resignation Date">
                <DatePicker
                  style={{ width: "100%" }}
                  format="DD-MM-YYYY"
                  disabled
                  placeholder="Empty by default"
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item label="Address" name="address">
                <TextArea rows={3} placeholder="Enter address" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="Edit Employee"
        open={isEditModalOpen}
        onOk={handleUpdateEmployee}
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingEmployee(null);
          editForm.resetFields();
        }}
        okText="Update"
        width={760}
      >
        <Form
          form={editForm}
          layout="vertical"
          onValuesChange={(changedValues) => {
            if (changedValues.status === "Inactive") {
              editForm.setFieldsValue({
                resignationDate: dayjs(),
              });
            }

            if (changedValues.status === "Active") {
              editForm.setFieldsValue({
                resignationDate: null,
              });
            }
          }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Employee ID">
                <Input value={editingEmployee?.employeeId || ""} disabled />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Employee Name"
                name="name"
                rules={[{ required: true, message: "Please enter employee name" }]}
              >
                <Input placeholder="Enter employee name" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  { required: true, message: "Please enter email" },
                  { type: "email", message: "Please enter valid email" },
                ]}
              >
                <Input placeholder="Enter email" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Phone Number"
                name="phone"
                rules={[
                  { required: true, message: "Please enter phone number" },
                  {
                    pattern: /^[0-9]{10}$/,
                    message: "Phone number must be 10 digits",
                  },
                ]}
              >
                <Input placeholder="Enter 10 digit number" maxLength={10} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Designation"
                name="designation"
                rules={[{ required: true, message: "Please select designation" }]}
              >
                <Select placeholder="Select designation">
                  {DESIGNATIONS.map((item) => (
                    <Option key={item} value={item}>
                      {item}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Department"
                name="department"
                rules={[{ required: true, message: "Please select department" }]}
              >
                <Select placeholder="Select department">
                  {DEPARTMENTS.map((item) => (
                    <Option key={item} value={item}>
                      {item}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Joining Date"
                name="joiningDate"
                rules={[{ required: true, message: "Please select joining date" }]}
              >
                <DatePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Status"
                name="status"
                rules={[{ required: true, message: "Please select status" }]}
                extra="If status becomes inactive, resignation date updates automatically."
              >
                <Select placeholder="Select status">
                  <Option value="Active">Active</Option>
                  <Option value="Inactive">Inactive</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="Resignation Date" name="resignationDate">
                <DatePicker
                  style={{ width: "100%" }}
                  format="DD-MM-YYYY"
                  disabled
                  placeholder="Auto-updated when employee becomes inactive"
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item label="Address" name="address">
                <TextArea rows={3} placeholder="Enter address" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <div style={{ marginTop: 8 }}>
          <Space direction="vertical" size={2}>
            <Text type="secondary">
              Resignation date stays empty for active employees.
            </Text>
            <Text type="secondary">
              When admin marks employee inactive, resignation date is set automatically.
            </Text>
          </Space>
        </div>
      </Modal>
    </div>
  );
}