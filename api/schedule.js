export default async function handler(req, res) {
const { kelas, subject } = req.query;

const url = `https://e2oc2ege54.execute-api.ap-southeast-1.amazonaws.com/slotschedule?kelas=${kelas}&sem=2&year=2026&curriculum=Kurikulum%20Merdeka&subject=${encodeURIComponent(subject)}`;

try {
const response = await fetch(url);
const data = await response.json();

```
res.setHeader("Access-Control-Allow-Origin", "*");
res.status(200).json(data);
```

} catch (e) {
res.status(500).json({ error: "proxy failed" });
}
}
