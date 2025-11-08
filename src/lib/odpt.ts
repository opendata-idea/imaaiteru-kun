export type RailwayOption = {
  label: string;
  value: string;
  color?: string;
  code?: string;
};

export async function fetchRailwayOptions(): Promise<RailwayOption[]> {
  const key = process.env.ODPT_CONSUMER_KEY;
  if (!key) {
    throw new Error("ODPT_CONSUMER_KEY is not set");
  }

  const url = `https://api-challenge.odpt.org/api/v4/odpt:Railway?odpt:operator=odpt.Operator:JR-East&acl:consumerKey=${key}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });

  if (!res.ok) {
    throw new Error(`Failed to fetch railways: ${res.status}`);
  }

  const rows: any[] = await res.json();

  return rows
    .map((r) => ({
      label: r["dc:title"] ?? r["odpt:railwayTitle"]?.ja ?? r["owl:sameAs"],
      value: r["owl:sameAs"],
      color: r["odpt:color"],
      code: r["odpt:lineCode"],
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ja"));
}

