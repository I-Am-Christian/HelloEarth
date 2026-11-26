import { db } from "./supabase-client.js";

const root = document.getElementById("pricing-grid");
let loadedPlans = null;
const translate = (key, values = {}) => window.HelloEarthI18n?.t(key, values) ?? key.replace(/\{([^}]+)\}/g, (_, field) => String(values[field] ?? ""));
const featureDescriptions = {
  free: "Start with your students. Local Atlas is a separate desktop prototype.",
  starter: "More student capacity with planned local Atlas integration.",
  growth: "Planned managed cloud Atlas with a capped monthly allowance.",
  studio: "Planned managed cloud Atlas with a larger monthly allowance."
};
function plannedAiFeatures(plan) {
  const runtime = plan.planned_atlas_runtime === "cloud" ? "cloud" : "local";
  const items = [
    runtime === "local"
      ? "Local Atlas on your own computer — planned plan integration"
      : "Cloud-hosted Atlas included when launched — monthly usage cap to be confirmed"
  ];
  if (plan.planned_byo_api_support) {
    items.push("Bring your own supported AI API — planned on every tier");
  }
  items.push("Your own AI provider charges you separately");
  return items;
}
function card(plan) {
  const article = document.createElement("article");
  article.className = "plan-card" + (plan.code === "growth" ? " is-popular" : "");
  article.dataset.tier = ["free","starter","growth","studio"].includes(plan.code) ? plan.code : "other";
  if (plan.code === "growth") {
    const badge = document.createElement("div");
    badge.className = "plan-popular";
    badge.textContent = "Popular choice";
    article.append(badge);
  }
  const heading = document.createElement("div");
  const name = document.createElement("h2");
  name.className = "plan-title";
  name.textContent = plan.name;
  const desc = document.createElement("p");
  desc.className = "plan-desc";
  desc.textContent = featureDescriptions[plan.code] || "A simple private workspace.";
  heading.append(name, desc);

  const price = document.createElement("div");
  if(plan.pricing_currency!=="USD")throw Error("Unexpected subscription currency");
  price.className = "plan-price";
  const amount = document.createElement("strong");
  amount.textContent = new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(plan.monthly_price_usd);
  const per = document.createElement("small");
  per.textContent = "/month";
  price.append(amount, per);
  const tag = document.createElement("span");
  tag.className = "plan-tag";
  tag.textContent = plan.code === "free" ? "Available now" : "Planned subscription · not yet billed";

  const action = document.createElement("a");
  action.className = "plan-action";
  if (plan.code === "free") action.dataset.authStart = "plan";
  action.href = plan.code === "free" ? "register.html"
    : "mailto:helloearthsupport@gmail.com?subject=" + encodeURIComponent("HelloEarth " + plan.name + " plan interest");
  action.textContent = plan.code === "free" ? "Get started →" : "Ask about launch →";

  const list = document.createElement("ul");
  list.className = "plan-features";
  const features = [
    translate("Up to {count} student profiles", {count:plan.max_students}),
    translate("Up to {count} new notes per month",{count:new Intl.NumberFormat("en-ZA").format(plan.max_notes_monthly)}),
    translate("{count} notes stored in total",{count:new Intl.NumberFormat("en-ZA").format(plan.max_notes_total)}),
    "Private Google / email sign-in",
    "CEFR levels, goals and student history",
    ...plannedAiFeatures(plan)
  ];
  for (const feature of features) {
    const li = document.createElement("li");
    li.textContent = feature;
    list.append(li);
  }
  article.append(heading, price, tag, action, list);
  return article;
}

async function loadPrices() {
  try {
    const { data, error } = await db.from("helloearth_plans")
      .select("code,name,monthly_price_usd,pricing_currency,max_students,max_notes_monthly,max_notes_total,display_order,planned_atlas_runtime,planned_byo_api_support")
      .eq("public_visible", true)
      .order("display_order", { ascending: true });
    if (error) throw error;
    if (!data?.length) throw new Error("No plans published");
    loadedPlans = data;
    root.replaceChildren(...data.map(card));
    document.dispatchEvent(new Event("helloearth:pricingcardsupdated"));
  } catch (_) {
    root.replaceChildren();
    const notice = document.createElement("p");
    notice.className = "pricing-loading";
    notice.textContent = "Plan details are temporarily unavailable. Please contact helloearthsupport@gmail.com for the latest information.";
    root.append(notice);
  }
}
loadPrices();

document.addEventListener("helloearth:languagechanged", () => {
  if (!loadedPlans) return;
  root.replaceChildren(...loadedPlans.map(card));
  document.dispatchEvent(new Event("helloearth:pricingcardsupdated"));
});
