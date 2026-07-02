export function formatLeadAddress(addr = {}) {
  return [addr.line1, addr.line2, addr.city, addr.state, addr.postcode, addr.country]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(", ");
}

export function getLeadAddresses(lead) {
  const fromList = Array.isArray(lead?.addresses)
    ? lead.addresses.filter((a) => a?.line1 || a?.city || a?.postcode)
    : [];
  if (fromList.length) return fromList;
  if (lead?.siteAddress) {
    return [
      {
        type: "Site",
        line1: lead.siteAddress,
        line2: "",
        city: "",
        state: "",
        postcode: "",
        country: "",
        isPrimary: true,
      },
    ];
  }
  return [];
}

export function getLeadSiteAddress(lead) {
  const addresses = getLeadAddresses(lead);
  const primary =
    addresses.find((a) => a.type === "Site" && a.isPrimary) ||
    addresses.find((a) => a.type === "Site") ||
    addresses.find((a) => a.isPrimary) ||
    addresses[0];
  return formatLeadAddress(primary) || lead?.siteAddress || "";
}

export function normalizeLeadAddresses(values = {}) {
  const addresses = (values.addresses || [])
    .map((a) => ({
      type: (a?.type || "Site").trim(),
      line1: (a?.line1 || "").trim(),
      line2: (a?.line2 || "").trim(),
      city: (a?.city || "").trim(),
      state: (a?.state || "").trim(),
      postcode: (a?.postcode || "").trim(),
      country: (a?.country || "").trim(),
      isPrimary: !!a?.isPrimary,
    }))
    .filter((a) => a.line1 || a.city || a.postcode);

  if (!addresses.length && values.siteAddress) {
    addresses.push({
      type: "Site",
      line1: String(values.siteAddress).trim(),
      line2: "",
      city: "",
      state: "",
      postcode: "",
      country: "",
      isPrimary: true,
    });
  }

  if (addresses.length && !addresses.some((a) => a.isPrimary)) {
    const siteIdx = addresses.findIndex((a) => a.type === "Site");
    if (siteIdx >= 0) addresses[siteIdx].isPrimary = true;
    else addresses[0].isPrimary = true;
  }

  const siteAddress = getLeadSiteAddress({ addresses, siteAddress: values.siteAddress });

  return { addresses, siteAddress };
}
