import { Card, Form, Input, Button, Space, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { getLeadSources, saveLeadSources } from "@/api/phase1Api";

export default function LeadSourcesSettings() {
  const [sources, setSources] = useState([]);
  const [newSource, setNewSource] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await getLeadSources();
      setSources(res.data?.result || []);
    } catch {
      message.error("Failed to load lead sources");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addSource = () => {
    const value = newSource.trim();
    if (!value) return;
    if (sources.includes(value)) {
      message.warning("Source already exists");
      return;
    }
    setSources([...sources, value]);
    setNewSource("");
  };

  const removeSource = (item) => {
    setSources(sources.filter((s) => s !== item));
  };

  const save = async () => {
    try {
      setLoading(true);
      await saveLeadSources(sources);
      message.success("Lead sources saved");
    } catch (err) {
      message.error(err?.response?.data?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Lead Sources (Configurable)">
      <p style={{ color: "#666", marginBottom: 16 }}>
        These options appear in the Lead form dropdown for all admins.
      </p>
      <Space wrap style={{ marginBottom: 16 }}>
        {sources.map((s) => (
          <Tag key={s} closable onClose={() => removeSource(s)}>
            {s}
          </Tag>
        ))}
      </Space>
      <Space.Compact style={{ width: "100%", maxWidth: 480, marginBottom: 16 }}>
        <Input
          placeholder="New lead source"
          value={newSource}
          onChange={(e) => setNewSource(e.target.value)}
          onPressEnter={addSource}
        />
        <Button onClick={addSource}>Add</Button>
      </Space.Compact>
      <Button type="primary" loading={loading} onClick={save}>
        Save Lead Sources
      </Button>
    </Card>
  );
}
