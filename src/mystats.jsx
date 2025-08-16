import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

function MyStats({ data }) {
  return (
    <div style={{ padding: "2rem" }}>
      <h2>Meine Statistik</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="frage" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="korrekt" fill="#82ca9d" />
          <Bar dataKey="falsch" fill="#ff6b6b" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default MyStats;
