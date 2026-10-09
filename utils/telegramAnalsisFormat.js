const formatMoney = (n) => (n ?? 0).toLocaleString();

const buildTextTable = (rows, columns) => {
  const header = columns.map((c) => c.label).join(" | ");
  const lines = rows.map((row) => columns.map((c) => c.value(row)).join(" | "));
  return "```\n" + [header, ...lines].join("\n") + "\n```";
};


const buildNarrativeOrInsights = (section) => {
  if (section.narrative) return `\n_${section.narrative}_\n`;
  if (section.insights.length > 0) return "\n" + section.insights.map((line) => `• ${line}`).join("\n") + "\n";
  return "";
};


const DAILY_COLUMNS = [
  { label: "Shop", value: (r) => r.name },
  { label: "Revenue", value: (r) => formatMoney(r.totalRevenue) },
  { label: "Income", value: (r) => formatMoney(r.totalIncome) },
];

const buildTelegramAnalysisMessage = (dateLabel, sections) => {
  const totalDailyRevenue = sections.daily.rows.reduce((sum, r) => sum + r.totalRevenue, 0);

  let text = `*Daily Analysis — ${dateLabel}*\n\n`;
  text += `Total revenue today: *${formatMoney(totalDailyRevenue)} Birr*\n`;
  text += buildTextTable(sections.daily.rows, DAILY_COLUMNS) + "\n";

 text += buildNarrativeOrInsights(sections.daily);

  if (sections.weekly) {
    const totalWeekly = sections.weekly.rows.reduce((sum, r) => sum + r.totalRevenue, 0);
    text += `\n*This Week's Summary*\nTotal: *${formatMoney(totalWeekly)} Birr*\n`;
    text += buildTextTable(sections.weekly.rows, DAILY_COLUMNS) + "\n";
    text += buildNarrativeOrInsights(sections.weekly);
  }

  if (sections.monthly) {
    const totalProfit = sections.monthly.rows.reduce((sum, r) => sum + r.netProfit, 0);
    text += `\n*This Month's Financial Summary*\nNet Profit: *${formatMoney(totalProfit)} Birr*\n`;
    text += buildTextTable(
      sections.monthly.rows,
      [...DAILY_COLUMNS, { label: "Profit", value: (r) => formatMoney(r.netProfit) }]
    ) + "\n";
    text += buildNarrativeOrInsights(sections.monthly);
  }

  return text;
};

module.exports = { buildTelegramAnalysisMessage };